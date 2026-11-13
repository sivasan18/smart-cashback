-- ==============================================================================
-- SMART CASHBACK – MIGRATION 006: REPORTING IDEMPOTENCY & RATE LIMITING
-- ==============================================================================
-- Run this in your Supabase SQL Editor (Project → SQL Editor)
--
-- This migration provisions atomic, race-condition-free protection for reports:
-- 1. Resolves any pre-existing duplicate records before creating unique constraints.
-- 2. claim_scheduled_report(): Advisory-locked atomic claim function for weekly/monthly cron runs.
--    - Enforces single-worker execution (concurrent cron triggers cannot duplicate).
--    - Considers both 'processing' and 'success' states.
--    - Automatically recovers stale 'processing' runs older than 10 minutes.
--    - Safely allows retries if a prior run 'failed'.
-- 3. claim_manual_report(): Advisory-locked atomic rate limiter for administrator dispatches.
--    - Enforces 60-second cooldown per administrator.
--    - Prevents double-click / concurrent race bypasses.
--    - Never permanently locks on failures.
--    - Scheduled weekly/monthly reports never consume the administrator quota.
-- 4. Unique partial index guaranteeing zero duplicate 'success' rows at the database level.
-- ==============================================================================

-- ─── 1. SAFE DATA PREPARATION ────────────────────────────────────────────────
-- Ensure any pre-existing duplicate successful scheduled records are safely resolved
-- before creating the unique index. Keeps the newest record and marks older duplicates
-- as superseded to maintain a complete historical audit trail without deleting rows.
UPDATE public.report_history
SET status = 'failed',
    error_message = 'Superseded: Duplicate historical entry resolved during migration 006'
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY report_type, period_label 
             ORDER BY created_at DESC
           ) as rnum
    FROM public.report_history
    WHERE status = 'success' AND report_type IN ('weekly', 'monthly')
  ) t
  WHERE t.rnum > 1
);

-- ─── 2. PERFORMANCE & UNIQUENESS INDEXES ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS report_history_idempotency_idx 
  ON public.report_history (report_type, period_label, status);

CREATE INDEX IF NOT EXISTS report_history_rate_limit_idx 
  ON public.report_history (initiated_by, report_type, created_at DESC);

-- Physical database-level guarantee: No two successful deliveries for the same scheduled period
CREATE UNIQUE INDEX IF NOT EXISTS report_history_unique_scheduled_idx
  ON public.report_history (report_type, period_label)
  WHERE (status = 'success' AND report_type IN ('weekly', 'monthly'));

