/**
 * Utility configuration helpers.
 */

// Read comma-separated customer IDs for whom Savings (Mutual Funds) option is enabled.
const rawSavingsCustomerIds = import.meta.env.VITE_SAVINGS_ENABLED_CUSTOMER_IDS || "";
const savingsCustomerIdsSet = new Set(
  rawSavingsCustomerIds
    .split(",")
    .map((id: string) => id.trim().toLowerCase())
    .filter(Boolean)
);

/**
 * Checks if the Savings (Mutual Funds) feature is enabled for a given customer ID.
 * Returns true if the customer ID is listed in VITE_SAVINGS_ENABLED_CUSTOMER_IDS environment variable.
 */
export const isSavingsEnabledForCustomer = (customerId?: string | null): boolean => {
  if (!customerId) return false;
  return savingsCustomerIdsSet.has(customerId.trim().toLowerCase());
};
