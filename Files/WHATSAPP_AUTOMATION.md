# WhatsApp Installment Automation

This feature sends an approved WhatsApp template automatically after an admin records a loan installment.

## 1. Supabase setup

Run this SQL file in the Supabase SQL editor:

```text
Files/whatsapp_message_log.sql
```

It creates `public.whatsapp_message_log`, which tracks `pending`, `sent`, `failed`, and `skipped` send states. It also prevents duplicate successful sends for the same installment and template.

## 2. Netlify environment variables

Add these in Netlify under Site configuration -> Environment variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_INSTALLMENT_TEMPLATE_NAME=installment_payment_recorded
WHATSAPP_TEMPLATE_LANGUAGE=en
WHATSAPP_GRAPH_API_VERSION=v20.0
WHATSAPP_DEFAULT_COUNTRY_CODE=91
```

Keep `WHATSAPP_ACCESS_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` server-only. Do not add them as `VITE_` variables.

## 3. WhatsApp template

Template name:

```text
installment_payment_recorded
```

Category:

```text
Utility
```

Body:

```text
Hi {{1}}, your installment payment of {{2}} (Installment #{{3}}) has been recorded on {{4}}. Receipt: {{5}}. Late fee: {{6}}. Thank You, I J Reddy.
```

Parameter mapping:

```text
{{1}} Customer name
{{2}} Installment amount
{{3}} Installment number
{{4}} Installment date
{{5}} Receipt number
{{6}} Late fee amount, or INR 0
```

## 4. App flow

When an installment is saved, the browser sends only the `installment_id` to `/.netlify/functions/send-installment-whatsapp`. The Netlify function fetches the installment, loan, and customer with the service role key, sends the template through WhatsApp Cloud API, and updates `whatsapp_message_log`.

If WhatsApp sending fails, the installment still remains saved.
