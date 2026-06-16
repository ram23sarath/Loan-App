import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_TEMPLATE_NAME =
  process.env.WHATSAPP_INSTALLMENT_TEMPLATE_NAME || 'installment_payment_recorded';
const WHATSAPP_TEMPLATE_LANGUAGE =
  process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en';
const WHATSAPP_GRAPH_API_VERSION =
  process.env.WHATSAPP_GRAPH_API_VERSION || 'v20.0';
const DEFAULT_COUNTRY_CODE = (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91').replace(/\D+/g, '');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

const jsonResponse = (statusCode, body) =>
  new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  });

const normalizeUuid = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  return UUID_REGEX.test(trimmed) ? trimmed : null;
};

const formatCurrencyIN = (value) => {
  const n = Number(value || 0);
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n);
  } catch {
    return `INR ${n}`;
  }
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${date.getFullYear()}`;
};

const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D+/g, '');
  if (!digits) return null;
  const withCountryCode =
    digits.length === 10 && DEFAULT_COUNTRY_CODE ? `${DEFAULT_COUNTRY_CODE}${digits}` : digits;
  return withCountryCode.length >= 11 && withCountryCode.length <= 15 ? withCountryCode : null;
};

const getBearerToken = (req) => {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
};

const assertAdminCaller = async (supabase, req) => {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: 'Missing authorization token' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return { ok: false, status: 401, error: 'Invalid authorization token' };
  }

  const { data: customerRows, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('user_id', userData.user.id)
    .limit(1);

  if (customerError) {
    return { ok: false, status: 500, error: 'Unable to verify caller permissions' };
  }

  if (customerRows && customerRows.length > 0) {
    return { ok: false, status: 403, error: 'Scoped customers cannot send WhatsApp messages' };
  }

  return { ok: true, user: userData.user };
};

const fetchInstallmentContext = async (supabase, installmentId) => {
  const { data: installment, error: installmentError } = await supabase
    .from('installments')
    .select('*')
    .eq('id', installmentId)
    .is('deleted_at', null)
    .single();

  if (installmentError || !installment) {
    throw new Error('Installment not found');
  }

  const { data: loan, error: loanError } = await supabase
    .from('loans')
    .select('id, customer_id')
    .eq('id', installment.loan_id)
    .is('deleted_at', null)
    .single();

  if (loanError || !loan) {
    throw new Error('Loan not found for installment');
  }

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, name, phone')
    .eq('id', loan.customer_id)
    .is('deleted_at', null)
    .single();

  if (customerError || !customer) {
    throw new Error('Customer not found for installment');
  }

  return { installment, loan, customer };
};

const upsertPendingLog = async (supabase, context, phone) => {
  const { installment, customer } = context;

  const { data: existing, error: existingError } = await supabase
    .from('whatsapp_message_log')
    .select('*')
    .eq('installment_id', installment.id)
    .eq('template_name', WHATSAPP_TEMPLATE_NAME)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.status === 'sent') {
    return { log: existing, duplicate: true };
  }

  if (existing) {
    const { data, error } = await supabase
      .from('whatsapp_message_log')
      .update({
        status: 'pending',
        phone,
        customer_id: customer.id,
        template_language: WHATSAPP_TEMPLATE_LANGUAGE,
        error_message: null,
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return { log: data, duplicate: false };
  }

  const { data, error } = await supabase
    .from('whatsapp_message_log')
    .insert({
      installment_id: installment.id,
      customer_id: customer.id,
      phone,
      template_name: WHATSAPP_TEMPLATE_NAME,
      template_language: WHATSAPP_TEMPLATE_LANGUAGE,
      status: 'pending',
      metadata: {
        source: 'send-installment-whatsapp',
        installment_number: installment.installment_number,
      },
    })
    .select()
    .single();

  if (error) throw error;
  return { log: data, duplicate: false };
};

const updateLog = async (supabase, logId, updates) => {
  const { error } = await supabase
    .from('whatsapp_message_log')
    .update({
      ...updates,
      last_attempt_at: new Date().toISOString(),
    })
    .eq('id', logId);

  if (error) {
    console.error('[WhatsApp] Failed to update message log:', error.message || error);
  }
};

const buildTemplateComponents = ({ installment, customer }) => [
  {
    type: 'body',
    parameters: [
      { type: 'text', text: customer.name || 'Customer' },
      { type: 'text', text: formatCurrencyIN(installment.amount) },
      { type: 'text', text: String(installment.installment_number) },
      { type: 'text', text: formatDate(installment.date) },
      { type: 'text', text: installment.receipt_number || '-' },
      { type: 'text', text: formatCurrencyIN(installment.late_fee || 0) },
    ],
  },
];

const sendWhatsAppTemplate = async (phone, context) => {
  const url = `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: WHATSAPP_TEMPLATE_NAME,
        language: { code: WHATSAPP_TEMPLATE_LANGUAGE },
        components: buildTemplateComponents(context),
      },
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body?.error?.message ||
      body?.error?.error_user_msg ||
      `WhatsApp API request failed with status ${response.status}`;
    const error = new Error(message);
    error.details = body;
    throw error;
  }

  return body;
};

