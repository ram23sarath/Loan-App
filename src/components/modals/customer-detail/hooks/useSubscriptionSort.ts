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

const compareCustomerNames = (aName?: string | null, bName?: string | null) =>
  (aName || "").localeCompare(bName || "", undefined, {
    sensitivity: "base",
  });

const compareReceiptValues = (aReceipt?: string | null, bReceipt?: string | null) => {
  const normalizeReceipt = (receipt?: string | null) => {
    const raw = (receipt || "").trim();
    const match = raw.match(/^(\d+)(.*)$/);

    if (!match) {
      return {
        hasNumericPrefix: false,
        numberPart: Number.POSITIVE_INFINITY,
        suffixPart: raw,
        raw,
      };
    }

    return {
      hasNumericPrefix: true,
      numberPart: Number(match[1]),
      suffixPart: match[2].trim(),
      raw,
    };
  };

  const aKey = normalizeReceipt(aReceipt);
  const bKey = normalizeReceipt(bReceipt);

  if (aKey.hasNumericPrefix && bKey.hasNumericPrefix && aKey.numberPart !== bKey.numberPart) {
    return aKey.numberPart - bKey.numberPart;
  }

  if (aKey.hasNumericPrefix !== bKey.hasNumericPrefix) {
    return aKey.hasNumericPrefix ? -1 : 1;
  }

  const suffixCompare = aKey.suffixPart.localeCompare(bKey.suffixPart, undefined, {
    numeric: true,
    sensitivity: "base",
  });

  if (suffixCompare !== 0) {
    return suffixCompare;
  }

  return aKey.raw.localeCompare(bKey.raw, undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

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
        compareValue = compareReceiptValues(a.receipt, b.receipt);

        if (compareValue === 0) {
          compareValue = compareCustomerNames(a.customers?.name, b.customers?.name);
        }
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
