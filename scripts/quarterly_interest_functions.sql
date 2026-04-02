-- ============================================================
-- Function: apply_quarterly_interest_for_customer
-- Calculates 3% interest on subscription total and tracks it
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_quarterly_interest_for_customer(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_name text;
    v_sub_total numeric;
    v_interest numeric;
    v_interest_rate numeric := 3.0;
    v_quarter_start date;
    v_quarter_end date;
    v_existing uuid;
    v_prev_total numeric;
    v_month int := EXTRACT(MONTH FROM CURRENT_DATE)::int;
    v_year  int := EXTRACT(YEAR  FROM CURRENT_DATE)::int;
BEGIN
    -- Determine current FY quarter boundaries (Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar)
    IF v_month >= 4 AND v_month <= 6 THEN
        v_quarter_start := make_date(v_year, 4, 1);
        v_quarter_end   := make_date(v_year, 6, 30);
    ELSIF v_month >= 7 AND v_month <= 9 THEN
        v_quarter_start := make_date(v_year, 7, 1);
        v_quarter_end   := make_date(v_year, 9, 30);
    ELSIF v_month >= 10 AND v_month <= 12 THEN
        v_quarter_start := make_date(v_year, 10, 1);
        v_quarter_end   := make_date(v_year, 12, 31);
    ELSE -- Jan-Mar
        v_quarter_start := make_date(v_year, 1, 1);
        v_quarter_end   := make_date(v_year, 3, 31);
    END IF;
    
    -- Verify customer exists
    SELECT name INTO v_customer_name
    FROM public.customers
    WHERE id = p_customer_id AND deleted_at IS NULL;
    
    IF v_customer_name IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'error', 'Customer not found or deleted',
            'customer_id', p_customer_id
        );
    END IF;
    
    -- Idempotency check: already applied this quarter?
    SELECT id INTO v_existing
    FROM public.interest_ledger
    WHERE customer_id = p_customer_id AND period_start = v_quarter_start;
    
    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object(
            'status', 'skipped',
            'reason', 'Interest already applied for this quarter',
            'customer_id', p_customer_id,
            'customer_name', v_customer_name,
            'period_start', v_quarter_start,
            'period_end', v_quarter_end
        );
    END IF;
    
    -- Calculate subscription total for customer
    SELECT COALESCE(SUM(amount), 0) INTO v_sub_total
    FROM public.subscriptions
    WHERE customer_id = p_customer_id AND deleted_at IS NULL;
    
    IF v_sub_total <= 0 THEN
        RETURN jsonb_build_object(
            'status', 'skipped',
            'reason', 'No subscriptions found for customer',
            'customer_id', p_customer_id,
            'customer_name', v_customer_name,
            'subscription_total', v_sub_total
        );
    END IF;
    
    -- Calculate 3% interest
    v_interest := ROUND(v_sub_total * (v_interest_rate / 100), 2);
    
    -- Sanity check
    IF v_interest > 1000000 THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'error', 'Interest exceeds sanity cap',
            'calculated_interest', v_interest,
            'customer_id', p_customer_id
        );
    END IF;
    
    -- Get previous total for reporting
    SELECT COALESCE(total_interest_charged, 0) INTO v_prev_total
    FROM public.customer_interest
    WHERE customer_id = p_customer_id;
    
    v_prev_total := COALESCE(v_prev_total, 0);
    
    -- Upsert customer_interest record
    INSERT INTO public.customer_interest (customer_id, total_interest_charged, last_applied_quarter)
    VALUES (p_customer_id, v_interest, v_quarter_start)
    ON CONFLICT (customer_id) DO UPDATE
    SET total_interest_charged = customer_interest.total_interest_charged + v_interest,
        last_applied_quarter = v_quarter_start,
        updated_at = now();
    
    -- Insert ledger entry for audit
    INSERT INTO public.interest_ledger (
        customer_id,
        subscription_total_used,
        interest_rate_pct,
        interest_amount,
        period_start,
        period_end
    ) VALUES (
        p_customer_id,
        v_sub_total,
        v_interest_rate,
        v_interest,
        v_quarter_start,
        v_quarter_end
    );
    
    RETURN jsonb_build_object(
        'status', 'success',
        'customer_id', p_customer_id,
        'customer_name', v_customer_name,
        'subscription_total', v_sub_total,
        'interest_rate_pct', v_interest_rate,
        'interest_charged', v_interest,
        'previous_total_interest', v_prev_total,
        'new_total_interest', v_prev_total + v_interest,
        'period_start', v_quarter_start,
        'period_end', v_quarter_end,
        'applied_at', CURRENT_TIMESTAMP
    );

EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'status', 'skipped',
            'reason', 'Concurrent execution detected - already applied',
            'customer_id', p_customer_id
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'error', SQLERRM,
            'sqlstate', SQLSTATE,
            'customer_id', p_customer_id
        );
END;
$$;

COMMENT ON FUNCTION public.apply_quarterly_interest_for_customer(uuid) IS 
'Applies 3% quarterly interest on subscription total. Idempotent per quarter.';


-- ============================================================
-- Function: apply_quarterly_interest_for_all_customers
-- Runs quarterly interest for every active customer in one call
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_quarterly_interest_for_all_customers(p_admin_uid text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer RECORD;
    v_result jsonb;
    v_admin_uid uuid := NULL;
    v_month int := EXTRACT(MONTH FROM CURRENT_DATE)::int;
    v_year  int := EXTRACT(YEAR  FROM CURRENT_DATE)::int;
    v_quarter_start date;
    v_quarter_end date;
    v_quarter_label text;
    v_success int := 0;
    v_skipped int := 0;
    v_errors int := 0;
    v_processed int := 0;
    v_details jsonb := '[]'::jsonb;
BEGIN
    IF p_admin_uid IS NOT NULL AND btrim(p_admin_uid) <> '' THEN
        IF btrim(p_admin_uid) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
            v_admin_uid := btrim(p_admin_uid)::uuid;
        END IF;
    END IF;

    IF v_month >= 4 AND v_month <= 6 THEN
        v_quarter_label := 'Q1';
        v_quarter_start := make_date(v_year, 4, 1);
        v_quarter_end   := make_date(v_year, 6, 30);
    ELSIF v_month >= 7 AND v_month <= 9 THEN
        v_quarter_label := 'Q2';
        v_quarter_start := make_date(v_year, 7, 1);
        v_quarter_end   := make_date(v_year, 9, 30);
    ELSIF v_month >= 10 AND v_month <= 12 THEN
        v_quarter_label := 'Q3';
        v_quarter_start := make_date(v_year, 10, 1);
        v_quarter_end   := make_date(v_year, 12, 31);
    ELSE
        v_quarter_label := 'Q4';
        v_quarter_start := make_date(v_year, 1, 1);
        v_quarter_end   := make_date(v_year, 3, 31);
    END IF;

    FOR v_customer IN
        SELECT id, name
        FROM public.customers
        WHERE deleted_at IS NULL
        ORDER BY name
    LOOP
        v_result := public.apply_quarterly_interest_for_customer(v_customer.id);
        v_processed := v_processed + 1;

        IF COALESCE(v_result->>'status', 'error') = 'success' THEN
            v_success := v_success + 1;
        ELSIF COALESCE(v_result->>'status', 'error') = 'skipped' THEN
            v_skipped := v_skipped + 1;
        ELSE
            v_errors := v_errors + 1;
        END IF;

        IF v_admin_uid IS NOT NULL THEN
            BEGIN
                INSERT INTO public.admin_audit_log (
                    admin_uid,
                    action,
                    entity_type,
                    entity_id,
                    metadata
                ) VALUES (
                    v_admin_uid,
                    CASE WHEN COALESCE(v_result->>'status', 'error') = 'success' THEN 'create' ELSE 'update' END,
                    'quarterly_interest_run',
                    v_customer.id,
                    jsonb_build_object(
                        'source', 'quarterly-interest-cron',
                        'actor_name', 'System Cron',
                        'actor_email', 'system-cron@internal',
                        'customer_id', v_customer.id,
                        'customer_name', v_customer.name,
                        'quarter', v_quarter_label,
                        'period_start', v_quarter_start,
                        'period_end', v_quarter_end,
                        'status', COALESCE(v_result->>'status', 'error'),
                        'reason', v_result->>'reason',
                        'interest_charged', COALESCE((v_result->>'interest_charged')::numeric, 0),
                        'subscription_total', COALESCE((v_result->>'subscription_total')::numeric, 0),
                        'error', v_result->>'error'
                    )
                );
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE '[QuarterlyInterest] Failed to write audit log for %: %', v_customer.id, SQLERRM;
            END;
        END IF;

        v_details := v_details || jsonb_build_array(
            jsonb_build_object(
                'id', v_customer.id,
                'name', v_customer.name,
                'status', COALESCE(v_result->>'status', 'error'),
                'reason', v_result->>'reason',
                'interest_charged', COALESCE((v_result->>'interest_charged')::numeric, 0),
                'subscription_total', COALESCE((v_result->>'subscription_total')::numeric, 0),
                'error', v_result->>'error'
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'completed',
        'quarter', jsonb_build_object(
            'label', v_quarter_label,
            'start', v_quarter_start,
            'end', v_quarter_end
        ),
        'timestamp', CURRENT_TIMESTAMP,
        'totals', jsonb_build_object(
            'success', v_success,
            'skipped', v_skipped,
            'errors', v_errors,
            'processed', v_processed
        ),
        'details', v_details
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'error', SQLERRM,
            'sqlstate', SQLSTATE,
            'quarter', jsonb_build_object(
                'label', v_quarter_label,
                'start', v_quarter_start,
                'end', v_quarter_end
            ),
            'totals', jsonb_build_object(
                'success', v_success,
                'skipped', v_skipped,
                'errors', v_errors,
                'processed', v_processed
            )
        );
END;
$$;

COMMENT ON FUNCTION public.apply_quarterly_interest_for_all_customers(text) IS
'Applies quarterly interest to every active customer in a single server-side batch.';


-- ============================================================
-- Function: rollback_quarterly_interest
-- Reverts the last interest application for a customer
-- ============================================================

CREATE OR REPLACE FUNCTION public.rollback_quarterly_interest(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ledger RECORD;
BEGIN
    -- Get the most recent ledger entry
    SELECT * INTO v_ledger
    FROM public.interest_ledger
    WHERE customer_id = p_customer_id
    ORDER BY applied_at DESC
    LIMIT 1;
    
    IF v_ledger.id IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'error', 'No ledger entry found to rollback',
            'customer_id', p_customer_id
        );
    END IF;
    -- Subtract from customer_interest
    UPDATE public.customer_interest
    SET total_interest_charged = GREATEST(0, total_interest_charged - v_ledger.interest_amount),
        last_applied_quarter = (
            SELECT period_start 
            FROM public.interest_ledger 
            WHERE customer_id = p_customer_id AND id != v_ledger.id
            ORDER BY applied_at DESC 
            LIMIT 1
        ),
        updated_at = now()
    WHERE customer_id = p_customer_id;
    
    -- Delete ledger entry
    DELETE FROM public.interest_ledger WHERE id = v_ledger.id;    DELETE FROM public.interest_ledger WHERE id = v_ledger.id;
    
    RETURN jsonb_build_object(
        'status', 'rolled_back',
        'customer_id', p_customer_id,
        'reverted_interest', v_ledger.interest_amount,
        'period_start', v_ledger.period_start,
        'period_end', v_ledger.period_end,
        'deleted_ledger_id', v_ledger.id
    );
END;
$$;

COMMENT ON FUNCTION public.rollback_quarterly_interest(uuid) IS 
'Reverts the most recent quarterly interest application for a customer.';
