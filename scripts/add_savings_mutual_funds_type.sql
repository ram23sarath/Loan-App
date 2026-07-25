-- SQL migration script to update data_entries check constraints in Supabase / Postgres
-- to support 'savings' as a valid transaction type alongside 'credit', 'debit', 'expense', 'expenditure'.

-- 1. Update check constraint if present on public.data_entries
ALTER TABLE public.data_entries 
  DROP CONSTRAINT IF EXISTS data_entries_type_check;

ALTER TABLE public.data_entries 
  ADD CONSTRAINT data_entries_type_check 
  CHECK (type IN ('credit', 'debit', 'expense', 'expenditure', 'savings'));

-- 2. Index for performant querying of savings and mutual funds entries
CREATE INDEX IF NOT EXISTS idx_data_entries_savings 
  ON public.data_entries(type, subtype) 
  WHERE deleted_at IS NULL;

-- 3. Comment explaining the Savings / Mutual Funds classification
COMMENT ON CONSTRAINT data_entries_type_check ON public.data_entries IS 
  'Allows credit, debit, expense, expenditure, and savings transaction types.';
