# Quarterly Interest — Rollback & Backup Plan

> **Important**: All rollback operations only affect interest-related data (`customer_interest` and `interest_ledger` tables). Original loans, subscriptions, installments, data entries, and customer records are **never modified or deleted**.

---

## How It Works

- A **Netlify scheduled function** (`quarterly-interest-cron.js`) runs at **18:30 UTC on the 1st** (00:00 IST on the 2nd) of each FY quarter month — April, July, October, January.
- It calls the Supabase function `apply_quarterly_interest_for_customer(uuid)` for each active customer.
- The function calculates 3% interest on each customer's total subscription amount and:
  - Upserts the running total in `customer_interest`
  - Inserts an audit row in `interest_ledger`
- **Idempotent**: Re-running for the same quarter is safe — duplicates are skipped via a unique constraint on `(customer_id, period_start)`.

### FY Quarter Schedule

| Quarter | Months    | Cron Fires (UTC / IST)            |
| ------- | --------- | --------------------------------- |
| Q1      | Apr – Jun | April 1 @ 18:30 / April 2 @ 00:00 |
| Q2      | Jul – Sep | July 1 @ 18:30 / July 2 @ 00:00   |
| Q3      | Oct – Dec | Oct 1 @ 18:30 / Oct 2 @ 00:00     |
| Q4      | Jan – Mar | Jan 1 @ 18:30 / Jan 2 @ 00:00     |

---

## Tables Affected

| Table               | What's stored                              | Affected by rollback?   |
| ------------------- | ------------------------------------------ | ----------------------- |
| `customer_interest` | Running total of interest per customer     | ✅ Yes (reduced/zeroed) |
| `interest_ledger`   | Audit trail — one row per customer/quarter | ✅ Yes (rows deleted)   |
| `loans`             | Loan records                               | ❌ Never touched        |
| `subscriptions`     | Subscription records                       | ❌ Never touched        |
| `installments`      | Installment payments                       | ❌ Never touched        |
| `data_entries`      | Income/expense entries                     | ❌ Never touched        |
| `customers`         | Customer master records                    | ❌ Never touched        |

---

## Rollback Scenarios

### 1. Rollback Last Quarter for a Single Customer

Use the built-in `rollback_quarterly_interest` function:

```sql
-- Replace with the actual customer ID
SELECT public.rollback_quarterly_interest('CUSTOMER_UUID_HERE');
```

This will:

- Subtract the last quarter's interest from `customer_interest.total_interest_charged`
- Delete the corresponding `interest_ledger` row
- Return a JSON summary of what was reverted

### 2. Rollback Last Quarter for ALL Customers

```sql
DO $$
DECLARE
    rec RECORD;
    result jsonb;
    rolled_back int := 0;
BEGIN
    -- Find all ledger entries from the most recent quarter
    FOR rec IN
        SELECT DISTINCT customer_id
        FROM public.interest_ledger
        WHERE period_start = (SELECT MAX(period_start) FROM public.interest_ledger)
    LOOP
        SELECT public.rollback_quarterly_interest(rec.customer_id) INTO result;
        RAISE NOTICE '%', result;
        rolled_back := rolled_back + 1;
    END LOOP;

    RAISE NOTICE 'Rolled back % customers', rolled_back;
END;
$$;
```

### 3. Rollback a SPECIFIC Quarter (by date)

Use this version when you want to undo one quarter across all impacted customers. It aggregates ledger rows per customer first, so each customer is updated once even if multiple ledger rows exist for that period. This version also adds integrity, consistency, transaction, negative-balance, and concurrency checks.