export default async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed' });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'Missing Supabase server configuration' });
  }

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return jsonResponse(500, { error: 'Missing WhatsApp server configuration' });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const caller = await assertAdminCaller(supabase, req);
  if (!caller.ok) {
    return jsonResponse(caller.status, { error: caller.error });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const installmentId = normalizeUuid(payload?.installment_id);
  if (!installmentId) {
    return jsonResponse(400, { error: 'Missing or invalid installment_id' });
  }

  let context;
  let phone;
  let log;

  try {
    context = await fetchInstallmentContext(supabase, installmentId);
    phone = normalizePhone(context.customer.phone);

    if (!phone) {
      const { data: existing } = await supabase
        .from('whatsapp_message_log')
        .select('id')
        .eq('installment_id', context.installment.id)
        .eq('template_name', WHATSAPP_TEMPLATE_NAME)
        .maybeSingle();

      const skippedPayload = {
        customer_id: context.customer.id,
        phone: context.customer.phone || '',
        template_name: WHATSAPP_TEMPLATE_NAME,
        template_language: WHATSAPP_TEMPLATE_LANGUAGE,
        status: 'skipped',
        error_message: 'Invalid customer WhatsApp phone number',
        metadata: { source: 'send-installment-whatsapp' },
      };

      const query = existing?.id
        ? supabase
            .from('whatsapp_message_log')
            .update(skippedPayload)
            .eq('id', existing.id)
            .select()
            .single()
        : supabase
        .from('whatsapp_message_log')
        .insert({
          ...skippedPayload,
          installment_id: context.installment.id,
        })
        .select()
        .single();

      const { data } = await query;
      return jsonResponse(200, {
        status: 'skipped',
        log_id: data?.id || null,
        error: 'Invalid customer WhatsApp phone number',
      });
    }

    const pending = await upsertPendingLog(supabase, context, phone);
    log = pending.log;

    if (pending.duplicate) {
      return jsonResponse(200, {
        status: 'already_sent',
        log_id: log.id,
        message_id: log.message_id,
      });
    }
  } catch (error) {
    console.error('[WhatsApp] Preparation failed:', error);
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Failed to prepare WhatsApp message',
    });
  }

  try {
    const whatsappResponse = await sendWhatsAppTemplate(phone, context);
    const messageId = whatsappResponse?.messages?.[0]?.id || null;

    await updateLog(supabase, log.id, {
      status: 'sent',
      message_id: messageId,
      error_message: null,
      attempt_count: Number(log.attempt_count || 0) + 1,
      metadata: {
        ...(log.metadata || {}),
        whatsapp_response: whatsappResponse,
      },
    });

    return jsonResponse(200, {
      status: 'sent',
      log_id: log.id,
      message_id: messageId,
    });
  } catch (error) {
    console.error('[WhatsApp] Send failed:', error);
    await updateLog(supabase, log.id, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'WhatsApp send failed',
      attempt_count: Number(log.attempt_count || 0) + 1,
      metadata: {
        ...(log.metadata || {}),
        error_details: error?.details || null,
      },
    });

    return jsonResponse(502, {
      error: error instanceof Error ? error.message : 'WhatsApp send failed',
      log_id: log.id,
    });
  }
};
