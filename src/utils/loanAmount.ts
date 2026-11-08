import type { Subscription } from "../types";

export const getLastSubscription = (
  subscriptions: Subscription[],
  customerId: string,
): Subscription | null => {
  return subscriptions
    .filter((subscription) => subscription.customer_id === customerId)
    .sort((a, b) => {
      const dateDifference =
        new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDifference !== 0) return dateDifference;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    })[0] ?? null;
};

export const getRequestedLoanAmount = (
  subscriptions: Subscription[],
  customerId: string,
): number => {
  const lastSubscription = getLastSubscription(subscriptions, customerId);
  return Number(lastSubscription?.amount || 0) * 100;
};
