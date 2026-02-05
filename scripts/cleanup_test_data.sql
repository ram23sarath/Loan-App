-- ============================================================
-- CLEANUP SCRIPT: Hard Delete Test Data
-- Removes all traces of test customers 1, 2, and 3
-- ============================================================

DO $$
DECLARE
    v_user_1 uuid := '00000000-0000-4000-a000-000000000001';
    v_user_2 uuid := '00000000-0000-4000-a000-000000000002';
    v_user_3 uuid := '00000000-0000-4000-a000-000000000003';
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'CLEANING UP TEST DATA';
    RAISE NOTICE '============================================================';

    -- 1. Interest Ledger (Audit)
    DELETE FROM public.interest_ledger 
    WHERE customer_id IN (v_user_1, v_user_2, v_user_3);
    RAISE NOTICE '✓ Ledger entries deleted';

    -- 2. Customer Interest (Balances)
    DELETE FROM public.customer_interest 
    WHERE customer_id IN (v_user_1, v_user_2, v_user_3);
    RAISE NOTICE '✓ Interest balances deleted';

    -- 3. Subscriptions
    DELETE FROM public.subscriptions 
    WHERE customer_id IN (v_user_1, v_user_2, v_user_3);
    RAISE NOTICE '✓ Subscriptions deleted';

    -- 4. Customers (The users themselves)
    DELETE FROM public.customers 
    WHERE id IN (v_user_1, v_user_2, v_user_3);
    RAISE NOTICE '✓ Customers deleted';

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'CLEANUP COMPLETE';
    RAISE NOTICE '============================================================';
END;
$$;
