-- ==============================================================================
-- SMART CASHBACK – MIGRATION 005: DYNAMIC ADMIN MANAGEMENT & REPORTING SYSTEM
-- ==============================================================================
-- Run this in your Supabase SQL Editor (Project → SQL Editor)
--
-- This migration provisions:
-- 1. admin_users: Dynamic central administrator registry (No hardcoded emails in code)
-- 2. is_admin(): Dynamic server-side authorization checking admin_users & app_metadata
-- 3. report_settings: Stores email recipient, verification status, schedules & timezone
-- 4. report_history: Audit log for all scheduled and manual Excel report dispatches
-- 5. Row Level Security policies restricting administration strictly to active admins
-- 6. get_report_data(): Hardened reporting RPC accessible ONLY by trusted service_role
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 0. CENTRAL DYNAMIC ADMINISTRATOR REGISTRY ──────────────────────────────
-- Allows adding, modifying, and deactivating administrators at runtime without
-- modifying source code or redeploying Edge Functions.
CREATE TABLE IF NOT EXISTS public.admin_users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_users_email_idx ON public.admin_users (email);
CREATE INDEX IF NOT EXISTS admin_users_user_id_idx ON public.admin_users (user_id);
CREATE INDEX IF NOT EXISTS admin_users_active_idx ON public.admin_users (is_active);

-- Seed initial store administrator: sivar75@gmail.com
INSERT INTO public.admin_users (email, role, is_active)
VALUES ('sivar75@gmail.com', 'admin', TRUE)
ON CONFLICT (email) DO UPDATE 
SET is_active = TRUE, updated_at = NOW();

-- Automatically link user_id if the user already exists in auth.users
UPDATE public.admin_users au
SET user_id = u.id
FROM auth.users u
WHERE LOWER(au.email) = LOWER(u.email)
  AND au.user_id IS NULL;

-- ─── 1. DYNAMIC ADMINISTRATOR AUTHORIZATION FUNCTION ─────────────────────────
-- Validates caller identity through trusted, server-controlled mechanisms only:
-- - Supabase service_role (Edge Functions / Cron)
-- - Server-managed app_metadata.role = 'admin' (set via admin API)
-- - Central public.admin_users table (confirmed email + is_active = TRUE)
-- IMPORTANT: Client-editable user_metadata is NEVER trusted.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid             UUID;
  v_app_role        TEXT;
  v_email           TEXT;
  v_is_confirmed    BOOLEAN;
  v_is_active_admin BOOLEAN := FALSE;
BEGIN
  -- 1. Backend Service Role (used by Supabase Edge Functions & internal cron jobs)
  IF auth.role() = 'service_role' THEN
    RETURN TRUE;
  END IF;

  -- 2. Reject unauthenticated or anonymous callers immediately
  v_uid := auth.uid();
  IF v_uid IS NULL OR auth.role() != 'authenticated' THEN
    RETURN FALSE;
  END IF;

  -- 3. Check server-managed app_metadata from JWT (cannot be altered by users)
  v_app_role := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '');
  IF v_app_role IN ('admin', 'super_admin') THEN
    RETURN TRUE;
  END IF;

  -- 4. Authoritative dynamic verification against auth.users AND public.admin_users:
  --    Verifies the user exists, has a confirmed email address, and is an active administrator.
  SELECT
    LOWER(u.email),
    (u.email_confirmed_at IS NOT NULL),
    COALESCE(u.raw_app_meta_data ->> 'role', ''),
    COALESCE(au.is_active, FALSE)
  INTO
    v_email,
    v_is_confirmed,
    v_app_role,
    v_is_active_admin
  FROM auth.users u
  LEFT JOIN public.admin_users au 
    ON (au.user_id = u.id OR LOWER(au.email) = LOWER(u.email))
  WHERE u.id = v_uid;

  IF FOUND THEN
    -- Admin role in server-managed raw_app_meta_data
    IF v_app_role IN ('admin', 'super_admin') THEN
      RETURN TRUE;
    END IF;

    -- Confirmed email AND active in public.admin_users
    IF v_is_confirmed AND v_is_active_admin THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- All other callers are rejected
  RETURN FALSE;
END;
$$;

-- Restrict is_admin execution permissions
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- ─── 2. RLS FOR ADMIN USERS TABLE ────────────────────────────────────────────
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_admin_users" ON public.admin_users;
CREATE POLICY "admin_read_admin_users" ON public.admin_users
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_admin_users" ON public.admin_users;
CREATE POLICY "admin_insert_admin_users" ON public.admin_users
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_admin_users" ON public.admin_users;
CREATE POLICY "admin_update_admin_users" ON public.admin_users
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_admin_users" ON public.admin_users;
CREATE POLICY "admin_delete_admin_users" ON public.admin_users
  FOR DELETE USING (public.is_admin());

