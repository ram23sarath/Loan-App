-- ============================================================
-- RUN SCRIPT: Execute Interest Calculation
-- Triggers the interest calculation function for the 3 test users
-- ============================================================

DO $$
DECLARE
    v_user_1 uuid := '00000000-0000-4000-a000-000000000001';
    v_user_2 uuid := '00000000-0000-4000-a000-000000000002';
    v_user_3 uuid := '00000000-0000-4000-a000-000000000003';
    v_result jsonb;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'RUNNING QUARTERLY INTEREST CALCULATIONS';
    RAISE NOTICE '============================================================';

    -- TEST 1: Normal Active User
    RAISE NOTICE '------------------------------------------------------------';
    RAISE NOTICE 'TEST 1: User 1 (Active, ~150k subs)';
    RAISE NOTICE 'Expected: Success, ~4500 interest';
    
    SELECT public.apply_quarterly_interest_for_customer(v_user_1) INTO v_result;
    RAISE NOTICE 'Result: %', v_result;

    -- TEST 2: User with No Subscriptions
    RAISE NOTICE '------------------------------------------------------------';
    RAISE NOTICE 'TEST 2: User 2 (No Subs)';
    RAISE NOTICE 'Expected: Skipped (Reason: No subscriptions)';

    SELECT public.apply_quarterly_interest_for_customer(v_user_2) INTO v_result;
    RAISE NOTICE 'Result: %', v_result;

    -- TEST 3: Already Processed User
    RAISE NOTICE '------------------------------------------------------------';
    RAISE NOTICE 'TEST 3: User 3 (Already processed)';
    RAISE NOTICE 'Expected: Skipped (Reason: Interest already applied)';

    SELECT public.apply_quarterly_interest_for_customer(v_user_3) INTO v_result;
    RAISE NOTICE 'Result: %', v_result;

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'EXECUTION COMPLETE';
    RAISE NOTICE '============================================================';
END;
$$;
