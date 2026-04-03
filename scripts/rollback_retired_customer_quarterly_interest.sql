-- ============================================================
-- Script: Roll back quarterly interest for retired customers
-- Assumption: reverses all credited quarterly interest entries
-- for currently retired customers even if the ledger history is incomplete.
-- ============================================================

DO $$
DECLARE
    v_customer RECORD;
    v_result jsonb;
    v_current_interest numeric := 0;
    v_had_ledger_entries boolean := false;
    v_customers_processed integer := 0;
    v_ledger_entries_rolled_back integer := 0;
    v_total_interest_reversed numeric := 0;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'ROLLING BACK QUARTERLY INTEREST FOR RETIRED CUSTOMERS';
    RAISE NOTICE '============================================================';

    FOR v_customer IN
        SELECT
            c.id,
            c.name,
            COALESCE(ci.total_interest_charged, 0) AS current_interest
        FROM public.customers c
        LEFT JOIN public.customer_interest ci
          ON ci.customer_id = c.id
        WHERE c.deleted_at IS NULL
          AND COALESCE(c.is_retired, false) = true
          AND (
              COALESCE(ci.total_interest_charged, 0) > 0
              OR EXISTS (
                  SELECT 1
                  FROM public.interest_ledger il
                  WHERE il.customer_id = c.id
              )
          )
        ORDER BY c.name
    LOOP
        v_customers_processed := v_customers_processed + 1;
        v_current_interest := COALESCE(v_customer.current_interest, 0);
        v_had_ledger_entries := false;
        RAISE NOTICE 'Processing retired customer: % (%)', v_customer.name, v_customer.id;

        WHILE EXISTS (
            SELECT 1
            FROM public.interest_ledger il
            WHERE il.customer_id = v_customer.id
        ) LOOP
            v_had_ledger_entries := true;
            SELECT public.rollback_quarterly_interest(v_customer.id) INTO v_result;
            v_ledger_entries_rolled_back := v_ledger_entries_rolled_back + 1;
            v_total_interest_reversed := v_total_interest_reversed
                + COALESCE((v_result->>'reverted_interest')::numeric, 0);
        END LOOP;

        IF v_current_interest > 0 OR v_had_ledger_entries THEN
            INSERT INTO public.customer_interest (
                customer_id,
                total_interest_charged,
                last_applied_quarter
            ) VALUES (
                v_customer.id,
                0,
                NULL
            )
            ON CONFLICT (customer_id) DO UPDATE
            SET total_interest_charged = 0,
                last_applied_quarter = NULL,
                updated_at = now();
        END IF;

        RAISE NOTICE 'Rolled back all credited interest for %', v_customer.name;
    END LOOP;

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'SUMMARY:';
    RAISE NOTICE 'Retired customers processed: %', v_customers_processed;
    RAISE NOTICE 'Ledger entries rolled back: %', v_ledger_entries_rolled_back;
    RAISE NOTICE 'Total interest reversed: %', v_total_interest_reversed;
    RAISE NOTICE '============================================================';
END;
$$;
