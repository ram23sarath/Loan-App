// Small helper utilities for building and opening WhatsApp URLs safely
// - sanitizePhone removes non-digit characters
// - buildWhatsAppUrl constructs a wa.me URL (falls back to api.whatsapp.com format if needed)
// - openWhatsApp opens the link using a safe anchor click and prevents rapid repeated opens

export const sanitizePhone = (phone?: string | null): string | null => {
  if (!phone) return null;
  // remove spaces, plus signs, dashes, parentheses and other non-digit characters
  const digits = phone.replace(/\D+/g, "");
  // basic validation: whatsapp expects between ~10 and 15 digits (country code + number)
  if (digits.length < 8 || digits.length > 16) return null;
  return digits;
};

export const buildWhatsAppUrl = (phone: string, message: string) => {
  const s = sanitizePhone(phone);
  if (!s) return null;
  try {
    return `https://wa.me/${s}?text=${encodeURIComponent(message)}`;
  } catch (err) {
    // fallback to web API style
    return `https://api.whatsapp.com/send?phone=${s}&text=${encodeURIComponent(
      message
    )}`;
  }
};

// Simple cooldown map to prevent multiple rapid opens which may trigger rate limits.
const lastOpened: Map<string, number> = new Map();
const GLOBAL_KEY = "__GLOBAL__";

export const openWhatsApp = (
  phone: string | undefined | null,
  message: string,
  opts?: { cooldownMs?: number }
): boolean => {
  const cooldownMs = opts?.cooldownMs ?? 1200;
  const s = sanitizePhone(phone);
  if (!s) return false;

  const key = s || GLOBAL_KEY;
  const now = Date.now();
  const last = lastOpened.get(key) ?? 0;
  if (now - last < cooldownMs) {
    // too soon
    return false;
  }
  lastOpened.set(key, now);

  const url = buildWhatsAppUrl(s, message);
  if (!url) return false;

  // open using an anchor with rel noopener to avoid some cross-origin issues
  try {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch (err) {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    } catch (e) {
      return false;
    }
  }
};
