-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.system_notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    type text NOT NULL,
    status text NOT NULL,
    message text NOT NULL,
    metadata jsonb
);

-- Enable RLS
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

-- 1. READ: Allow Admins Only
DROP POLICY IF EXISTS "Allow read access for all users" ON public.system_notifications;
DROP POLICY IF EXISTS "Allow read access for admins only" ON public.system_notifications;
CREATE POLICY "Allow read access for admins only" ON public.system_notifications
FOR SELECT USING (
  auth.role() = 'authenticated' AND
  NOT EXISTS (SELECT 1 FROM public.customers WHERE user_id = auth.uid())
);

-- 2. INSERT: Allow Authenticated Users (so customers can request seniority)
DROP POLICY IF EXISTS "Allow insert for service role only" ON public.system_notifications;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.system_notifications;
CREATE POLICY "Allow insert for authenticated users" ON public.system_notifications
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. DELETE: Allow ADMINS only
DROP POLICY IF EXISTS "Allow delete for admins only" ON public.system_notifications;
CREATE POLICY "Allow delete for admins only" ON public.system_notifications
FOR DELETE
USING (
  auth.role() = 'authenticated' AND
  NOT EXISTS (SELECT 1 FROM public.customers WHERE user_id = auth.uid())
);
