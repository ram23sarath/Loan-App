-- ============================================================
-- SETUP SCRIPT: Create Test Customers and Data
-- Creates 3 test users with different scenarios for quarterly interest testing
-- ============================================================

-- Test User IDs (Static UUIDs for reproducibility)
-- User 1: 00000000-0000-4000-a000-000000000001 (Active, Normal)
-- User 2: 00000000-0000-4000-a000-000000000002 (No Subscriptions)
-- User 3: 00000000-0000-4000-a000-000000000003 (Already Processed in this quarter)

DO $$
DECLARE
    v_user_1 uuid := '00000000-0000-4000-a000-000000000001';
    v_user_2 uuid := '00000000-0000-4000-a000-000000000002';
    v_user_3 uuid := '00000000-0000-4000-a000-000000000003';
    v_quarter_start date;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'SETTING UP TEST DATA';
    RAISE NOTICE '============================================================';

    -- 1. Create Customers
    -- We use ON CONFLICT DO NOTHING to ensure idempotency if run multiple times
    
    -- User 1
    INSERT INTO public.customers (id, name, phone, created_at)
    VALUES (v_user_1, 'Test User 1 (Active)', '9999999001', now())
    ON CONFLICT (id) DO UPDATE 
    SET name = 'Test User 1 (Active)', deleted_at = NULL;
    
    -- User 2
    INSERT INTO public.customers (id, name, phone, created_at)
    VALUES (v_user_2, 'Test User 2 (No Subs)', '9999999002', now())
    ON CONFLICT (id) DO UPDATE 
    SET name = 'Test User 2 (No Subs)', deleted_at = NULL;
    
    -- User 3
    INSERT INTO public.customers (id, name, phone, created_at)
    VALUES (v_user_3, 'Test User 3 ( processed)', '9999999003', now())
    ON CONFLICT (id) DO UPDATE 
    SET name = 'Test User 3 (processed)', deleted_at = NULL;

    RAISE NOTICE '✓ Customers created/ensured';

    -- 2. Create Subscriptions
    -- First, clear existing valid subscriptions for these users to ensure clean state for this run
    -- (We don't hard delete here to be safe, just ensure we insert what we need, 
    --  but actually for setup it's better to clean slate them if we want specific values)
    DELETE FROM public.subscriptions WHERE customer_id IN (v_user_1, v_user_2, v_user_3);

    -- User 1: Has 2 subscriptions (Total 150,000)
    INSERT INTO public.subscriptions (customer_id, amount, date, receipt, created_at)
    VALUES 
    (v_user_1, 100000, CURRENT_DATE, 'TEST-REC-001', now()),
    (v_user_1, 50000, CURRENT_DATE, 'TEST-REC-002', now());

    -- User 2: No subscriptions (intentionally left empty)

    -- User 3: Has 1 subscription (Total 200,000)
    INSERT INTO public.subscriptions (customer_id, amount, date, receipt, created_at)
    VALUES 
    (v_user_3, 200000, CURRENT_DATE, 'TEST-REC-003', now());

    RAISE NOTICE '✓ Subscriptions created';

    -- 3. Simulate "Already Processed" state for User 3
    v_quarter_start := DATE_TRUNC('quarter', CURRENT_DATE)::date;
    
    -- Clear any existing interest/ledger for these users to be sure
    DELETE FROM public.interest_ledger WHERE customer_id IN (v_user_1, v_user_2, v_user_3);
    DELETE FROM public.customer_interest WHERE customer_id IN (v_user_1, v_user_2, v_user_3);
    
    -- Insert a fake ledger entry for User 3 for this quarter
    INSERT INTO public.interest_ledger (
        customer_id, 
        subscription_total_used, 
        interest_rate_pct, 
        interest_amount, 
        period_start, 
        period_end
    ) VALUES (
        v_user_3,
        200000,
        3.0,
        6000,
        v_quarter_start,
        (v_quarter_start + INTERVAL '3 months' - INTERVAL '1 day')::date
    );

    RAISE NOTICE '✓ User 3 marked as already processed for this quarter';
    
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'SETUP COMPLETE';
    RAISE NOTICE '============================================================';
END;
$$;