```sql
DO $$
DECLARE
    v_target_start   date := DATE '2026-01-01';  -- Change to the quarter start you want to undo
    v_row_count      int;
    v_customer_count int;
    v_missing_customer_count int;
    v_negative_customer_count int;
    v_updated_count  int;
    v_deleted_count  int;
BEGIN
    -- Concurrency guard: choose a stricter lock in maintenance-only environments if you need a harder write freeze.
    -- SHARE ROW EXCLUSIVE blocks concurrent writes to the ledger while keeping reads available.
    LOCK TABLE public.interest_ledger IN SHARE ROW EXCLUSIVE MODE;
    LOCK TABLE public.customer_interest IN ROW EXCLUSIVE MODE;

    SELECT
        COUNT(*),
        COUNT(DISTINCT customer_id)
    INTO
        v_row_count,
        v_customer_count
    FROM public.interest_ledger
    WHERE period_start = v_target_start;

    IF v_row_count = 0 THEN
        RAISE EXCEPTION 'No interest ledger rows found for period starting %', v_target_start;
    END IF;

    -- Integrity guard: fail fast if any ledger customer has no matching customer_interest row.
    SELECT COUNT(*)
    INTO v_missing_customer_count
    FROM (
        SELECT DISTINCT il.customer_id
        FROM public.interest_ledger il
        LEFT JOIN public.customer_interest ci ON ci.customer_id = il.customer_id
        WHERE il.period_start = v_target_start
          AND ci.customer_id IS NULL
    ) missing_customers;

    IF v_missing_customer_count > 0 THEN
        RAISE EXCEPTION
            'Rollback aborted: % customers have interest_ledger rows for period starting % but no matching customer_interest row',
            v_missing_customer_count,
            v_target_start;
    END IF;

    -- Negative-balance guard: abort instead of silently clamping with GREATEST(..., 0).
    SELECT COUNT(*)
    INTO v_negative_customer_count
    FROM public.customer_interest ci
    JOIN (
        SELECT
            customer_id,
            SUM(interest_amount) AS total_interest_amount
        FROM public.interest_ledger
        WHERE period_start = v_target_start
        GROUP BY customer_id
    ) r ON r.customer_id = ci.customer_id
    WHERE ci.total_interest_charged < r.total_interest_amount;

    IF v_negative_customer_count > 0 THEN
        RAISE EXCEPTION
            'Rollback aborted: % customers would go negative when reversing period starting %',
            v_negative_customer_count,
            v_target_start;
    END IF;

    WITH rolled_up AS (
        SELECT
            customer_id,
            SUM(interest_amount) AS total_interest_amount
        FROM public.interest_ledger
        WHERE period_start = v_target_start
        GROUP BY customer_id
    )
    UPDATE public.customer_interest ci
    SET
        total_interest_charged = ci.total_interest_charged - r.total_interest_amount,
        updated_at = now()
    FROM rolled_up r
    WHERE ci.customer_id = r.customer_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    DELETE FROM public.interest_ledger
    WHERE period_start = v_target_start;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    -- Consistency check: the number of updated customer rows and deleted ledger rows must match expectations.
    IF v_updated_count <> v_customer_count THEN
        RAISE EXCEPTION
            'Consistency check failed: expected % customer_interest rows to update, but updated %',
            v_customer_count,
            v_updated_count;
    END IF;

    IF v_deleted_count <> v_row_count THEN
        RAISE EXCEPTION
            'Consistency check failed: expected % interest_ledger rows to delete, but deleted %',
            v_row_count,
            v_deleted_count;
    END IF;

    RAISE NOTICE
        'Rolled back % ledger rows across % customers; updated % customer_interest rows; deleted % ledger rows for period starting %',
        v_row_count,
        v_customer_count,
        v_updated_count,
        v_deleted_count,
        v_target_start;
END;
$$;
```

Customer impact for this rollback is the number of distinct customers in `interest_ledger` for the chosen `period_start`. It does not affect customers outside that quarter.

Transaction note: if any check fails, the block raises an exception and the rollback is aborted as one atomic statement.

### 4. Full Nuclear Reset — Remove ALL Interest Data

> ⚠️ This erases all interest history. Loans, subscriptions, and other data are untouched.

```sql
-- Step 1: Clear all ledger audit entries
DELETE FROM public.interest_ledger;

-- Step 2: Reset all customer interest totals to zero
UPDATE public.customer_interest
SET total_interest_charged = 0,
    last_applied_quarter = NULL,
    updated_at = now();

-- Verify
SELECT count(*) AS remaining_ledger_rows FROM public.interest_ledger;
SELECT customer_id, total_interest_charged FROM public.customer_interest;
```

---

## Verification Queries

### Check current interest state for all customers

```sql
SELECT
    c.name,
    c.phone,
    ci.total_interest_charged,
    ci.last_applied_quarter,
    ci.updated_at
FROM public.customer_interest ci
JOIN public.customers c ON c.id = ci.customer_id
ORDER BY ci.total_interest_charged DESC;
```

### View full interest ledger (audit trail)

```sql
SELECT
    c.name,
    il.interest_amount,
    il.subscription_total_used,
    il.interest_rate_pct,
    il.period_start,
    il.period_end,
    il.applied_at
FROM public.interest_ledger il
JOIN public.customers c ON c.id = il.customer_id
ORDER BY il.period_start DESC, c.name;
```

### Check which quarters have been processed

```sql
SELECT
    period_start,
    period_end,
    count(*) AS customers_processed,
    sum(interest_amount) AS total_interest
FROM public.interest_ledger
GROUP BY period_start, period_end
ORDER BY period_start DESC;
```

---

## Disabling the Cron

To **temporarily stop** the scheduled function without deleting it:

1. Go to **Netlify Dashboard → Functions → quarterly-interest-cron**
2. The schedule is configured in the function's `config.schedule` export
3. To disable: comment out the export in `netlify/functions/quarterly-interest-cron.js`:
   ```js
   // export const config = {
   //   schedule: "30 18 1 1,4,7,10 *",
   // };
   ```
4. Redeploy — the function will still exist but won't run on schedule

To **permanently remove**: delete the file `netlify/functions/quarterly-interest-cron.js` and redeploy.

---

## Re-running Manually

If the cron missed a run or you need to trigger it manually:

**Option A — Via Netlify:**
Hit the function URL directly (it's idempotent):

```
POST https://your-site.netlify.app/.netlify/functions/quarterly-interest-cron
```

**Option B — Via Supabase SQL Editor:**

```sql
-- Run for all active customers
DO $$
DECLARE
    rec RECORD;
    result jsonb;
BEGIN
    FOR rec IN SELECT id, name FROM public.customers WHERE deleted_at IS NULL
    LOOP
        SELECT public.apply_quarterly_interest_for_customer(rec.id) INTO result;
        RAISE NOTICE '%: %', rec.name, result;
    END LOOP;
END;
$$;
```
