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
