-- Manual migration: WhatsApp installment message tracking
--
-- Run this in the Supabase SQL editor before enabling automatic WhatsApp sends.
-- It records one send attempt stream per installment and prevents duplicate
-- successful installment notifications.

CREATE TABLE IF NOT EXISTS public.whatsapp_message_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    installment_id uuid NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    phone text NOT NULL,
    template_name text NOT NULL,
    template_language text NOT NULL DEFAULT 'en',
    status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    message_id text,
    error_message text,
    attempt_count integer NOT NULL DEFAULT 0,
    last_attempt_at timestamptz,
    metadata jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_message_log_installment_template_unique
    ON public.whatsapp_message_log (installment_id, template_name);

CREATE INDEX IF NOT EXISTS whatsapp_message_log_status_idx
    ON public.whatsapp_message_log (status);

CREATE INDEX IF NOT EXISTS whatsapp_message_log_created_at_idx
    ON public.whatsapp_message_log (created_at DESC);

CREATE OR REPLACE FUNCTION public.set_whatsapp_message_log_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_whatsapp_message_log_updated_at
ON public.whatsapp_message_log;

CREATE TRIGGER set_whatsapp_message_log_updated_at
BEFORE UPDATE ON public.whatsapp_message_log
FOR EACH ROW
EXECUTE FUNCTION public.set_whatsapp_message_log_updated_at();

ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read whatsapp message log" ON public.whatsapp_message_log;
CREATE POLICY "Admins can read whatsapp message log"
ON public.whatsapp_message_log
FOR SELECT
USING (
  auth.role() = 'authenticated' AND
  NOT EXISTS (SELECT 1 FROM public.customers WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Service role can manage whatsapp message log" ON public.whatsapp_message_log;
CREATE POLICY "Service role can manage whatsapp message log"
ON public.whatsapp_message_log
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON public.whatsapp_message_log TO authenticated;
