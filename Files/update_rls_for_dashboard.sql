-- Allow Authenticated Users (Customers) to VIEW ALL data in main tables
-- This ensures the "Summary Dashboard" calculates global totals correctly for everyone.

-- 1. LOANS
DROP POLICY IF EXISTS "Allow read access for all users" ON public.loans;
DROP POLICY IF EXISTS "Allow read access for admins only" ON public.loans;
CREATE POLICY "Allow read access for all users" ON public.loans
FOR SELECT USING (auth.role() = 'authenticated');

-- 2. INSTALLMENTS
DROP POLICY IF EXISTS "Allow read access for all users" ON public.installments;
DROP POLICY IF EXISTS "Allow read access for admins only" ON public.installments;
CREATE POLICY "Allow read access for all users" ON public.installments
FOR SELECT USING (auth.role() = 'authenticated');

-- 3. SUBSCRIPTIONS
DROP POLICY IF EXISTS "Allow read access for all users" ON public.subscriptions;
DROP POLICY IF EXISTS "Allow read access for admins only" ON public.subscriptions;
CREATE POLICY "Allow read access for all users" ON public.subscriptions
FOR SELECT USING (auth.role() = 'authenticated');

-- 4. CUSTOMERS (Needed to see names in breakdown, if used)
DROP POLICY IF EXISTS "Allow read access for all users" ON public.customers;
DROP POLICY IF EXISTS "Allow read access for admins only" ON public.customers;
CREATE POLICY "Allow read access for all users" ON public.customers
FOR SELECT USING (auth.role() = 'authenticated');

-- 5. DATA ENTRIES (Already seems open, but ensuring consistency)
DROP POLICY IF EXISTS "Allow read access for all users" ON public.data_entries;
DROP POLICY IF EXISTS "Allow read access for admins only" ON public.data_entries;
CREATE POLICY "Allow read access for all users" ON public.data_entries
FOR SELECT USING (auth.role() = 'authenticated');