REVOKE ALL ON TABLE public.admin_users FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_users TO authenticated, service_role;

-- ─── 3. REPORT SETTINGS TABLE ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.report_settings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_email       TEXT NOT NULL DEFAULT 'sivar75@gmail.com',
  is_email_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  verification_code     TEXT,
  verification_sent_at  TIMESTAMPTZ,
  weekly_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  weekly_day_of_week    INTEGER NOT NULL DEFAULT 0, -- 0 = Sunday, 1 = Monday, ...
  weekly_time           TEXT NOT NULL DEFAULT '21:00', -- HH:mm (24-hour, 9:00 PM IST)
  monthly_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  monthly_day_of_month  INTEGER NOT NULL DEFAULT 1,    -- 1st day of month
  monthly_time          TEXT NOT NULL DEFAULT '09:00', -- HH:mm (24-hour, 9:00 AM IST)
  timezone              TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  last_report_at        TIMESTAMPTZ,
  last_report_status    TEXT, -- 'success' | 'failed'
  last_report_error     TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed singleton configuration row with initial recipient sivar75@gmail.com
INSERT INTO public.report_settings (
  recipient_email,
  is_email_verified,
  weekly_enabled,
  weekly_day_of_week,
  weekly_time,
  monthly_enabled,
  monthly_day_of_month,
  monthly_time,
  timezone
)
SELECT 'sivar75@gmail.com', FALSE, FALSE, 0, '21:00', FALSE, 1, '09:00', 'Asia/Kolkata'
WHERE NOT EXISTS (SELECT 1 FROM public.report_settings LIMIT 1);

-- ─── 4. REPORT HISTORY & AUDIT LOG TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.report_history (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_type         TEXT NOT NULL CHECK (report_type IN ('weekly', 'monthly', 'manual', 'custom', 'test')),
  period_label        TEXT NOT NULL,
  period_start        TIMESTAMPTZ,
  period_end          TIMESTAMPTZ,
  recipient_email     TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('success', 'failed', 'processing')),
  resend_message_id   TEXT,
  total_customers     INTEGER NOT NULL DEFAULT 0,
  total_transactions  INTEGER NOT NULL DEFAULT 0,
  total_sales_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  initiated_by        TEXT NOT NULL, -- e.g. 'system_cron' or admin email
  error_message       TEXT,
  file_name           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS report_history_created_at_idx ON public.report_history (created_at DESC);
CREATE INDEX IF NOT EXISTS report_history_status_idx     ON public.report_history (status);
CREATE INDEX IF NOT EXISTS report_history_type_idx       ON public.report_history (report_type);

-- ─── 5. ROW LEVEL SECURITY (RLS) POLICIES ─────────────────────────────────────
-- Restrict access strictly to verified administrators (never general authenticated users)
ALTER TABLE public.report_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_history  ENABLE ROW LEVEL SECURITY;

-- report_settings: Only verified administrators can read and update
DROP POLICY IF EXISTS "auth_read_report_settings" ON public.report_settings;
DROP POLICY IF EXISTS "admin_read_report_settings" ON public.report_settings;
CREATE POLICY "admin_read_report_settings" ON public.report_settings
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "auth_update_report_settings" ON public.report_settings;
DROP POLICY IF EXISTS "admin_update_report_settings" ON public.report_settings;
CREATE POLICY "admin_update_report_settings" ON public.report_settings
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "auth_insert_report_settings" ON public.report_settings;
DROP POLICY IF EXISTS "admin_insert_report_settings" ON public.report_settings;
CREATE POLICY "admin_insert_report_settings" ON public.report_settings
  FOR INSERT WITH CHECK (public.is_admin());

-- report_history: Only verified administrators can view and insert audit logs
DROP POLICY IF EXISTS "auth_read_report_history" ON public.report_history;
DROP POLICY IF EXISTS "admin_read_report_history" ON public.report_history;
CREATE POLICY "admin_read_report_history" ON public.report_history
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "auth_insert_report_history" ON public.report_history;
DROP POLICY IF EXISTS "admin_insert_report_history" ON public.report_history;
CREATE POLICY "admin_insert_report_history" ON public.report_history
  FOR INSERT WITH CHECK (public.is_admin());

