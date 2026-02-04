import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";
import type {
  Customer,
  Loan,
  Subscription,
  Installment,
  NewCustomer,
  NewLoan,
  NewSubscription,
  NewInstallment,
  LoanWithCustomer,
  SubscriptionWithCustomer,
  DataEntry,
  NewDataEntry,
} from "../types";
import { checkAndNotifyOverdueInstallments } from "../utils/notificationHelpers";

// ... [parseSupabaseError function remains unchanged] ...
const parseSupabaseError = (error: any, context: string): string => {
  console.error(`Error ${context}:`, error);
  if (error && typeof error === "object" && "message" in error) {
    const supabaseError = error as {
      message: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    if (supabaseError.message.includes("Invalid login credentials")) {
      return "Invalid email or password. Please try again.";
    }
    if (supabaseError.code === "23505") {
      return `Failed to add record: A record with a similar unique value (e.g., phone number or receipt) already exists.`;
    }
    if (supabaseError.message.includes("permission denied")) {
      return `Database Connection Successful, but Permission Denied.\n\nThis is likely a Row Level Security (RLS) issue. Please check your Supabase dashboard to ensure RLS policies allow the current user to perform this action.`;
    }
    return `Database Error: ${supabaseError.message}`;
  }
  return `An unknown database error occurred while ${context}. The operation may not have completed successfully.`;
};

// ... [DataContextType interface remains unchanged] ...
interface DataContextType {
  session: Session | null;
  customers: Customer[];
  loans: LoanWithCustomer[];
  subscriptions: SubscriptionWithCustomer[];
  installments: Installment[];
  dataEntries: DataEntry[];
  loading: boolean;
  isAuthChecking: boolean;
  isRefreshing: boolean;
  isScopedCustomer: boolean;
  scopedCustomerId: string | null;
  // Lookup maps for O(1) access
  customerMap: Map<string, Customer>;
  installmentsByLoanId: Map<string, Installment[]>;
  signInWithPassword: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  addCustomer: (customer: Omit<NewCustomer, "user_id">) => Promise<Customer>;
  updateCustomer: (
    customerId: string,
    updates: Partial<Customer>,
  ) => Promise<Customer>;
  addLoan: (loan: NewLoan) => Promise<Loan>;
  updateLoan: (loanId: string, updates: Partial<Loan>) => Promise<Loan>;
  addSubscription: (subscription: NewSubscription) => Promise<Subscription>;
  updateSubscription: (
    subscriptionId: string,
    updates: Partial<Subscription>,
  ) => Promise<Subscription>;
  adjustSubscriptionForMisc: (
    customerId: string,
    amount: number,
    date?: string,
  ) => Promise<void>;
  addInstallment: (installment: NewInstallment) => Promise<Installment>;
  updateInstallment: (
    installmentId: string,
    updates: Partial<Installment>,
  ) => Promise<Installment>;
  addDataEntry: (entry: NewDataEntry) => Promise<DataEntry>;
  deleteDataEntry: (id: string) => Promise<void>;
  deleteCustomer: (customerId: string) => Promise<void>;
  deleteLoan: (loanId: string) => Promise<void>;
  deleteSubscription: (subscriptionId: string) => Promise<void>;
  deleteInstallment: (installmentId: string) => Promise<void>;
  seniorityList: Array<any>;
  deletedSeniorityList: Array<any>;
  fetchSeniorityList: (
    overrideSession?: Session | null,
    overrideIsScoped?: boolean,
  ) => Promise<void>;
  fetchDeletedSeniorityList: () => Promise<void>;
  addToSeniority: (
    customerId: string,
    details?: {
      station_name?: string;
      loan_type?: string;
      loan_request_date?: string;
    },
  ) => Promise<void>;
  updateSeniority: (
    id: string,
    updates: {
      station_name?: string | null;
      loan_type?: string | null;
      loan_request_date?: string | null;
    },
  ) => Promise<void>;
  removeFromSeniority: (id: string) => Promise<void>;
  restoreSeniorityEntry: (id: string) => Promise<void>;
  permanentDeleteSeniority: (id: string) => Promise<void>;
  // Data entries soft delete
  deletedDataEntries: DataEntry[];
  fetchDeletedDataEntries: () => Promise<void>;
  restoreDataEntry: (id: string) => Promise<void>;
  permanentDeleteDataEntry: (id: string) => Promise<void>;
  // Subscriptions soft delete
  deletedSubscriptions: SubscriptionWithCustomer[];
  fetchDeletedSubscriptions: () => Promise<void>;
  restoreSubscription: (id: string) => Promise<void>;
  permanentDeleteSubscription: (id: string) => Promise<void>;
  // Loans soft delete
  deletedLoans: LoanWithCustomer[];
  fetchDeletedLoans: () => Promise<void>;
  restoreLoan: (id: string) => Promise<void>;
  permanentDeleteLoan: (id: string) => Promise<void>;
  // Installments soft delete
  deletedInstallments: Installment[];
  fetchDeletedInstallments: () => Promise<void>;
  restoreInstallment: (id: string) => Promise<void>;
  permanentDeleteInstallment: (id: string) => Promise<void>;
  // Customers soft delete
  deletedCustomers: Customer[];
  fetchDeletedCustomers: () => Promise<void>;
  restoreCustomer: (id: string) => Promise<void>;
  permanentDeleteCustomer: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Helper function to fetch all records from a table (handles pagination automatically)
const BATCH_SIZE = 1000;
const fetchAllRecords = async <T,>(
  queryBuilder: () => ReturnType<ReturnType<typeof supabase.from>["select"]>,
  tableName?: string,
): Promise<T[]> => {
  const allRecords: T[] = [];
  let from = 0;
  let hasMore = true;
  let batchNum = 0;

  while (hasMore) {
    batchNum++;
    const { data, error } = await queryBuilder().range(
      from,
      from + BATCH_SIZE - 1,
    );
    if (error) throw error;
    if (data && data.length > 0) {
      allRecords.push(...(data as T[]));
      from += BATCH_SIZE;
      hasMore = data.length === BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }
  return allRecords;
};

// Cache helper functions
// NOTE: On mobile WebView, localStorage may be unreliable or isolated per process.
// We disable caching entirely on native to avoid silent failures and stale data.
const getCachedData = (key: string) => {
  // Skip caching on mobile - WebView storage is unreliable
  // Forces fresh fetches from Supabase instead
  const isNative = typeof window !== "undefined" && window.isNativeApp?.();
  if (isNative) {
    console.log(`[Cache] Skipping cached data on mobile for key: ${key}`);
    return null;
  }

  try {
    const cached = localStorage.getItem(`loan_app_cache_${key}`);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // Cache valid for 5 minutes
      if (Date.now() - timestamp < 5 * 60 * 1000) {
        return data;
      }
    }
  } catch (err) {
    console.error("Error reading from cache:", err);
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  // Skip caching on mobile - WebView storage is unreliable
  const isNative = typeof window !== "undefined" && window.isNativeApp?.();
  if (isNative) {
    console.log(`[Cache] Skipping cache write on mobile for key: ${key}`);
    return;
  }

  try {
    localStorage.setItem(
      `loan_app_cache_${key}`,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      }),
    );
  } catch (err) {
    console.error("Error writing to cache:", err);
  }
};

const clearCache = (key?: string) => {
  // Skip cache clearing on mobile (nothing to clear since we don't cache)
  const isNative = typeof window !== "undefined" && window.isNativeApp?.();
  if (isNative) {
    return;
  }

  try {
    if (key) {
      localStorage.removeItem(`loan_app_cache_${key}`);
    } else {
      // Clear all cache keys
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith("loan_app_cache_")) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch (err) {
    console.error("Error clearing cache:", err);
  }
};

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loans, setLoans] = useState<LoanWithCustomer[]>([]);
  const [subscriptions, setSubscriptions] = useState<
    SubscriptionWithCustomer[]
  >([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [seniorityList, setSeniorityList] = useState<any[]>([]);
  const [deletedSeniorityList, setDeletedSeniorityList] = useState<any[]>([]);
  const [deletedDataEntries, setDeletedDataEntries] = useState<DataEntry[]>([]);
  const [deletedSubscriptions, setDeletedSubscriptions] = useState<
    SubscriptionWithCustomer[]
  >([]);
  const [deletedLoans, setDeletedLoans] = useState<LoanWithCustomer[]>([]);
  const [deletedInstallments, setDeletedInstallments] = useState<Installment[]>(
    [],
  );
  const [deletedCustomers, setDeletedCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataEntries, setDataEntries] = useState<DataEntry[]>([]);
  const [isScopedCustomer, setIsScopedCustomer] = useState(false);
  const [scopedCustomerId, setScopedCustomerId] = useState<string | null>(null);

  // Lookup maps for O(1) access - improves performance from O(n) to O(1)
  const customerMap = useMemo(() => {
    return new Map(customers.map((c) => [c.id, c]));
  }, [customers]);

  const installmentsByLoanId = useMemo(() => {
    const map = new Map<string, Installment[]>();
    installments.forEach((inst) => {
      const existing = map.get(inst.loan_id) || [];
      existing.push(inst);
      map.set(inst.loan_id, existing);
    });
    // Sort each loan's installments by date (newest first) for consistency
    map.forEach((insts, loanId) => {
      insts.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      map.set(loanId, insts);
    });
    return map;
  }, [installments]);

  // UPDATED: Accepts optional arguments. If provided, uses them; otherwise falls back to state.
  // This allows the useEffect to call it with calculated values before state updates commit.
  // NOTE: No dependency array needed since we're using overrides during initialization
  const fetchData = useCallback(
    async (overrideIsScoped?: boolean, overrideScopedId?: string | null) => {
      try {
        // Don't set isRefreshing during initialization - only during user-triggered refreshes
        // Check if we're being called during initialization by checking if overrides are provided
        const isInitialization =
          overrideIsScoped !== undefined || overrideScopedId !== undefined;
        if (!isInitialization) {
          setIsRefreshing(true);
        }

        // Use overrides if they are explicitly passed (even if false/null), otherwise use state
        const effectiveIsScoped =
          overrideIsScoped !== undefined ? overrideIsScoped : isScopedCustomer;
        const effectiveScopedId =
          overrideScopedId !== undefined ? overrideScopedId : scopedCustomerId;

        // If the user is scoped to a customer, fetch only that customer's related data
        if (effectiveIsScoped && effectiveScopedId) {
          // Customers: only the scoped customer (excluding soft-deleted)
          const { data: customerData, error: custErr } = await supabase
            .from("customers")
            .select("*")
            .eq("id", effectiveScopedId)
            .is("deleted_at", null)
            .limit(1);
          if (custErr) throw custErr;
          setCustomers((customerData as unknown as Customer[]) || []);

          // Loans for this customer (excluding soft-deleted)
          const { data: loansData, error: loansError } = await supabase
            .from("loans")
            .select("*, customers(name, phone)")
            .eq("customer_id", effectiveScopedId)
            .is("deleted_at", null);
          if (loansError) throw loansError;
          const loansArr = (loansData as unknown as LoanWithCustomer[]) || [];
          setLoans(loansArr);

          // Subscriptions for this customer
          // Subscriptions for this customer (sorted by date ascending: oldest to newest)
          const { data: subscriptionsData, error: subscriptionsError } =
            await supabase
              .from("subscriptions")
              .select("*, customers(name, phone)")
              .eq("customer_id", effectiveScopedId)
              .is("deleted_at", null)
              .order("date", { ascending: true });
          if (subscriptionsError) throw subscriptionsError;
          setSubscriptions(
            (subscriptionsData as unknown as SubscriptionWithCustomer[]) || [],
          );

          // Installments: fetch installments for loans owned by this customer (by loan_id)
          const loanIds = loansArr.map((l) => l.id);
          if (loanIds.length > 0) {
            const { data: installmentsData, error: installmentsError } =
              await supabase
                .from("installments")
                .select("*")
                .in("loan_id", loanIds)
                .is("deleted_at", null);
            if (installmentsError) throw installmentsError;
            setInstallments((installmentsData as Installment[]) || []);
          } else {
            setInstallments([]);
          }

          // Data entries for this customer (excluding soft-deleted)
          const { data: dataEntriesData, error: dataEntriesError } =
            await supabase
              .from("data_entries")
              .select("*")
              .eq("customer_id", effectiveScopedId)
              .is("deleted_at", null);
          if (dataEntriesError) throw dataEntriesError;
          setDataEntries((dataEntriesData as DataEntry[]) || []);
        } else {
          // Full fetch for admin/users with no scoped customer - PARALLEL fetch for performance
          const [
            customersData,
            loansData,
            subscriptionsData,
            installmentsData,
            dataEntriesData,
          ] = await Promise.all([
            fetchAllRecords<Customer>(
              () =>
                supabase
                  .from("customers")
                  .select("*")
                  .is("deleted_at", null)
                  .order("created_at", { ascending: false }),
              "customers",
            ),
            fetchAllRecords<LoanWithCustomer>(
              () =>
                supabase
                  .from("loans")
                  .select("*, customers(name, phone)")
                  .is("deleted_at", null)
                  .order("created_at", { ascending: false }),
              "loans",
            ),
            fetchAllRecords<SubscriptionWithCustomer>(
              () =>
                supabase
                  .from("subscriptions")
                  .select("*, customers(name, phone)")
                  .is("deleted_at", null)
                  .order("created_at", { ascending: false }),
              "subscriptions",
            ),
            fetchAllRecords<Installment>(
              () =>
                supabase
                  .from("installments")
                  .select("*")
                  .is("deleted_at", null)
                  .order("created_at", { ascending: false }),
              "installments",
            ),
            fetchAllRecords<DataEntry>(
              () =>
                supabase
                  .from("data_entries")
                  .select("*")
                  .is("deleted_at", null)
                  .order("date", { ascending: false }),
              "data_entries",
            ),
          ]);

          setCustomers(customersData);
          setLoans(loansData);
          setSubscriptions(subscriptionsData);
          setInstallments(installmentsData);
          setDataEntries(dataEntriesData);

          // Check for overdue installments and create notifications (admin only) - non-blocking
          if (!effectiveIsScoped) {
            checkAndNotifyOverdueInstallments(
              installmentsData,
              loansData,
              customersData,
            ).catch((notificationErr) => {
              console.error(
                "Error checking overdue installments:",
                notificationErr,
              );
            });
          }
        }
      } catch (error: any) {
        console.error("Error in fetchData:", error);
        alert(parseSupabaseError(error, "fetching data"));
      } finally {
        // Only reset isRefreshing if it was set (user-triggered refresh, not initialization)
        const isInitialization =
          overrideIsScoped !== undefined || overrideScopedId !== undefined;
        if (!isInitialization) {
          setIsRefreshing(false);
        }
      }
    },
    [isScopedCustomer, scopedCustomerId],
  );

  // UPDATED: Accepts optional arguments to avoid stale state during initialization and auth state changes.
  // If provided, uses them; otherwise falls back to state.
  const fetchSeniorityList = useCallback(
    async (overrideSession?: Session | null, overrideIsScoped?: boolean) => {
      try {
        // Use overrides if they are explicitly passed, otherwise use state
        const effectiveSession =
          overrideSession !== undefined ? overrideSession : session;
        const effectiveIsScoped =
          overrideIsScoped !== undefined ? overrideIsScoped : isScopedCustomer;

        if (
          !effectiveSession ||
          !effectiveSession.user ||
          !effectiveSession.user.id
        ) {
          setSeniorityList([]);
          return;
        }

        let query = supabase
          .from("loan_seniority")
          .select("*, customers(name, phone)")
          .is("deleted_at", null)
          .order("loan_request_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true });
        // All users (including scoped) see the full seniority list
        // Primary sort uses loan_request_date so requested dates dictate the order,
        // with created_at providing a tie-breaker for same-day entries.
        // Filter by deleted_at IS NULL to exclude soft-deleted entries

        const { data, error } = await query;
        if (error) {
          console.error("Supabase error fetching loan_seniority:", error);
          throw error;
        }
        setSeniorityList((data as any[]) || []);
      } catch (err: any) {
        console.error("Failed to fetch loan seniority list", err);
      }
    },
    [session, isScopedCustomer],
  );

  // Fetch deleted seniority entries (admin only - RLS enforced)
  const fetchDeletedSeniorityList = useCallback(async () => {
    try {
      if (!session || !session.user || !session.user.id || isScopedCustomer) {
        setDeletedSeniorityList([]);
        return;
      }

      const { data, error } = await supabase
        .from("loan_seniority")
        .select("*, customers(name, phone)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) {
        console.error("Supabase error fetching deleted loan_seniority:", error);
        throw error;
      }
      setDeletedSeniorityList((data as any[]) || []);
    } catch (err: any) {
      console.error("Failed to fetch deleted seniority list", err);
      setDeletedSeniorityList([]);
    }
  }, [session, isScopedCustomer]);

  // Fetch deleted data entries (admin only - RLS enforced)
  const fetchDeletedDataEntries = useCallback(async () => {
    try {
      if (!session || !session.user || !session.user.id || isScopedCustomer) {
        setDeletedDataEntries([]);
        return;
      }

      const { data, error } = await supabase
        .from("data_entries")
        .select("*, customers(name, phone)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) {
        console.error("Supabase error fetching deleted data_entries:", error);
        throw error;
      }
      setDeletedDataEntries((data as any[]) || []);
    } catch (err: any) {
      console.error("Failed to fetch deleted data entries", err);
      setDeletedDataEntries([]);
    }
  }, [session, isScopedCustomer]);

  // Fetch deleted subscriptions (admin only - RLS enforced)
  const fetchDeletedSubscriptions = useCallback(async () => {
    try {
      if (!session || !session.user || !session.user.id || isScopedCustomer) {
        setDeletedSubscriptions([]);
        return;
      }

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, customers(name, phone)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) {
        console.error("Supabase error fetching deleted subscriptions:", error);
        throw error;
      }
      setDeletedSubscriptions((data as SubscriptionWithCustomer[]) || []);
    } catch (err: any) {
      console.error("Failed to fetch deleted subscriptions", err);
      setDeletedSubscriptions([]);
    }
  }, [session, isScopedCustomer]);

  // Fetch deleted loans (admin only - RLS enforced)
  const fetchDeletedLoans = useCallback(async () => {
    try {
      if (!session || !session.user || !session.user.id || isScopedCustomer) {
        setDeletedLoans([]);
        return;
      }

      const { data, error } = await supabase
        .from("loans")
        .select("*, customers(name, phone)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) {
        console.error("Supabase error fetching deleted loans:", error);
        throw error;
      }
      setDeletedLoans((data as LoanWithCustomer[]) || []);
    } catch (err: any) {
      console.error("Failed to fetch deleted loans", err);
      setDeletedLoans([]);
    }
  }, [session, isScopedCustomer]);

  // Fetch deleted installments (admin only - RLS enforced)
  const fetchDeletedInstallments = useCallback(async () => {
    try {
      if (!session || !session.user || !session.user.id || isScopedCustomer) {
        setDeletedInstallments([]);
        return;
      }

      const { data, error } = await supabase
        .from("installments")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) {
        console.error("Supabase error fetching deleted installments:", error);
        throw error;
      }
      setDeletedInstallments((data as Installment[]) || []);
    } catch (err: any) {
      console.error("Failed to fetch deleted installments", err);
      setDeletedInstallments([]);
    }
  }, [session, isScopedCustomer]);

  // Fetch deleted customers (admin only - RLS enforced)
  const fetchDeletedCustomers = useCallback(async () => {
    try {
      if (!session || !session.user || !session.user.id || isScopedCustomer) {
        setDeletedCustomers([]);
        return;
      }

      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) {
        console.error("Supabase error fetching deleted customers:", error);
        throw error;
      }
      setDeletedCustomers((data as Customer[]) || []);
    } catch (err: any) {
      console.error("Failed to fetch deleted customers", err);
      setDeletedCustomers([]);
    }
  }, [session, isScopedCustomer]);

  // ... [addToSeniority, removeFromSeniority, updateSeniority functions remain unchanged] ...
  const addToSeniority = async (
    customerId: string,
    details?: {
      station_name?: string;
      loan_type?: string;
      loan_request_date?: string;
    },
  ) => {
    if (
      isScopedCustomer &&
      scopedCustomerId &&
      customerId !== scopedCustomerId
    ) {
      throw new Error(
        "Read-only access: scoped customers can only request seniority for their own account",
      );
    }
    try {
      if (!session || !session.user) throw new Error("Not authenticated");

      // Check if customer is already in the seniority list (active, not deleted)
      const { data: existingEntry, error: checkError } = await supabase
        .from("loan_seniority")
        .select("id")
        .eq("customer_id", customerId)
        .is("deleted_at", null)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingEntry) {
        throw new Error("This customer is already in the loan seniority list.");
      }

      const payload: any = {
        user_id: session.user.id,
        customer_id: customerId,
      };
      if (details) {
        if (details.station_name) payload.station_name = details.station_name;
        if (details.loan_type) payload.loan_type = details.loan_type;
        if (details.loan_request_date)
          payload.loan_request_date = details.loan_request_date;
      }
      const { data, error } = await supabase
        .from("loan_seniority")
        .insert([payload])
        .select()
        .single();
      if (error || !data) throw error;

      // Notify admins if this was a scoped request
      if (isScopedCustomer) {
        try {
          const customer = customerMap.get(customerId);
          const name = customer?.name || "A customer";
          await supabase.from("system_notifications").insert({
            type: "seniority_request",
            status: "processing", // Using 'processing' makes it blue/info
            message: `${name} requested For Loan Seniority: ${
              details?.loan_type || "General"
            }`,
            metadata: { customer_id: customerId, ...details },
          });
        } catch (notifyErr) {
          console.error("Failed to send system notification:", notifyErr);
        }
      }

      await fetchSeniorityList();
    } catch (err: any) {
      // Pass through the specific error message if it's our duplicate check
      if (
        err.message === "This customer is already in the loan seniority list."
      ) {
        throw err;
      }
      throw new Error(
        parseSupabaseError(
          err,
          `adding customer ${customerId} to seniority list`,
        ),
      );
    }
  };

  const removeFromSeniority = async (id: string) => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot modify seniority list",
      );
    try {
      // Soft delete: set deleted_at timestamp instead of hard delete
      const { error } = await supabase
        .from("loan_seniority")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: session?.user?.id || session?.user?.email || null,
        } as any)
        .eq("id", id);
      if (error) throw error;
      await fetchSeniorityList();
      await fetchDeletedSeniorityList();
    } catch (err: any) {
      throw new Error(parseSupabaseError(err, `removing seniority item ${id}`));
    }
  };

  const restoreSeniorityEntry = async (id: string) => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot restore seniority entries",
      );
    try {
      // Restore soft-deleted entry by clearing deleted_at
      const { error } = await supabase
        .from("loan_seniority")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("id", id);
      if (error) throw error;
      await fetchSeniorityList();
      await fetchDeletedSeniorityList();
    } catch (err: any) {
      throw new Error(
        parseSupabaseError(err, `restoring seniority item ${id}`),
      );
    }
  };

  const permanentDeleteSeniority = async (id: string) => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot permanently delete seniority entries",
      );
    try {
      // Defensive check: verify the entry is soft-deleted before permanent deletion
      const { data: entry, error: fetchError } = await supabase
        .from("loan_seniority")
        .select("id, deleted_at")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (!entry || (entry as any).deleted_at === null) {
        throw new Error(
          "Cannot permanently delete: entry must be soft-deleted first (moved to trash)",
        );
      }

      // Hard delete - permanently remove the entry
      const { error } = await supabase
        .from("loan_seniority")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await fetchDeletedSeniorityList();
    } catch (err: any) {
      throw new Error(
        parseSupabaseError(err, `permanently deleting seniority item ${id}`),
      );
    }
  };

  const updateSeniority = async (
    id: string,
    updates: {
      station_name?: string | null;
      loan_type?: string | null;
      loan_request_date?: string | null;
    },
  ) => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot modify seniority list",
      );
    try {
      const { data, error } = await supabase
        .from("loan_seniority")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error || !data) throw error;
      await fetchSeniorityList();
    } catch (err: any) {
      throw new Error(parseSupabaseError(err, `updating seniority item ${id}`));
    }
  };

  // ... [All CRUD operations remain unchanged] ...
  const updateCustomer = async (
    customerId: string,
    updates: Partial<Customer>,
  ): Promise<Customer> => {
    // Allow scoped customers to update only their own station_name
    if (isScopedCustomer) {
      const isOwnRecord = customerId === scopedCustomerId;
      const isOnlyStationName =
        Object.keys(updates).length === 1 && "station_name" in updates;
      if (!isOwnRecord || !isOnlyStationName) {
        throw new Error(
          "Read-only access: scoped customers can only update their own station name",
        );
      }
    }

    // Capture previous phone from in-memory map so we can detect changes
    const previous = customerMap.get(customerId);
    const previousPhone = previous?.phone ?? null;

    try {
      const { data, error } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", customerId)
        .select()
        .single();
      if (error || !data) throw error;

      await fetchData();

      // If admin changed phone, trigger server-side update of the auth user
      if (
        !isScopedCustomer &&
        updates.phone &&
        updates.phone !== previousPhone
      ) {
        (async () => {
          try {
            const resp = await fetch(
              "/.netlify/functions/update-user-from-customer",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  customer_id: customerId,
                  phone: updates.phone,
                }),
              },
            );
            if (!resp.ok) {
              const errData = await resp.json().catch(() => ({}));
              console.error(
                "Failed to update auth user after phone change:",
                errData.error || resp.statusText,
              );
            }
          } catch (err) {
            console.error(
              "Failed to update auth user after phone change:",
              err,
            );
          }
        })();
      }

      return data as Customer;
    } catch (error) {
      throw new Error(
        parseSupabaseError(error, `updating customer ${customerId}`),
      );
    }
  };

  const updateLoan = async (
    loanId: string,
    updates: Partial<Loan>,
  ): Promise<Loan> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot perform updates",
      );
    try {
      const { data, error } = await supabase
        .from("loans")
        .update(updates)
        .eq("id", loanId)
        .select()
        .single();
      if (error || !data) throw error;
      await fetchData();
      return data as Loan;
    } catch (error) {
      throw new Error(parseSupabaseError(error, `updating loan ${loanId}`));
    }
  };

  const updateSubscription = async (
    subscriptionId: string,
    updates: Partial<Subscription>,
  ): Promise<Subscription> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot perform updates",
      );
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .update(updates)
        .eq("id", subscriptionId)
        .select()
        .single();
      if (error || !data) throw error;
      await fetchData();
      return data as Subscription;
    } catch (error) {
      throw new Error(
        parseSupabaseError(error, `updating subscription ${subscriptionId}`),
      );
    }
  };

  const adjustSubscriptionForMisc = async (
    customerId: string,
    amount: number,
    date?: string,
  ): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot perform subscription adjustments",
      );
    try {
      const { data: subs, error: subsError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("customer_id", customerId)
        .order("date", { ascending: false })
        .limit(1);
      if (subsError) throw subsError;
      if (subs && subs.length > 0) {
        const sub = subs[0] as Subscription;
        const newAmount = Number(sub.amount) - Number(amount);
        const { data, error } = await supabase
          .from("subscriptions")
          .update({ amount: newAmount })
          .eq("id", sub.id)
          .select()
          .single();
        if (error) throw error;
      } else {
        const now = date || new Date().toISOString().slice(0, 10);
        const year = new Date(now).getFullYear();
        const newSub = {
          customer_id: customerId,
          amount: -Math.abs(Number(amount)),
          year,
          date: now,
          receipt: "misc-subscription-adjustment",
        };
        const { data, error } = await supabase
          .from("subscriptions")
          .insert([newSub])
          .select()
          .single();
        if (error) throw error;
      }
      await fetchData();
    } catch (error) {
      throw new Error(
        parseSupabaseError(
          error,
          `adjusting subscription for misc entry for customer ${customerId}`,
        ),
      );
    }
  };

  const updateInstallment = async (
    installmentId: string,
    updates: Partial<Installment>,
  ): Promise<Installment> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot perform updates",
      );
    try {
      const { data, error } = await supabase
        .from("installments")
        .update(updates)
        .eq("id", installmentId)
        .select()
        .single();
      if (error || !data) throw error;
      await fetchData();
      return data as Installment;
    } catch (error) {
      throw new Error(
        parseSupabaseError(error, `updating installment ${installmentId}`),
      );
    }
  };

  const clearData = () => {
    setCustomers([]);
    setLoans([]);
    setSubscriptions([]);
    setInstallments([]);
    setDataEntries([]);
  };

  // ... [clearClientCache function remains unchanged] ...
  const clearClientCache = async () => {
    try {
      clearData();
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage.clear();
      } catch (err) {}
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (!key) continue;
          const lower = key.toLowerCase();
          if (
            lower.includes("supabase") ||
            lower.startsWith("sb-") ||
            lower.includes("gotrue") ||
            (lower.includes("auth") && lower.includes("token"))
          ) {
            keysToRemove.push(key);
          }
        }
        for (const k of keysToRemove) {
          try {
            window.localStorage.removeItem(k);
          } catch (e) {}
        }
      } catch (err) {}
      // ... [rest of cache clearing logic] ...
    } catch (err) {
      console.error("Error clearing client cache", err);
    }
  };

  // ... [addDataEntry, updateDataEntry, deleteDataEntry functions remain unchanged] ...
  const addDataEntry = async (entry: NewDataEntry): Promise<DataEntry> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot add data entries",
      );
    try {
      const { data, error } = await supabase
        .from("data_entries")
        .insert([entry])
        .select()
        .single();
      if (error || !data) throw error;
      try {
        if ((entry as any).subtype === "Subscription Return") {
          await adjustSubscriptionForMisc(
            entry.customer_id,
            Number(entry.amount),
            entry.date,
          );
        }
      } catch (err) {
        console.error("Failed to adjust subscription for misc entry:", err);
      }
      await fetchData();
      return data as DataEntry;
    } catch (error) {
      throw new Error(parseSupabaseError(error, "adding data entry"));
    }
  };

  const updateDataEntry = async (
    id: string,
    updates: Partial<DataEntry>,
  ): Promise<DataEntry> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot update data entries",
      );
    try {
      const { data, error } = await supabase
        .from("data_entries")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error || !data) throw error;
      await fetchData();
      return data as DataEntry;
    } catch (error) {
      throw new Error(parseSupabaseError(error, "updating data entry"));
    }
  };

  const deleteDataEntry = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot delete data entries",
      );
    try {
      // Soft delete: set deleted_at timestamp instead of hard delete
      const { error } = await supabase
        .from("data_entries")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: session?.user?.id || session?.user?.email || null,
        } as any)
        .eq("id", id);
      if (error) throw error;
      await fetchData();
      await fetchDeletedDataEntries();
    } catch (error) {
      throw new Error(parseSupabaseError(error, "deleting data entry"));
    }
  };

  const restoreDataEntry = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot restore data entries",
      );
    try {
      // Restore soft-deleted entry by clearing deleted_at
      const { error } = await supabase
        .from("data_entries")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("id", id);
      if (error) throw error;
      await fetchData();
      await fetchDeletedDataEntries();
    } catch (err: any) {
      throw new Error(parseSupabaseError(err, `restoring data entry ${id}`));
    }
  };

  const permanentDeleteDataEntry = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot permanently delete data entries",
      );
    try {
      // Defensive check: verify the entry is soft-deleted before permanent deletion
      const { data: entry, error: fetchError } = await supabase
        .from("data_entries")
        .select("id, deleted_at")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (!entry || (entry as any).deleted_at === null) {
        throw new Error(
          "Cannot permanently delete: entry must be soft-deleted first (moved to trash)",
        );
      }

      // Hard delete - permanently remove the entry
      const { error } = await supabase
        .from("data_entries")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await fetchDeletedDataEntries();
    } catch (err: any) {
      throw new Error(
        parseSupabaseError(err, `permanently deleting data entry ${id}`),
      );
    }
  };

  // Ref to track the last processed session token to prevent redundant updates
  const lastSessionTokenRef = React.useRef<string | null>(null);
  // Ref to track the last authenticated user ID to prevent redundant fetches on token refresh
  const lastUserIdRef = React.useRef<string | null>(null);

  // ============================================================================
  // NATIVE BRIDGE INTEGRATION - Mobile WebView Communication
  // ============================================================================
  // This effect registers handlers for messages from the native mobile wrapper
  // and notifies native when auth state changes. Only runs when inside native app.
  useEffect(() => {
    // Check if running in native app
    const isNative = typeof window !== "undefined" && window.isNativeApp?.();
    if (!isNative) return; // Skip on web

    console.log("[NativeBridge] Setting up message handlers in web app");

    // Create the native message handler callback
    const nativeHandler = (message: any) => {
      console.log("[NativeBridge] Received message from native:", message.type);

      switch (message.type) {
        case "AUTH_TOKEN": {
          // Native sent auth session - set it in Supabase
          const { accessToken, refreshToken } = message.payload;
          console.log("[NativeBridge] Setting session from native auth token");
          supabase.auth
            .setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            .then(() => {
              // Dispatch event to unblock the waiting Promise in initializeSession
              console.log(
                "[NativeBridge] Auth token set, dispatching native-auth-received event",
              );
              window.dispatchEvent(
                new CustomEvent("native-auth-received", {
                  detail: { success: true },
                }),
              );
            })
            .catch((err) => {
              console.error("[NativeBridge] Failed to set session:", err);
              // Still dispatch event so waiting Promise doesn't hang
              window.dispatchEvent(
                new CustomEvent("native-auth-received", {
                  detail: { success: false, error: err },
                }),
              );
            });
          break;
        }
        case "NATIVE_READY": {
          // Native wrapper is ready and initialized
          console.log("[NativeBridge] Native wrapper is ready");
          break;
        }
        case "PUSH_TOKEN": {
          // Native sent push token - store via authenticated RPC
          const { token, platform } = message.payload;
          console.log(
            "[NativeBridge] Storing push token:",
            token.substring(0, 20) + "...",
          );
          // Use 'as any' to bypass type checking - this RPC may not be in generated types yet
          (supabase.rpc as any)("update_push_token", {
            p_token: token,
            p_platform: platform,
          })
            .then(() => {
              console.log("[NativeBridge] Push token stored successfully");
            })
            .catch((err: any) =>
              console.warn("[NativeBridge] Failed to store push token:", err),
            );
          break;
        }
        case "NETWORK_STATUS": {
          // Handle offline/online state changes
          const { isConnected, type } = message.payload;
          console.log(
            "[NativeBridge] Network status:",
            isConnected ? "online" : "offline",
            `(${type})`,
          );
          // Could dispatch network state to context here if needed
          break;
        }
        case "APP_STATE": {
          // App moved to background/foreground
          console.log("[NativeBridge] App state:", message.payload.state);
          break;
        }
        case "DEEP_LINK": {
          // Deep link navigation from native
          const { url, path } = message.payload;
          console.log("[NativeBridge] Deep link received:", path);
          // Navigation is handled by native (via URL change in WebView)
          break;
        }
        default:
          if (import.meta.env?.DEV) {
            console.log("[NativeBridge] Unhandled message type:", message.type);
          }
      }
    };

    // Register handler for messages FROM native app
    const unsubscribe = window.registerNativeHandler?.(nativeHandler) as
      | (() => void)
      | undefined
      | void;

    console.log("[NativeBridge] Message handler registered");

    // Cleanup function: unregister the handler when component unmounts
    return () => {
      if (typeof unsubscribe === "function") {
        // If registerNativeHandler returns an unsubscribe function, call it
        unsubscribe();
      }
      console.log("[NativeBridge] Message handler unregistered");
    };
  }, []);

  // When session changes, notify native to persist it
  useEffect(() => {
    const isNative = typeof window !== "undefined" && window.isNativeApp?.();
    if (!isNative) return; // Skip on web

    // Listen for Supabase auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(
        "[NativeBridge] Auth state changed:",
        event,
        session ? "with session" : "no session",
      );

      if (event === "SIGNED_IN" && session) {
        // User signed in - send session to native for persistence
        console.log("[NativeBridge] Sending session to native for persistence");
        // Note: isScopedCustomer/scopedCustomerId may be stale here
        // Native should re-query or web should update after scope detection
        window.NativeBridge?.updateSession({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at ?? 0,
          user: {
            id: session.user.id,
            email: session.user.email,
            isScopedCustomer: isScopedCustomer,
            scopedCustomerId: scopedCustomerId,
          },
        });
      } else if (event === "SIGNED_OUT") {
        // User signed out - notify native to clear session
        console.log("[NativeBridge] Notifying native of logout");
        window.NativeBridge?.logout();
      } else if (event === "TOKEN_REFRESHED" && session) {
        // Token was refreshed - update native with new token
        console.log("[NativeBridge] Updating native with refreshed token");
        window.NativeBridge?.updateSession({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at ?? 0,
          user: {
            id: session.user.id,
            email: session.user.email,
            isScopedCustomer: isScopedCustomer,
            scopedCustomerId: scopedCustomerId,
          },
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isScopedCustomer, scopedCustomerId]);

  // FIX: Simplified initialization for Chrome/Edge compatibility
  useEffect(() => {
    let isMounted = true;
    let loadingTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const initializeSession = async () => {
      if (!isMounted) return;
      setLoading(true);
      console.log("[DataContext] Starting session initialization...");

      // Failsafe timeout to prevent infinite loading (helps WebView issues)
      loadingTimeoutId = setTimeout(() => {
        if (isMounted) {
          console.error(
            "[DataContext] Session initialization timed out after 30s - forcing loading=false",
          );
          setLoading(false);
          setIsAuthChecking(false);
          setIsRefreshing(false);
        }
      }, 30000);

      // Progress markers to help diagnose where hangs occur
      const progressMarkers = [
        setTimeout(
          () =>
            console.log(
              "[DataContext] Auth init: 5s elapsed, still working...",
            ),
          5000,
        ),
        setTimeout(
          () =>
            console.warn(
              "[DataContext] Auth init: 15s elapsed, this is taking longer than expected",
            ),
          15000,
        ),
        setTimeout(
          () =>
            console.error(
              "[DataContext] Auth init: 25s elapsed, approaching timeout!",
            ),
          25000,
        ),
      ];

      const clearProgressMarkers = () => {
        progressMarkers.forEach(clearTimeout);
      };

      try {
        // Get the current session
        console.log("[DataContext] Stage 1: Fetching session from Supabase...");

        // If running in native app, request session from native first
        const isNative =
          typeof window !== "undefined" && window.isNativeApp?.();
        if (isNative) {
          console.log(
            "[DataContext] Requesting auth session from native wrapper...",
          );
          window.NativeBridge?.requestAuth();

          // Wait for native auth response via event, with fallback timeout
          await new Promise<void>((resolve) => {
            let eventListener: ((event: Event) => void) | null = null;
            let timeoutId: ReturnType<typeof setTimeout> | null = null;

            const cleanup = () => {
              if (eventListener) {
                window.removeEventListener(
                  "native-auth-received",
                  eventListener,
                );
              }
              if (timeoutId) {
                clearTimeout(timeoutId);
              }
            };

            // Listen for the auth event from the message handler
            eventListener = () => {
              console.log(
                "[DataContext] Received native-auth-received event, proceeding with session check",
              );
              cleanup();
              resolve();
            };

            // Fallback timeout: if native never responds, proceed anyway after 2 seconds
            timeoutId = setTimeout(() => {
              console.warn(
                "[DataContext] Native auth response timeout (2s), proceeding with cached/browser session",
              );
              cleanup();
              resolve();
            }, 2000);

            window.addEventListener("native-auth-received", eventListener);
          });
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        console.log(
          "[DataContext] Stage 1 complete: Session",
          session ? "exists" : "null",
        );

        if (!isMounted) return;

        setSession(session);
        lastSessionTokenRef.current = session?.access_token || null;
        lastUserIdRef.current = session?.user?.id || null;

        // Auth check complete - unblock ProtectedRoute immediately
        // Data loading will continue in background
        setIsAuthChecking(false);

        let currentIsScoped = false;
        let currentScopedId: string | null = null;

        // If session exists, determine scope and fetch data
        if (session && session.user && session.user.id) {
          console.log("[DataContext] Stage 2: Checking user scope...");
          try {
            const { data: matchedCustomers, error } = await supabase
              .from("customers")
              .select("id")
              .eq("user_id", session.user.id)
              .limit(1);
            if (!error && matchedCustomers && matchedCustomers.length > 0) {
              currentIsScoped = true;
              currentScopedId = matchedCustomers[0].id;
            }
          } catch (err) {
            console.error("Error checking scoped customer", err);
          }

          if (!isMounted) return;

          setIsScopedCustomer(currentIsScoped);
          setScopedCustomerId(currentScopedId);

          // Load cached data immediately if available (for smooth UX)
          const cacheKey = currentIsScoped
            ? `data_scoped_${currentScopedId}`
            : "data_admin";
          const cachedData = getCachedData(cacheKey);
          if (cachedData) {
            setCustomers(cachedData.customers || []);
            setLoans(cachedData.loans || []);
            setSubscriptions(cachedData.subscriptions || []);
            setInstallments(cachedData.installments || []);
            setDataEntries(cachedData.dataEntries || []);
            setSeniorityList(cachedData.seniorityList || []);
          }

          // FIX: Progressive Loading - Unblock UI immediately
          if (isMounted) {
            setLoading(false);
            setIsRefreshing(true);
          }

          // Inline the fetch logic during initialization to avoid issues with fetchData callback
          try {
            if (currentIsScoped && currentScopedId) {
              // Scoped customer data fetch
              const [customerRes, loansRes, subsRes, dataEntriesRes] =
                await Promise.all([
                  supabase
                    .from("customers")
                    .select("*")
                    .eq("id", currentScopedId)
                    .is("deleted_at", null)
                    .limit(1),
                  supabase
                    .from("loans")
                    .select("*, customers(name, phone)")
                    .eq("customer_id", currentScopedId)
                    .is("deleted_at", null),
                  supabase
                    .from("subscriptions")
                    .select("*, customers(name, phone)")
                    .eq("customer_id", currentScopedId)
                    .order("date", { ascending: true }),
                  supabase
                    .from("data_entries")
                    .select("*")
                    .eq("customer_id", currentScopedId)
                    .is("deleted_at", null),
                ]);

              if (!isMounted) return;

              if (customerRes.error) throw customerRes.error;
              if (loansRes.error) throw loansRes.error;
              if (subsRes.error) throw subsRes.error;
              if (dataEntriesRes.error) throw dataEntriesRes.error;

              const customersData =
                (customerRes.data as unknown as Customer[]) || [];
              const loansArr =
                (loansRes.data as unknown as LoanWithCustomer[]) || [];
              const subscriptionsData =
                (subsRes.data as unknown as SubscriptionWithCustomer[]) || [];
              const dataEntriesData =
                (dataEntriesRes.data as DataEntry[]) || [];

              setCustomers(customersData);
              setLoans(loansArr);
              setSubscriptions(subscriptionsData);
              setDataEntries(dataEntriesData);

              // Fetch installments for loans
              let installmentsData: Installment[] = [];
              const loanIds = loansArr.map((l) => l.id);
              if (loanIds.length > 0) {
                const { data: fetchedInstallments, error: installmentsError } =
                  await supabase
                    .from("installments")
                    .select("*")
                    .in("loan_id", loanIds);
                if (installmentsError) throw installmentsError;
                installmentsData = (fetchedInstallments as Installment[]) || [];
                if (isMounted) setInstallments(installmentsData);
              } else if (isMounted) {
                setInstallments([]);
              }

              // Cache the fetched data
              setCachedData(`data_scoped_${currentScopedId}`, {
                customers: customersData,
                loans: loansArr,
                subscriptions: subscriptionsData,
                installments: installmentsData,
                dataEntries: dataEntriesData,
                seniorityList: [], // Will be set below
              });
            } else {
              // Admin/full data fetch - PARALLEL fetch using Promise.all for performance
              // This fetches all 5 tables simultaneously instead of sequentially
              const [
                customersData,
                loansData,
                subscriptionsData,
                installmentsData,
                dataEntriesData,
              ] = await Promise.all([
                fetchAllRecords<Customer>(
                  () =>
                    supabase
                      .from("customers")
                      .select("*")
                      .is("deleted_at", null)
                      .order("created_at", { ascending: false }),
                  "customers",
                ),
                fetchAllRecords<LoanWithCustomer>(
                  () =>
                    supabase
                      .from("loans")
                      .select("*, customers(name, phone)")
                      .is("deleted_at", null)
                      .order("created_at", { ascending: false }),
                  "loans",
                ),
                fetchAllRecords<SubscriptionWithCustomer>(
                  () =>
                    supabase
                      .from("subscriptions")
                      .select("*, customers(name, phone)")
                      .is("deleted_at", null)
                      .order("created_at", { ascending: false }),
                  "subscriptions",
                ),
                fetchAllRecords<Installment>(
                  () =>
                    supabase
                      .from("installments")
                      .select("*")
                      .is("deleted_at", null)
                      .order("created_at", { ascending: false }),
                  "installments",
                ),
                fetchAllRecords<DataEntry>(
                  () =>
                    supabase
                      .from("data_entries")
                      .select("*")
                      .is("deleted_at", null)
                      .order("date", { ascending: false }),
                  "data_entries",
                ),
              ]);

              if (!isMounted) return;

              setCustomers(customersData);
              setLoans(loansData);
              setSubscriptions(subscriptionsData);
              setInstallments(installmentsData);
              setDataEntries(dataEntriesData);

              // Check for overdue installments (admin only) - run in background, don't block
              if (!currentIsScoped) {
                checkAndNotifyOverdueInstallments(
                  installmentsData,
                  loansData,
                  customersData,
                ).catch((notificationErr) => {
                  console.error(
                    "Error checking overdue installments during init:",
                    notificationErr,
                  );
                });
              }

              // Cache the fetched data
              setCachedData("data_admin", {
                customers: customersData,
                loans: loansData,
                subscriptions: subscriptionsData,
                installments: installmentsData,
                dataEntries: dataEntriesData,
                seniorityList: [], // Will be set below
              });
            }
          } catch (err) {
            console.error("Error fetching data during initialization", err);
          }

          // Fetch seniority list
          try {
            const seniorityKey = currentIsScoped
              ? `seniority_scoped_${currentScopedId}`
              : "seniority_admin";
            const cachedSeniority = getCachedData(seniorityKey);
            if (cachedSeniority) {
              if (isMounted) setSeniorityList(cachedSeniority);
            }

            // All users (including scoped) see the full seniority list
            // Primary sort uses loan_request_date so requested dates dictate the order,
            // with created_at providing a tie-breaker for same-day entries.
            let query = supabase
              .from("loan_seniority")
              .select("*, customers(name, phone)")
              .order("loan_request_date", {
                ascending: true,
                nullsFirst: false,
              })
              .order("created_at", { ascending: true });
            const { data, error } = await query;
            if (error) throw error;
            const seniorityData = (data as any[]) || [];
            if (isMounted) setSeniorityList(seniorityData);
            setCachedData(seniorityKey, seniorityData);
          } catch (err) {
            console.error(
              "Error fetching seniority list during initialization",
              err,
            );
          }
        }
      } catch (err) {
        console.error("Error initializing session", err);
      } finally {
        if (isMounted) {
          console.log("[DataContext] Session initialization complete");
          clearProgressMarkers();
          setLoading(false);
          setIsRefreshing(false);
          if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
        }
      }
    };

    initializeSession();

    // Listen for auth state changes - handle sign in and sign out
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;

      // Handle sign out
      if (_event === "SIGNED_OUT") {
        setSession(null);
        setLoading(false);
        setIsAuthChecking(false);
        setIsRefreshing(false);
        lastSessionTokenRef.current = null;
        lastUserIdRef.current = null;
        clearClientCache();
        return;
      }

      // Handle sign in - set the session so user stays logged in
      if (_event === "SIGNED_IN") {
        setSession(session);
        lastSessionTokenRef.current = session?.access_token || null;
        lastUserIdRef.current = session?.user?.id || null;
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Report page load completion to native wrapper when app is ready
  useEffect(() => {
    if (!loading && typeof window !== "undefined" && window.isNativeApp?.()) {
      // Notify native that web app is ready and data has loaded
      console.log("[NativeBridge] Reporting page loaded to native");
      window.NativeBridge?.reportPageLoad(
        window.location.pathname || "/",
        document.title || "I J Reddy Loan App",
      );
    }
  }, [loading]);

  // Refetch data when user logs in (when session becomes available but data hasn't been loaded yet)
  useEffect(() => {
    if (!session || !session.user) return;

    // Only refetch if we have empty data (user just logged in)
    const hasNoData = customers.length === 0 && loans.length === 0;
    if (!hasNoData) return;

    let isMounted = true;

    const refetchDataAfterLogin = async () => {
      try {
        // Determine if user is scoped
        let currentIsScoped = false;
        let currentScopedId: string | null = null;

        try {
          const { data: matchedCustomers, error } = await supabase
            .from("customers")
            .select("id")
            .eq("user_id", session.user.id)
            .limit(1);
          if (!error && matchedCustomers && matchedCustomers.length > 0) {
            currentIsScoped = true;
            currentScopedId = matchedCustomers[0].id;
          }
        } catch (err) {
          console.error("Error checking scoped customer after login", err);
        }

        if (!isMounted) return;

        setIsScopedCustomer(currentIsScoped);
        setScopedCustomerId(currentScopedId);

        // Fetch all data
        if (currentIsScoped && currentScopedId) {
          // Load from cache first for instant display
          const cacheKey = `loan_app_cache_data_scoped_${currentScopedId}`;
          const cachedData = getCachedData(cacheKey);
          if (cachedData && isMounted) {
            setCustomers(cachedData.customers || []);
            setLoans(cachedData.loans || []);
            setSubscriptions(cachedData.subscriptions || []);
            setDataEntries(cachedData.dataEntries || []);
            setInstallments(cachedData.installments || []);
          }

          // Scoped customer data fetch
          const [customerRes, loansRes, subsRes, dataEntriesRes] =
            await Promise.all([
              supabase
                .from("customers")
                .select("*")
                .eq("id", currentScopedId)
                .limit(1),
              supabase
                .from("loans")
                .select("*, customers(name, phone)")
                .eq("customer_id", currentScopedId)
                .is("deleted_at", null),
              supabase
                .from("subscriptions")
                .select("*, customers(name, phone)")
                .eq("customer_id", currentScopedId)
                .order("date", { ascending: true }),
              supabase
                .from("data_entries")
                .select("*")
                .eq("customer_id", currentScopedId)
                .is("deleted_at", null),
            ]);

          if (!isMounted) return;

          if (customerRes.error) throw customerRes.error;
          if (loansRes.error) throw loansRes.error;
          if (subsRes.error) throw subsRes.error;
          if (dataEntriesRes.error) throw dataEntriesRes.error;

          setCustomers((customerRes.data as unknown as Customer[]) || []);
          const loansArr =
            (loansRes.data as unknown as LoanWithCustomer[]) || [];
          setLoans(loansArr);
          setSubscriptions(
            (subsRes.data as unknown as SubscriptionWithCustomer[]) || [],
          );
          setDataEntries((dataEntriesRes.data as DataEntry[]) || []);

          // Fetch installments
          const loanIds = loansArr.map((l) => l.id);
          let installmentsData: Installment[] = [];
          if (loanIds.length > 0) {
            const { data, error: installmentsError } = await supabase
              .from("installments")
              .select("*")
              .in("loan_id", loanIds);
            if (installmentsError) throw installmentsError;
            installmentsData = (data as Installment[]) || [];
          }
          if (isMounted) setInstallments(installmentsData);

          // Cache all scoped customer data
          setCachedData(cacheKey, {
            customers: (customerRes.data as unknown as Customer[]) || [],
            loans: loansArr,
            subscriptions:
              (subsRes.data as unknown as SubscriptionWithCustomer[]) || [],
            installments: installmentsData,
            dataEntries: (dataEntriesRes.data as DataEntry[]) || [],
            seniorityList: [],
          });
        } else {
          // Load from cache first for instant display
          const cacheKey = "loan_app_cache_data_admin";
          const cachedData = getCachedData(cacheKey);
          if (cachedData && isMounted) {
            setCustomers(cachedData.customers || []);
            setLoans(cachedData.loans || []);
            setSubscriptions(cachedData.subscriptions || []);
            setInstallments(cachedData.installments || []);
            setDataEntries(cachedData.dataEntries || []);
          }

          // Admin/full data fetch - PARALLEL fetch for performance
          const [
            customersData,
            loansData,
            subscriptionsData,
            installmentsData,
            dataEntriesData,
          ] = await Promise.all([
            fetchAllRecords<Customer>(
              () =>
                supabase
                  .from("customers")
                  .select("*")
                  .is("deleted_at", null)
                  .order("created_at", { ascending: false }),
              "customers",
            ),
            fetchAllRecords<LoanWithCustomer>(
              () =>
                supabase
                  .from("loans")
                  .select("*, customers(name, phone)")
                  .is("deleted_at", null)
                  .order("created_at", { ascending: false }),
              "loans",
            ),
            fetchAllRecords<SubscriptionWithCustomer>(
              () =>
                supabase
                  .from("subscriptions")
                  .select("*, customers(name, phone)")
                  .is("deleted_at", null)
                  .order("created_at", { ascending: false }),
              "subscriptions",
            ),
            fetchAllRecords<Installment>(
              () =>
                supabase
                  .from("installments")
                  .select("*")
                  .is("deleted_at", null)
                  .order("created_at", { ascending: false }),
              "installments",
            ),
            fetchAllRecords<DataEntry>(
              () =>
                supabase
                  .from("data_entries")
                  .select("*")
                  .is("deleted_at", null)
                  .order("date", { ascending: false }),
              "data_entries",
            ),
          ]);

          if (!isMounted) return;

          setCustomers(customersData);
          setLoans(loansData);
          setSubscriptions(subscriptionsData);
          setInstallments(installmentsData);
          setDataEntries(dataEntriesData);

          // Check for overdue installments (admin only) - non-blocking
          if (!currentIsScoped) {
            checkAndNotifyOverdueInstallments(
              installmentsData,
              loansData,
              customersData,
            ).catch((notificationErr) => {
              console.error(
                "Error checking overdue installments after login:",
                notificationErr,
              );
            });
          }

          // Cache admin data
          setCachedData("loan_app_cache_data_admin", {
            customers: customersData,
            loans: loansData,
            subscriptions: subscriptionsData,
            installments: installmentsData,
            dataEntries: dataEntriesData,
            seniorityList: [],
          });
        }

        // Fetch seniority list
        try {
          const seniorityKey = currentIsScoped
            ? `seniority_scoped_${currentScopedId}`
            : "seniority_admin";
          const cachedSeniority = getCachedData(seniorityKey);
          if (cachedSeniority) {
            if (isMounted) setSeniorityList(cachedSeniority);
          }

          // Keep ordering consistent with the initialization fetch.
          let query = supabase
            .from("loan_seniority")
            .select("*, customers(name, phone)")
            .order("loan_request_date", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: true });
          if (currentIsScoped) {
            query = query.eq("user_id", session.user.id as string);
          }
          const { data, error } = await query;
          if (error) throw error;
          const seniorityData = (data as any[]) || [];
          if (isMounted) setSeniorityList(seniorityData);
          setCachedData(seniorityKey, seniorityData);
        } catch (err) {
          console.error("Error fetching seniority list after login", err);
        }
      } catch (err) {
        console.error("Error refetching data after login", err);
      }
    };

    refetchDataAfterLogin();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  const signInWithPassword = async (email: string, pass: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });
      if (error) throw error;
    } catch (error) {
      throw new Error(parseSupabaseError(error, "signing in"));
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      clearClientCache();
    } catch (error) {
      throw new Error(parseSupabaseError(error, "signing out"));
    }
  };

  const addCustomer = async (
    customerData: Omit<NewCustomer, "user_id">,
  ): Promise<Customer> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot add customers",
      );
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert([customerData] as any)
        .select()
        .single();
      if (error || !data) throw error;

      // Trigger background user creation without blocking the customer add flow.
      try {
        (async () => {
          try {
            const createUrl = `/.netlify/functions/create-user-from-customer?_=${Date.now()}`;
            const resp = await fetch(createUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
              },
              body: JSON.stringify({
                customer_id: data.id,
                name: customerData.name,
                phone: customerData.phone,
              }),
            });

            if (!resp.ok) {
              const errData = await resp.json().catch(() => ({}));
              console.warn(
                "⚠️  Background user creation failed:",
                errData.error || resp.statusText,
              );
              try {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("background-user-create", {
                      detail: {
                        status: "error",
                        customer_id: data.id,
                        message: errData.error || resp.statusText,
                      },
                    }),
                  );
                }
              } catch (e) {}
            } else {
              const successData = await resp.json().catch(() => ({}));
              console.log(
                "✅ Background user auto-created:",
                successData.user_id || "<unknown>",
              );
              try {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("background-user-create", {
                      detail: {
                        status: "success",
                        customer_id: data.id,
                        user_id: successData.user_id,
                        message: "User created successfully",
                      },
                    }),
                  );
                }
              } catch (e) {}
            }
          } catch (err) {
            console.warn("⚠️  Error during background user creation:", err);
          }
        })();
      } catch (userCreateError) {
        console.warn(
          "⚠️  Failed to schedule background user creation:",
          userCreateError,
        );
      }

      await fetchData();
      return data as Customer;
    } catch (error) {
      throw new Error(parseSupabaseError(error, "adding customer"));
    }
  };

  const addLoan = async (loanData: NewLoan): Promise<Loan> => {
    if (isScopedCustomer)
      throw new Error("Read-only access: scoped customers cannot add loans");
    try {
      const { data, error } = await supabase
        .from("loans")
        .insert([loanData] as any)
        .select()
        .single();
      if (error || !data) throw error;
      try {
        if (data.customer_id) {
          // Remove from seniority list regardless of who requested it
          await supabase
            .from("loan_seniority")
            .delete()
            .eq("customer_id", data.customer_id);
        }
      } catch (e) {
        console.error("Failed to cleanup loan_seniority after loan create", e);
      }
      await fetchData();
      return data as Loan;
    } catch (error) {
      throw new Error(parseSupabaseError(error, "adding loan"));
    }
  };

  const addSubscription = async (
    subscriptionData: NewSubscription,
  ): Promise<Subscription> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot add subscriptions",
      );
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .insert([subscriptionData] as any)
        .select()
        .single();
      if (error || !data) throw error;
      await fetchData();
      return data as Subscription;
    } catch (error) {
      throw new Error(parseSupabaseError(error, "adding subscription"));
    }
  };

  const addInstallment = async (
    installmentData: NewInstallment,
  ): Promise<Installment> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot add installments",
      );
    try {
      const { data, error } = await supabase
        .from("installments")
        .insert([installmentData] as any)
        .select()
        .single();
      if (error || !data) throw error;
      await fetchData();
      return data as Installment;
    } catch (error) {
      throw new Error(parseSupabaseError(error, "adding installment"));
    }
  };

  const deleteCustomer = async (customerId: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot delete customers",
      );
    try {
      const deletedAt = new Date().toISOString();
      const deletedBy = session?.user?.id || session?.user?.email || null;

      // Optimistic UI update - remove from local state immediately
      try {
        const optimisticLoanIds = loans
          .filter((l) => l.customer_id === customerId)
          .map((l) => l.id);
        setCustomers((prev) => prev.filter((c) => c.id !== customerId));
        setLoans((prev) => prev.filter((l) => l.customer_id !== customerId));
        setSubscriptions((prev) =>
          prev.filter((s) => s.customer_id !== customerId),
        );
        setInstallments((prev) =>
          prev.filter((i) => !optimisticLoanIds.includes(i.loan_id)),
        );
        setDataEntries((prev) =>
          prev.filter((d) => d.customer_id !== customerId),
        );
        setSeniorityList((prev) =>
          prev.filter((s) => s.customer_id !== customerId),
        );
      } catch (e) {}

      // Soft delete the customer
      const { error: custErr } = await supabase
        .from("customers")
        .update({
          deleted_at: deletedAt,
          deleted_by: deletedBy,
        } as any)
        .eq("id", customerId);
      if (custErr) throw custErr;

      // Soft delete all related loans
      const { error: loansErr } = await supabase
        .from("loans")
        .update({
          deleted_at: deletedAt,
          deleted_by: deletedBy,
        } as any)
        .eq("customer_id", customerId)
        .is("deleted_at", null);
      if (loansErr) throw loansErr;

      // Soft delete all related subscriptions
      const { error: subsErr } = await supabase
        .from("subscriptions")
        .update({
          deleted_at: deletedAt,
          deleted_by: deletedBy,
        } as any)
        .eq("customer_id", customerId)
        .is("deleted_at", null);
      if (subsErr) throw subsErr;

      // Soft delete all related data entries
      const { error: dataErr } = await supabase
        .from("data_entries")
        .update({
          deleted_at: deletedAt,
          deleted_by: deletedBy,
        } as any)
        .eq("customer_id", customerId)
        .is("deleted_at", null);
      if (dataErr) throw dataErr;

      // Soft delete all related loan seniority entries
      const { error: seniorityErr } = await supabase
        .from("loan_seniority")
        .update({
          deleted_at: deletedAt,
          deleted_by: deletedBy,
        } as any)
        .eq("customer_id", customerId)
        .is("deleted_at", null);
      if (seniorityErr) throw seniorityErr;

      await fetchData();
      await fetchDeletedCustomers();
    } catch (error) {
      // Revert optimistic update on error
      await fetchData();
      throw new Error(
        parseSupabaseError(error, `deleting customer ${customerId}`),
      );
    }
  };

  const deleteLoan = async (loanId: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error("Read-only access: scoped customers cannot delete loans");
    try {
      // Soft delete: set deleted_at timestamp instead of hard delete
      const { error } = await supabase
        .from("loans")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: session?.user?.id || session?.user?.email || null,
        } as any)
        .eq("id", loanId);
      if (error) throw error;
      await fetchData();
      await fetchDeletedLoans();
    } catch (error) {
      throw new Error(parseSupabaseError(error, `deleting loan ${loanId}`));
    }
  };

  const restoreLoan = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot restore loans",
      );
    try {
      // Restore soft-deleted entry by clearing deleted_at
      const { error } = await supabase
        .from("loans")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("id", id);
      if (error) throw error;
      await fetchData();
      await fetchDeletedLoans();
    } catch (err: any) {
      throw new Error(parseSupabaseError(err, `restoring loan ${id}`));
    }
  };

  const permanentDeleteLoan = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot permanently delete loans",
      );
    try {
      // Defensive check: verify the loan is soft-deleted before permanent deletion
      const { data: entry, error: fetchError } = await supabase
        .from("loans")
        .select("id, deleted_at")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (!entry || (entry as any).deleted_at === null) {
        throw new Error(
          "Cannot permanently delete: loan must be soft-deleted first (moved to trash)",
        );
      }

      // Hard delete - permanently remove the loan (installments will cascade delete)
      const { error } = await supabase.from("loans").delete().eq("id", id);
      if (error) throw error;
      await fetchDeletedLoans();
    } catch (err: any) {
      throw new Error(
        parseSupabaseError(err, `permanently deleting loan ${id}`),
      );
    }
  };

  // Restore a soft-deleted customer and all related records
  const restoreCustomer = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot restore customers",
      );
    try {
      // Get the customer's deleted_at timestamp to restore matching related records
      const { data: customer, error: fetchError } = await supabase
        .from("customers")
        .select("id, deleted_at")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (!customer || (customer as any).deleted_at === null) {
        throw new Error("Customer is not in trash");
      }

      const deletedAt = (customer as any).deleted_at;

      // Restore the customer
      const { error: custErr } = await supabase
        .from("customers")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("id", id);
      if (custErr) throw custErr;

      // Restore all related loans that were deleted at the same time
      const { error: loansErr } = await supabase
        .from("loans")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("customer_id", id)
        .eq("deleted_at", deletedAt);
      if (loansErr) throw loansErr;

      // Restore all related subscriptions that were deleted at the same time
      const { error: subsErr } = await supabase
        .from("subscriptions")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("customer_id", id)
        .eq("deleted_at", deletedAt);
      if (subsErr) throw subsErr;

      // Restore all related data entries that were deleted at the same time
      const { error: dataErr } = await supabase
        .from("data_entries")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("customer_id", id)
        .eq("deleted_at", deletedAt);
      if (dataErr) throw dataErr;

      // Restore all related loan seniority entries that were deleted at the same time
      const { error: seniorityErr } = await supabase
        .from("loan_seniority")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("customer_id", id)
        .eq("deleted_at", deletedAt);
      if (seniorityErr) throw seniorityErr;

      await fetchData();
      await fetchDeletedCustomers();
    } catch (err: any) {
      throw new Error(parseSupabaseError(err, `restoring customer ${id}`));
    }
  };

  // Permanently delete a soft-deleted customer and all related records
  const permanentDeleteCustomer = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot permanently delete customers",
      );
    try {
      // Defensive check: verify the customer is soft-deleted before permanent deletion
      const { data: customer, error: fetchError } = await supabase
        .from("customers")
        .select("id, user_id, deleted_at")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (!customer || (customer as any).deleted_at === null) {
        throw new Error(
          "Cannot permanently delete: customer must be soft-deleted first (moved to trash)",
        );
      }

      const customerUserId = (customer as any).user_id || null;

      // Hard delete all related data entries
      const { error: delDataErr } = await supabase
        .from("data_entries")
        .delete()
        .eq("customer_id", id);
      if (delDataErr) throw delDataErr;

      // Hard delete all related loan seniority entries
      const { error: delSeniorityErr } = await supabase
        .from("loan_seniority")
        .delete()
        .eq("customer_id", id);
      if (delSeniorityErr) throw delSeniorityErr;

      // Get all loans for this customer to delete their installments
      const { data: loansForCustomer, error: loansFetchError } = await supabase
        .from("loans")
        .select("id")
        .eq("customer_id", id);
      if (loansFetchError) throw loansFetchError;
      const loanIds = (loansForCustomer || []).map((l: any) => l.id);
      if (loanIds.length > 0) {
        const { error: delInstallErr } = await supabase
          .from("installments")
          .delete()
          .in("loan_id", loanIds);
        if (delInstallErr) throw delInstallErr;
        const { error: delLoanErr } = await supabase
          .from("loans")
          .delete()
          .in("id", loanIds);
        if (delLoanErr) throw delLoanErr;
      }

      // Hard delete all related subscriptions
      const { error: delSubErr } = await supabase
        .from("subscriptions")
        .delete()
        .eq("customer_id", id);
      if (delSubErr) throw delSubErr;

      // Hard delete the customer
      const { error: delCustErr } = await supabase
        .from("customers")
        .delete()
        .eq("id", id);
      if (delCustErr) throw delCustErr;

      // Delete linked auth user if exists
      if (customerUserId) {
        try {
          const deleteUrl = `/.netlify/functions/delete-user-from-customer?_=${Date.now()}`;
          const resp = await fetch(deleteUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
            body: JSON.stringify({
              customer_id: id,
              user_id: customerUserId,
            }),
          });
          if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            console.warn(
              "Warning: failed to delete linked auth user:",
              errData.error || resp.statusText,
            );
          } else {
            console.log("✅ Linked auth user deleted for customer", id);
          }
        } catch (e) {
          console.warn(
            "Warning: error calling delete-user-from-customer function",
            e,
          );
        }
      }

      await fetchDeletedCustomers();
    } catch (err: any) {
      throw new Error(
        parseSupabaseError(err, `permanently deleting customer ${id}`),
      );
    }
  };

  const deleteSubscription = async (subscriptionId: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot delete subscriptions",
      );
    try {
      // Soft delete: set deleted_at timestamp instead of hard delete
      const { error } = await supabase
        .from("subscriptions")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: session?.user?.id || session?.user?.email || null,
        } as any)
        .eq("id", subscriptionId);
      if (error) throw error;
      await fetchData();
      await fetchDeletedSubscriptions();
    } catch (error) {
      throw new Error(
        parseSupabaseError(error, `deleting subscription ${subscriptionId}`),
      );
    }
  };

  const restoreSubscription = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot restore subscriptions",
      );
    try {
      // Restore soft-deleted entry by clearing deleted_at
      const { error } = await supabase
        .from("subscriptions")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("id", id);
      if (error) throw error;
      await fetchData();
      await fetchDeletedSubscriptions();
    } catch (err: any) {
      throw new Error(parseSupabaseError(err, `restoring subscription ${id}`));
    }
  };

  const permanentDeleteSubscription = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot permanently delete subscriptions",
      );
    try {
      // Defensive check: verify the entry is soft-deleted before permanent deletion
      const { data: entry, error: fetchError } = await supabase
        .from("subscriptions")
        .select("id, deleted_at")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (!entry || (entry as any).deleted_at === null) {
        throw new Error(
          "Cannot permanently delete: subscription must be soft-deleted first (moved to trash)",
        );
      }

      // Hard delete - permanently remove the entry
      const { error } = await supabase
        .from("subscriptions")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await fetchDeletedSubscriptions();
    } catch (err: any) {
      throw new Error(
        parseSupabaseError(err, `permanently deleting subscription ${id}`),
      );
    }
  };

  const deleteInstallment = async (installmentId: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot delete installments",
      );
    try {
      // Soft delete: set deleted_at timestamp instead of hard delete
      const { error } = await supabase
        .from("installments")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: session?.user?.id || session?.user?.email || null,
        } as any)
        .eq("id", installmentId);
      if (error) throw error;
      await fetchData();
      await fetchDeletedInstallments();
    } catch (error) {
      throw new Error(
        parseSupabaseError(error, `deleting installment ${installmentId}`),
      );
    }
  };

  const restoreInstallment = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot restore installments",
      );
    try {
      // First, get the installment to find its loan_id
      const { data: installment, error: fetchError } = await supabase
        .from("installments")
        .select("id, loan_id, deleted_at")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (!installment || (installment as any).deleted_at === null) {
        throw new Error("Installment is not in trash");
      }

      // Check if the parent loan exists and is not soft-deleted
      const { data: loan, error: loanError } = await supabase
        .from("loans")
        .select("id, deleted_at")
        .eq("id", (installment as any).loan_id)
        .single();

      if (loanError && loanError.code !== "PGRST116") throw loanError;

      if (!loan || (loan as any).deleted_at !== null) {
        throw new Error(
          "Cannot restore: The parent loan has been deleted or does not exist. You can only permanently delete this installment.",
        );
      }

      // Restore soft-deleted entry by clearing deleted_at
      const { error } = await supabase
        .from("installments")
        .update({
          deleted_at: null,
          deleted_by: null,
        } as any)
        .eq("id", id);
      if (error) throw error;
      await fetchData();
      await fetchDeletedInstallments();
    } catch (err: any) {
      throw new Error(parseSupabaseError(err, `restoring installment ${id}`));
    }
  };

  const permanentDeleteInstallment = async (id: string): Promise<void> => {
    if (isScopedCustomer)
      throw new Error(
        "Read-only access: scoped customers cannot permanently delete installments",
      );
    try {
      // Defensive check: verify the installment is soft-deleted before permanent deletion
      const { data: entry, error: fetchError } = await supabase
        .from("installments")
        .select("id, deleted_at")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (!entry || (entry as any).deleted_at === null) {
        throw new Error(
          "Cannot permanently delete: installment must be soft-deleted first (moved to trash)",
        );
      }

      // Hard delete - permanently remove the installment
      const { error } = await supabase
        .from("installments")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await fetchDeletedInstallments();
    } catch (err: any) {
      throw new Error(
        parseSupabaseError(err, `permanently deleting installment ${id}`),
      );
    }
  };

  return (
    <DataContext.Provider
      value={{
        session,
        customers,
        loans,
        subscriptions,
        installments,
        dataEntries,
        loading,
        isAuthChecking,
        isRefreshing,
        isScopedCustomer,
        scopedCustomerId,
        customerMap,
        installmentsByLoanId,
        signInWithPassword,
        signOut,
        addCustomer,
        updateCustomer,
        addLoan,
        updateLoan,
        addSubscription,
        updateSubscription,
        addInstallment,
        updateInstallment,
        addDataEntry,
        updateDataEntry,
        deleteDataEntry,
        deleteCustomer,
        deleteLoan,
        deleteSubscription,
        deleteInstallment,
        adjustSubscriptionForMisc,
        seniorityList,
        deletedSeniorityList,
        fetchSeniorityList,
        fetchDeletedSeniorityList,
        addToSeniority,
        updateSeniority,
        removeFromSeniority,
        restoreSeniorityEntry,
        permanentDeleteSeniority,
        deletedDataEntries,
        fetchDeletedDataEntries,
        restoreDataEntry,
        permanentDeleteDataEntry,
        deletedSubscriptions,
        fetchDeletedSubscriptions,
        restoreSubscription,
        permanentDeleteSubscription,
        deletedLoans,
        fetchDeletedLoans,
        restoreLoan,
        permanentDeleteLoan,
        deletedInstallments,
        fetchDeletedInstallments,
        restoreInstallment,
        permanentDeleteInstallment,
        deletedCustomers,
        fetchDeletedCustomers,
        restoreCustomer,
        permanentDeleteCustomer,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};
