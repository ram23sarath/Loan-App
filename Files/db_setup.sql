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

-- Per-admin read state for notifications (replaces global delete behavior)
CREATE TABLE IF NOT EXISTS public.notification_reads (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    notification_id uuid NOT NULL REFERENCES public.system_notifications(id) ON DELETE CASCADE,
    read_at timestamptz DEFAULT now(),
    UNIQUE (user_id, notification_id)
);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admin read own notification_reads" ON public.notification_reads;
CREATE POLICY "Allow admin read own notification_reads" ON public.notification_reads
FOR SELECT USING (
  auth.role() = 'authenticated' AND
  auth.uid() = user_id AND
  NOT EXISTS (SELECT 1 FROM public.customers WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Allow admin insert own notification_reads" ON public.notification_reads;
CREATE POLICY "Allow admin insert own notification_reads" ON public.notification_reads
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND
  auth.uid() = user_id AND
  NOT EXISTS (SELECT 1 FROM public.customers WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Allow admin delete own notification_reads" ON public.notification_reads;
CREATE POLICY "Allow admin delete own notification_reads" ON public.notification_reads
FOR DELETE USING (
  auth.role() = 'authenticated' AND
  auth.uid() = user_id AND
  NOT EXISTS (SELECT 1 FROM public.customers WHERE user_id = auth.uid())
);
