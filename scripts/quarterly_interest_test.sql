-- ============================================================
-- TEST HARNESS: Quarterly Interest for Customer
-- Target: 57d1ddae-207a-430c-8b29-5ccd5621be10
-- Run this in staging/development first!
-- ============================================================

DO $$
DECLARE
    v_customer_id uuid := '57d1ddae-207a-430c-8b29-5ccd5621be10';
    v_result jsonb;
    v_sub_total numeric;
    v_interest_before numeric;
    v_interest_after numeric;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'QUARTERLY INTEREST TEST HARNESS';
    RAISE NOTICE 'Customer ID: %', v_customer_id;
    RAISE NOTICE '============================================================';
    
    -- Step 1: Show subscription total
    SELECT COALESCE(SUM(amount), 0) INTO v_sub_total
    FROM public.subscriptions
    WHERE customer_id = v_customer_id AND deleted_at IS NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE 'STEP 1: Current subscription_total = ₹%', v_sub_total;
    RAISE NOTICE 'Expected interest (3%%): ₹%', ROUND(v_sub_total * 0.03, 2);
    
    -- Step 2: Show interest balance before
    SELECT COALESCE(total_interest_charged, 0) INTO v_interest_before
    FROM public.customer_interest
    WHERE customer_id = v_customer_id;
    
    v_interest_before := COALESCE(v_interest_before, 0);
    RAISE NOTICE '';
    RAISE NOTICE 'STEP 2: Interest charged BEFORE = ₹%', v_interest_before;
    
    -- Step 3: Apply interest
    RAISE NOTICE '';
    RAISE NOTICE 'STEP 3: Calling apply_quarterly_interest_for_customer()...';
    
    SELECT public.apply_quarterly_interest_for_customer(v_customer_id) INTO v_result;
    RAISE NOTICE 'Result: %', v_result;
    
    -- Step 4: Show interest balance after
    SELECT COALESCE(total_interest_charged, 0) INTO v_interest_after
    FROM public.customer_interest
    WHERE customer_id = v_customer_id;
    
    RAISE NOTICE '';
    RAISE NOTICE 'STEP 4: Interest charged AFTER = ₹%', v_interest_after;
    
    -- Step 5: Validate
    RAISE NOTICE '';
    RAISE NOTICE 'STEP 5: VALIDATION';
    
    IF v_result->>'status' = 'success' THEN
        RAISE NOTICE '  ✓ Interest applied successfully';
        RAISE NOTICE '  ✓ New interest: ₹%', v_result->>'interest_charged';
    ELSIF v_result->>'status' = 'skipped' THEN
        RAISE NOTICE '  ⚠ Skipped: %', v_result->>'reason';
    ELSE
        RAISE NOTICE '  ✗ Error: %', v_result->>'error';
    END IF;
    
    -- Step 6: Test idempotency
    RAISE NOTICE '';
    RAISE NOTICE 'STEP 6: IDEMPOTENCY TEST (calling again)...';
    
    SELECT public.apply_quarterly_interest_for_customer(v_customer_id) INTO v_result;
    
    IF v_result->>'status' = 'skipped' THEN
        RAISE NOTICE '  ✓ Correctly skipped duplicate application';
    ELSE
        RAISE NOTICE '  ✗ Expected skip, got: %', v_result->>'status';
    END IF;
    
    -- Step 7: Show ledger entries
    RAISE NOTICE '';
    RAISE NOTICE 'STEP 7: LEDGER ENTRIES';
    
    FOR v_result IN
        SELECT jsonb_build_object(
            'period', period_start || ' to ' || period_end,
            'sub_total', subscription_total_used,
            'interest', interest_amount,
            'applied', applied_at
        ) as entry
        FROM public.interest_ledger
        WHERE customer_id = v_customer_id
        ORDER BY applied_at DESC
        LIMIT 5
    LOOP
        RAISE NOTICE '  %', v_result;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'TEST COMPLETE';
    RAISE NOTICE '============================================================';
END;
$$;
