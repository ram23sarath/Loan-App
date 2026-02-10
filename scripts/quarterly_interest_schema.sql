-- ============================================================
-- Migration: Quarterly Interest Schema
-- Creates tables for tracking interest per customer
-- ============================================================

-- 1. customer_interest: Track accumulated interest per customer
CREATE TABLE IF NOT EXISTS public.customer_interest (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id uuid NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
    total_interest_charged numeric DEFAULT 0 NOT NULL,
    last_applied_quarter date,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.customer_interest IS 'Tracks total quarterly interest charged per customer';
COMMENT ON COLUMN public.customer_interest.total_interest_charged IS 'Cumulative 3% interest deducted from Total Collected';

CREATE INDEX IF NOT EXISTS idx_customer_interest_customer ON public.customer_interest(customer_id);

ALTER TABLE public.customer_interest ENABLE ROW LEVEL SECURITY;

-- RLS: All authenticated users can read (needed for Summary Dashboard)
CREATE POLICY "Allow read access for all users" ON public.customer_interest
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Service role full access" ON public.customer_interest
FOR ALL USING (auth.role() = 'service_role');

-- 2. interest_ledger: Audit trail for every interest application
CREATE TABLE IF NOT EXISTS public.interest_ledger (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    subscription_total_used numeric NOT NULL,
    interest_rate_pct numeric NOT NULL DEFAULT 3.0,
    interest_amount numeric NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    applied_at timestamptz DEFAULT now(),
    
    -- Prevent duplicate entries for same customer/quarter
    CONSTRAINT unique_customer_period UNIQUE (customer_id, period_start)
);

COMMENT ON TABLE public.interest_ledger IS 'Audit log for quarterly interest applications';

CREATE INDEX IF NOT EXISTS idx_interest_ledger_customer ON public.interest_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_interest_ledger_period ON public.interest_ledger(period_start);

ALTER TABLE public.interest_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read access" ON public.interest_ledger
FOR SELECT USING (
  auth.role() = 'authenticated' AND
  NOT EXISTS (SELECT 1 FROM public.customers WHERE user_id = auth.uid())
);

CREATE POLICY "Service role full access" ON public.interest_ledger
FOR ALL USING (auth.role() = 'service_role');
