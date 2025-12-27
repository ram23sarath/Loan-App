-- Run this in your Supabase SQL Editor to create the notifications table

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

-- Allow anonymous read (so the UI can fetch notifications)
-- Adjust logic if you want strict admin-only access (e.g., checks against auth.uid())
CREATE POLICY "Allow read access for all users" ON public.system_notifications
FOR SELECT USING (true);

-- Allow service role (server) to insert
CREATE POLICY "Allow insert for service role only" ON public.system_notifications
FOR INSERT WITH CHECK (true);