-- ─── 6. SECURE REPORT DATA RPC (BACKEND-RESTRICTED) ───────────────────────────
-- Gathers customer master and period sales in a single read-only transaction.
-- Protected against unauthorized execution:
-- - Revoked from PUBLIC, anon, and general authenticated users.
-- - Executable strictly by the backend service_role.
-- - Enforces internal is_admin() authorization check.
CREATE OR REPLACE FUNCTION public.get_report_data(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date   TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customers    JSONB;
  v_transactions JSONB;
  v_summary      JSONB;
  v_from         TIMESTAMPTZ := COALESCE(p_start_date, '1970-01-01 00:00:00+00');
  v_to           TIMESTAMPTZ := COALESCE(p_end_date, NOW());
BEGIN
  -- Strict defense-in-depth authorization check:
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: get_report_data is restricted to authorized administrators only.';
  END IF;

  -- 1. All Customers with lifetime purchase count & latest purchase date
  WITH cust_stats AS (
    SELECT
      c.id,
      c.name,
      c.mobile,
      c.created_at,
      c.cashback_balance,
      c.total_purchases,
      c.cashback_earned,
      c.cashback_redeemed,
      COUNT(t.id) FILTER (WHERE t.status = 'completed') AS purchase_count,
      MAX(t.created_at) FILTER (WHERE t.status = 'completed') AS last_purchase_date,
      CASE
        WHEN c.cashback_balance > 0 THEN 'Active'
        WHEN MAX(t.created_at) >= (NOW() - INTERVAL '90 days') THEN 'Active'
        ELSE 'Inactive'
      END AS status
    FROM public.customers c
    LEFT JOIN public.transactions t ON t.customer_id = c.id
    WHERE c.name NOT LIKE '[Deleted Customer]'
      AND c.mobile NOT LIKE 'DEL%'
    GROUP BY c.id, c.name, c.mobile, c.created_at, c.cashback_balance,
             c.total_purchases, c.cashback_earned, c.cashback_redeemed
    ORDER BY c.created_at DESC
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'mobile', mobile,
      'created_at', created_at,
      'cashback_balance', cashback_balance,
      'purchase_count', purchase_count,
      'total_purchases', total_purchases,
      'cashback_earned', cashback_earned,
      'cashback_redeemed', cashback_redeemed,
      'last_purchase_date', last_purchase_date,
      'status', status
    )
  ) INTO v_customers FROM cust_stats;

  -- 2. Transactions within reporting period
  WITH tx_data AS (
    SELECT
      t.id,
      t.created_at,
      t.service_category,
      t.bill_amount,
      t.cashback_redeemed,
      t.amount_paid,
      t.cashback_earned,
      t.status,
      t.notes,
      COALESCE(t.payment_method, 'cash') AS payment_mode,
      COALESCE(c.name, 'Unknown') AS customer_name,
      COALESCE(c.mobile, '') AS customer_mobile
    FROM public.transactions t
    LEFT JOIN public.customers c ON c.id = t.customer_id
    WHERE t.created_at >= v_from
      AND t.created_at <= v_to
    ORDER BY t.created_at DESC
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'created_at', created_at,
      'service_category', service_category,
      'bill_amount', bill_amount,
      'cashback_redeemed', cashback_redeemed,
      'amount_paid', amount_paid,
      'cashback_earned', cashback_earned,
      'status', status,
      'payment_mode', payment_mode,
      'customer_name', customer_name,
      'customer_mobile', customer_mobile
    )
  ) INTO v_transactions FROM tx_data;

  -- 3. Summary KPIs within reporting period
  SELECT jsonb_build_object(
    'total_gross_bill', COALESCE(SUM(bill_amount) FILTER (WHERE status = 'completed'), 0),
    'total_completed_sales', COALESCE(SUM(amount_paid) FILTER (WHERE status = 'completed'), 0),
    'completed_tx_count', COUNT(*) FILTER (WHERE status = 'completed'),
    'average_bill_value', CASE
      WHEN COUNT(*) FILTER (WHERE status = 'completed') > 0
      THEN ROUND(COALESCE(SUM(bill_amount) FILTER (WHERE status = 'completed'), 0) / COUNT(*) FILTER (WHERE status = 'completed'), 2)
      ELSE 0
    END,
    'total_cashback_earned', COALESCE(SUM(cashback_earned) FILTER (WHERE status = 'completed'), 0),
    'total_cashback_redeemed', COALESCE(SUM(cashback_redeemed) FILTER (WHERE status = 'completed'), 0),
    'cancelled_tx_count', COUNT(*) FILTER (WHERE status IN ('cancelled', 'reversed')),
    'pending_tx_count', 0
  ) INTO v_summary
  FROM public.transactions
  WHERE created_at >= v_from AND created_at <= v_to;

  RETURN jsonb_build_object(
    'customers', COALESCE(v_customers, '[]'::jsonb),
    'transactions', COALESCE(v_transactions, '[]'::jsonb),
    'summary', COALESCE(v_summary, '{}'::jsonb)
  );
END;
$$;

-- Revoke default RPC privileges & restrict access
REVOKE ALL ON FUNCTION public.get_report_data(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_report_data(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
