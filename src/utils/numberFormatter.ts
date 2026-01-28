export function formatNumberIndian(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  const n = Number(value);
  try {
    const isInteger = Math.abs(n - Math.round(n)) < 1e-9;
    const opts: Intl.NumberFormatOptions = {
      maximumFractionDigits: isInteger ? 0 : 2,
      minimumFractionDigits: 0,
    };
    return new Intl.NumberFormat('en-IN', opts).format(n);
  } catch (e) {
    return String(value ?? 0);
  }
}

export function formatCurrencyIN(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '₹0';
  const n = Number(value);
  try {
    const isInteger = Math.abs(n - Math.round(n)) < 1e-9;
    const opts: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: isInteger ? 0 : 2,
      maximumFractionDigits: isInteger ? 0 : 2,
    };
    return new Intl.NumberFormat('en-IN', opts).format(n);
  } catch (e) {
    return `₹${value}`;
  }
}
