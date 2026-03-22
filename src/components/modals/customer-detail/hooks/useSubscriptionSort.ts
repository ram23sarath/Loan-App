import { useMemo, useState } from "react";
import type { SubscriptionWithCustomer } from "../../../../types";

export type SubscriptionSortBy = "date" | "receipt" | "amount";
export type SubscriptionSortOrder = "asc" | "desc";

interface UseSubscriptionSortResult {
  subscriptionSortBy: SubscriptionSortBy;
  subscriptionSortOrder: SubscriptionSortOrder;
  sortedSubscriptions: SubscriptionWithCustomer[];
  toggleDateSort: () => void;
  toggleAmountSort: () => void;
  toggleReceiptSort: () => void;
}

export const useSubscriptionSort = (
  subscriptions: SubscriptionWithCustomer[],
): UseSubscriptionSortResult => {
  const [subscriptionSortBy, setSubscriptionSortBy] =
    useState<SubscriptionSortBy>("date");
  const [subscriptionSortOrder, setSubscriptionSortOrder] =
    useState<SubscriptionSortOrder>("desc");

  const sortedSubscriptions = useMemo(() => {
    const sorted = [...subscriptions];

    sorted.sort((a, b) => {
      let compareValue = 0;

      if (subscriptionSortBy === "date") {
        compareValue = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (subscriptionSortBy === "receipt") {
        const receiptA = a.receipt || "";
        const receiptB = b.receipt || "";
        compareValue = receiptA.localeCompare(receiptB);
      } else {
        compareValue = a.amount - b.amount;
      }

      return subscriptionSortOrder === "desc" ? -compareValue : compareValue;
    });

    return sorted;
  }, [subscriptions, subscriptionSortBy, subscriptionSortOrder]);

  const toggleDateSort = () => {
    if (subscriptionSortBy === "date") {
      setSubscriptionSortOrder(subscriptionSortOrder === "asc" ? "desc" : "asc");
      return;
    }

    setSubscriptionSortBy("date");
    setSubscriptionSortOrder("desc");
  };

  const toggleAmountSort = () => {
    if (subscriptionSortBy === "amount") {
      setSubscriptionSortOrder(subscriptionSortOrder === "asc" ? "desc" : "asc");
      return;
    }

    setSubscriptionSortBy("amount");
    setSubscriptionSortOrder("asc");
  };

  const toggleReceiptSort = () => {
    if (subscriptionSortBy === "receipt") {
      setSubscriptionSortOrder(subscriptionSortOrder === "asc" ? "desc" : "asc");
      return;
    }

    setSubscriptionSortBy("receipt");
    setSubscriptionSortOrder("asc");
  };

  return {
    subscriptionSortBy,
    subscriptionSortOrder,
    sortedSubscriptions,
    toggleDateSort,
    toggleAmountSort,
    toggleReceiptSort,
  };
};
