-- Add retired eligibility flag for quarterly interest exclusion.
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS is_retired boolean;

-- Backfill existing rows safely before enforcing constraints.
UPDATE public.customers
SET is_retired = false
WHERE is_retired IS NULL;

ALTER TABLE public.customers
ALTER COLUMN is_retired SET DEFAULT false;

ALTER TABLE public.customers
ALTER COLUMN is_retired SET NOT NULL;

COMMENT ON COLUMN public.customers.is_retired IS
'When true, customer is retired and excluded from quarterly interest eligibility.';