-- ─── 3. ATOMIC SCHEDULED REPORT CLAIM FUNCTION ───────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_scheduled_report(
  p_report_type     TEXT,
  p_period_label    TEXT,
  p_period_start    TIMESTAMPTZ,
  p_period_end      TIMESTAMPTZ,
  p_recipient_email TEXT,
  p_initiated_by    TEXT,
  p_file_name       TEXT,
  p_stale_minutes   INTEGER DEFAULT 10
)
RETURNS TABLE (
  claimed           BOOLEAN,
  history_id        UUID,
  reason            TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id     UUID;
  v_existing_status TEXT;
  v_created_at      TIMESTAMPTZ;
  v_new_id          UUID;
BEGIN
  -- Strict defense-in-depth authorization check:
  IF auth.role() != 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: claim_scheduled_report is restricted to trusted backend service_role only.';
  END IF;

  -- 1. Acquire transaction-level advisory lock specific to this scheduled report period.
  -- This serializes concurrent Cron triggers and guarantees zero duplicate executions.
  PERFORM pg_advisory_xact_lock(hashtext('scheduled_report_' || p_report_type || '_' || p_period_label));

  -- 2. Inspect the latest record for this period
  SELECT id, status, created_at
  INTO v_existing_id, v_existing_status, v_created_at
  FROM public.report_history
  WHERE report_type = p_report_type
    AND period_label = p_period_label
  ORDER BY created_at DESC
  LIMIT 1;

  -- Case A: Period was already completed and dispatched
  IF v_existing_status = 'success' THEN
    RETURN QUERY SELECT FALSE, v_existing_id, 'already_completed';
    RETURN;
  END IF;

  -- Case B: An execution is currently processing
  IF v_existing_status = 'processing' THEN
    IF v_created_at >= NOW() - (p_stale_minutes || ' minutes')::INTERVAL THEN
      -- Active worker is currently running
      RETURN QUERY SELECT FALSE, v_existing_id, 'in_progress';
      RETURN;
    ELSE
      -- Stale worker recovery (> 10 mins). Mark as timed out so a new worker can claim
      UPDATE public.report_history
      SET status = 'failed',
          error_message = 'Timeout: Process abandoned or crashed after ' || p_stale_minutes || ' minutes'
      WHERE id = v_existing_id;
    END IF;
  END IF;

  -- Case C: No prior run, or previous run failed / timed out. Claim the period.
  INSERT INTO public.report_history (
    report_type,
    period_label,
    period_start,
    period_end,
    recipient_email,
    status,
    total_customers,
    total_transactions,
    total_sales_amount,
    initiated_by,
    file_name
  ) VALUES (
    p_report_type,
    p_period_label,
    p_period_start,
    p_period_end,
    p_recipient_email,
    'processing',
    0,
    0,
    0,
    p_initiated_by,
    p_file_name
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT TRUE, v_new_id, 'claimed';
  RETURN;
END;
$$;

-- Revoke public execution; allow backend service_role and verified administrators
REVOKE ALL ON FUNCTION public.claim_scheduled_report FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_scheduled_report TO service_role;

-- ─── 4. ATOMIC MANUAL REPORT RATE-LIMIT CLAIM FUNCTION ───────────────────────
CREATE OR REPLACE FUNCTION public.claim_manual_report(
  p_report_type     TEXT,
  p_period_label    TEXT,
  p_period_start    TIMESTAMPTZ,
  p_period_end      TIMESTAMPTZ,
  p_recipient_email TEXT,
  p_initiated_by    TEXT,
  p_file_name       TEXT,
  p_cooldown_secs   INTEGER DEFAULT 60
)
RETURNS TABLE (
  allowed           BOOLEAN,
  history_id        UUID,
  retry_after_secs  INTEGER,
  reason            TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_created  TIMESTAMPTZ;
  v_elapsed_secs    INTEGER;
  v_new_id          UUID;
BEGIN
  -- Strict defense-in-depth authorization check:
  IF auth.role() != 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: claim_manual_report is restricted to trusted backend service_role only.';
  END IF;

  -- 1. Acquire transaction-level advisory lock per administrator to serialize manual requests
  PERFORM pg_advisory_xact_lock(hashtext('manual_report_cooldown_' || LOWER(p_initiated_by)));

  -- 2. Check the most recent manual report dispatched by this administrator
  -- (Scheduled weekly and monthly reports are excluded from this quota)
  SELECT created_at
  INTO v_recent_created
  FROM public.report_history
  WHERE initiated_by = p_initiated_by
    AND report_type IN ('manual', 'custom', 'test')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_recent_created IS NOT NULL THEN
    v_elapsed_secs := EXTRACT(EPOCH FROM (NOW() - v_recent_created))::INTEGER;
    IF v_elapsed_secs < p_cooldown_secs THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, (p_cooldown_secs - v_elapsed_secs), 'rate_limited';
      RETURN;
    END IF;
  END IF;

  -- 3. Cooldown has elapsed. Atomically claim and record processing state
  INSERT INTO public.report_history (
    report_type,
    period_label,
    period_start,
    period_end,
    recipient_email,
    status,
    total_customers,
    total_transactions,
    total_sales_amount,
    initiated_by,
    file_name
  ) VALUES (
    p_report_type,
    p_period_label,
    p_period_start,
    p_period_end,
    p_recipient_email,
    'processing',
    0,
    0,
    0,
    p_initiated_by,
    p_file_name
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT TRUE, v_new_id, 0, 'claimed';
  RETURN;
END;
$$;

-- Revoke public execution; allow backend service_role and verified administrators
REVOKE ALL ON FUNCTION public.claim_manual_report FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_manual_report TO service_role;
