-- ============================================================
-- Migration: 0008_clear_test_data.sql
-- Description: Clear test/sample transactions & reset customer metrics for LIVE production launch
-- ============================================================

-- 1. Enable RLS DELETE policy on transactions and cashback_ledger for authenticated administrators
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'auth_delete_transactions'
  ) THEN
    CREATE POLICY "auth_delete_transactions" ON public.transactions
      FOR DELETE USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cashback_ledger' AND policyname = 'auth_delete_ledger'
  ) THEN
    CREATE POLICY "auth_delete_ledger" ON public.cashback_ledger
      FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 2. Create secure RPC for clearing test transactions & resetting metrics from Admin UI
CREATE OR REPLACE FUNCTION public.clear_test_transactions_and_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ledger_count INTEGER := 0;
  v_tx_count     INTEGER := 0;
  v_cust_count   INTEGER := 0;
BEGIN
  -- Verify authenticated admin
  IF auth.role() != 'authenticated' THEN
    RAISE EXCEPTION 'Unauthorized: only authenticated administrators can clear test transactions';
  END IF;

  -- 1. Clear all rows from cashback_ledger
  DELETE FROM public.cashback_ledger;
  GET DIAGNOSTICS v_ledger_count = ROW_COUNT;

  -- 2. Clear all rows from transactions
  DELETE FROM public.transactions;
  GET DIAGNOSTICS v_tx_count = ROW_COUNT;

  -- 3. Reset all customer balances and metrics to 0.0
  UPDATE public.customers 
  SET 
    total_purchases   = 0.0,
    cashback_earned   = 0.0,
    cashback_redeemed = 0.0,
    cashback_balance  = 0.0;
  GET DIAGNOSTICS v_cust_count = ROW_COUNT;

  -- 4. Record audit log entry if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_audit_logs') THEN
    INSERT INTO public.admin_audit_logs (action, performed_by, details)
    VALUES (
      'CLEAR_TEST_TRANSACTIONS',
      COALESCE(auth.email(), 'authenticated_admin'),
      jsonb_build_object(
        'transactions_cleared', v_tx_count,
        'ledger_cleared', v_ledger_count,
        'customers_reset', v_cust_count,
        'timestamp', NOW()
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transactions_cleared', v_tx_count,
    'ledger_cleared', v_ledger_count,
    'customers_reset', v_cust_count
  );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.clear_test_transactions_and_metrics() TO authenticated;

-- 3. Direct execution when run in Supabase SQL editor:
DELETE FROM public.cashback_ledger;
DELETE FROM public.transactions;
UPDATE public.customers 
SET 
  total_purchases   = 0.0,
  cashback_earned   = 0.0,
  cashback_redeemed = 0.0,
  cashback_balance  = 0.0;
