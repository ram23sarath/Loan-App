import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { supabase } from '../src/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { Customer, Loan, Subscription, Installment, NewCustomer, NewLoan, NewSubscription, NewInstallment, LoanWithCustomer, SubscriptionWithCustomer, DataEntry, NewDataEntry } from '../types';

// parseSupabaseError and DataContextType interface remain unchanged...
const parseSupabaseError = (error: any, context: string): string => {
  console.error(`Error ${context}:`, error);
  if (error && typeof error === 'object' && 'message' in error) {
    const supabaseError = error as { message: string; details?: string; hint?: string; code?: string };
    if (supabaseError.message.includes('Invalid login credentials')) {
      return 'Invalid email or password. Please try again.';
    }
    if (supabaseError.code === '23505') {
      return `Failed to add record: A record with a similar unique value (e.g., phone number or receipt) already exists.`;
    }
    if (supabaseError.message.includes('permission denied')) {
      return `Database Connection Successful, but Permission Denied.\n\nThis is likely a Row Level Security (RLS) issue. Please check your Supabase dashboard to ensure RLS policies allow the current user to perform this action.`;
    }
    return `Database Error: ${supabaseError.message}`;
  }
  return `An unknown database error occurred while ${context}. The operation may not have completed successfully.`;
};

interface DataContextType {
  session: Session | null;
  customers: Customer[];
  loans: LoanWithCustomer[];
  subscriptions: SubscriptionWithCustomer[];
  installments: Installment[];
  dataEntries: DataEntry[];
  loading: boolean;
  isRefreshing: boolean;
  // When a user is tied to a customer record, they should have read-only scoped access
  isScopedCustomer: boolean;
  scopedCustomerId: string | null;
  signInWithPassword: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  addCustomer: (customer: Omit<NewCustomer, 'user_id'>) => Promise<Customer>;
  updateCustomer: (customerId: string, updates: Partial<Customer>) => Promise<Customer>;
  addLoan: (loan: NewLoan) => Promise<Loan>;
  updateLoan: (loanId: string, updates: Partial<Loan>) => Promise<Loan>;
  addSubscription: (subscription: NewSubscription) => Promise<Subscription>;
  updateSubscription: (subscriptionId: string, updates: Partial<Subscription>) => Promise<Subscription>;
  adjustSubscriptionForMisc: (customerId: string, amount: number, date?: string) => Promise<void>;
  addInstallment: (installment: NewInstallment) => Promise<Installment>;
  updateInstallment: (installmentId: string, updates: Partial<Installment>) => Promise<Installment>;
  addDataEntry: (entry: NewDataEntry) => Promise<DataEntry>;
  deleteDataEntry: (id: string) => Promise<void>;
  deleteCustomer: (customerId: string) => Promise<void>;
  deleteLoan: (loanId: string) => Promise<void>;
  deleteSubscription: (subscriptionId: string) => Promise<void>;
  deleteInstallment: (installmentId: string) => Promise<void>;
  // Loan seniority list persisted per user
  seniorityList: Array<any>;
  fetchSeniorityList: () => Promise<void>;
  addToSeniority: (customerId: string, details?: { station_name?: string; loan_type?: string; loan_request_date?: string }) => Promise<void>;
  updateSeniority: (id: string, updates: { station_name?: string | null; loan_type?: string | null; loan_request_date?: string | null }) => Promise<void>;
  removeFromSeniority: (id: string) => Promise<void>;
}


const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loans, setLoans] = useState<LoanWithCustomer[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithCustomer[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [seniorityList, setSeniorityList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataEntries, setDataEntries] = useState<DataEntry[]>([]);
  const [isScopedCustomer, setIsScopedCustomer] = useState(false);
  const [scopedCustomerId, setScopedCustomerId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // If the user is scoped to a customer, fetch only that customer's related data
      if (isScopedCustomer && scopedCustomerId) {
        // Customers: only the scoped customer
        const { data: customerData, error: custErr } = await supabase.from('customers').select('*').eq('id', scopedCustomerId).limit(1);
        if (custErr) throw custErr;
        setCustomers((customerData as unknown as Customer[]) || []);

        // Loans for this customer
        const { data: loansData, error: loansError } = await supabase.from('loans').select('*, customers(name, phone)').eq('customer_id', scopedCustomerId);
        if (loansError) throw loansError;
        const loansArr = (loansData as unknown as LoanWithCustomer[]) || [];
        setLoans(loansArr);

        // Subscriptions for this customer
        const { data: subscriptionsData, error: subscriptionsError } = await supabase.from('subscriptions').select('*, customers(name, phone)').eq('customer_id', scopedCustomerId);
        if (subscriptionsError) throw subscriptionsError;
        setSubscriptions((subscriptionsData as unknown as SubscriptionWithCustomer[]) || []);

        // Installments: fetch installments for loans owned by this customer (by loan_id)
        const loanIds = loansArr.map(l => l.id);
        if (loanIds.length > 0) {
          const { data: installmentsData, error: installmentsError } = await supabase.from('installments').select('*').in('loan_id', loanIds);
          if (installmentsError) throw installmentsError;
          setInstallments((installmentsData as Installment[]) || []);
        } else {
          setInstallments([]);
        }

        // Data entries for this customer
        const { data: dataEntriesData, error: dataEntriesError } = await supabase.from('data_entries').select('*').eq('customer_id', scopedCustomerId);
        if (dataEntriesError) throw dataEntriesError;
        setDataEntries((dataEntriesData as DataEntry[]) || []);
      } else {
        // Full fetch for admin/users with no scoped customer
        const { data: customersData, error: customersError } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
        if (customersError) throw customersError;
        setCustomers((customersData as unknown as Customer[]) || []);

        const { data: loansData, error: loansError } = await supabase.from('loans').select('*, customers(name, phone)');
        if (loansError) throw loansError;
        setLoans((loansData as unknown as LoanWithCustomer[]) || []);

        const { data: subscriptionsData, error: subscriptionsError } = await supabase.from('subscriptions').select('*, customers(name, phone)');
        if (subscriptionsError) throw subscriptionsError;
        setSubscriptions((subscriptionsData as unknown as SubscriptionWithCustomer[]) || []);

        const { data: installmentsData, error: installmentsError } = await supabase.from('installments').select('*');
        if (installmentsError) throw installmentsError;
        setInstallments((installmentsData as unknown as Installment[]) || []);

        // Fetch data entries
        const { data: dataEntriesData, error: dataEntriesError } = await supabase.from('data_entries').select('*');
        if (dataEntriesError) throw dataEntriesError;
        setDataEntries((dataEntriesData as DataEntry[]) || []);
      }

    } catch (error: any) {
      alert(parseSupabaseError(error, 'fetching data'));
    } finally {
      setIsRefreshing(false);
    }
  }, [isScopedCustomer, scopedCustomerId]);

  // Fetch the loan seniority list for the current user
  const fetchSeniorityList = useCallback(async () => {
    try {
      if (!session || !session.user || !session.user.id) {
        setSeniorityList([]);
        return;
      }
      const { data, error } = await supabase
        .from('loan_seniority')
        .select('*, customers(name, phone)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSeniorityList((data as any[]) || []);
    } catch (err: any) {
      console.error('Failed to fetch loan seniority list', err);
      // don't throw to avoid breaking other flows
    }
  }, [session]);

  const addToSeniority = async (customerId: string, details?: { station_name?: string; loan_type?: string; loan_request_date?: string }) => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot modify seniority list');
    try {
      if (!session || !session.user) throw new Error('Not authenticated');
      const payload: any = { user_id: session.user.id, customer_id: customerId };
      if (details) {
        if (details.station_name) payload.station_name = details.station_name;
        if (details.loan_type) payload.loan_type = details.loan_type;
        if (details.loan_request_date) payload.loan_request_date = details.loan_request_date;
      }
      const { data, error } = await supabase.from('loan_seniority').insert([payload]).select().single();
      if (error || !data) throw error;
      await fetchSeniorityList();
    } catch (err: any) {
      throw new Error(parseSupabaseError(err, `adding customer ${customerId} to seniority list`));
    }
  };

  const removeFromSeniority = async (id: string) => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot modify seniority list');
    try {
      const { error } = await supabase.from('loan_seniority').delete().eq('id', id);
      if (error) throw error;
      await fetchSeniorityList();
    } catch (err: any) {
      throw new Error(parseSupabaseError(err, `removing seniority item ${id}`));
    }
  };

  const updateSeniority = async (id: string, updates: { station_name?: string | null; loan_type?: string | null; loan_request_date?: string | null }) => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot modify seniority list');
    try {
      const { data, error } = await supabase.from('loan_seniority').update(updates).eq('id', id).select().single();
      if (error || !data) throw error;
      await fetchSeniorityList();
    } catch (err: any) {
      throw new Error(parseSupabaseError(err, `updating seniority item ${id}`));
    }
  };

  // All data mutation functions are correct and unchanged...
  const updateCustomer = async (customerId: string, updates: Partial<Customer>): Promise<Customer> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot perform updates');
    try {
      const { data, error } = await supabase.from('customers').update(updates).eq('id', customerId).select().single();
      if (error || !data) throw error;
      await fetchData();
      return data as Customer;
    } catch (error) {
      throw new Error(parseSupabaseError(error, `updating customer ${customerId}`));
    }
  };

  const updateLoan = async (loanId: string, updates: Partial<Loan>): Promise<Loan> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot perform updates');
    try {
      const { data, error } = await supabase.from('loans').update(updates).eq('id', loanId).select().single();
      if (error || !data) throw error;
      await fetchData();
      return data as Loan;
    } catch (error) {
      throw new Error(parseSupabaseError(error, `updating loan ${loanId}`));
    }
  };

  const updateSubscription = async (subscriptionId: string, updates: Partial<Subscription>): Promise<Subscription> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot perform updates');
    try {
      const { data, error } = await supabase.from('subscriptions').update(updates).eq('id', subscriptionId).select().single();
      if (error || !data) throw error;
      await fetchData();
      return data as Subscription;
    } catch (error) {
      throw new Error(parseSupabaseError(error, `updating subscription ${subscriptionId}`));
    }
  };

  // Adjust subscription balance when a misc entry of subtype 'Subscription Return' is recorded
  const adjustSubscriptionForMisc = async (customerId: string, amount: number, date?: string): Promise<void> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot perform subscription adjustments');
    try {
      // find the most recent subscription for this customer
      const { data: subs, error: subsError } = await supabase.from('subscriptions').select('*').eq('customer_id', customerId).order('date', { ascending: false }).limit(1);
      if (subsError) throw subsError;
      if (subs && subs.length > 0) {
        const sub = subs[0] as Subscription;
        const newAmount = Number(sub.amount) - Number(amount);
        const { data, error } = await supabase.from('subscriptions').update({ amount: newAmount }).eq('id', sub.id).select().single();
        if (error) throw error;
      } else {
        // no subscription exists - create a negative subscription entry to represent the deduction
        const now = date || new Date().toISOString().slice(0,10);
        const year = new Date(now).getFullYear();
        const newSub = {
          customer_id: customerId,
          amount: -Math.abs(Number(amount)),
          year,
          date: now,
          receipt: 'misc-subscription-adjustment',
        };
        const { data, error } = await supabase.from('subscriptions').insert([newSub]).select().single();
        if (error) throw error;
      }
      await fetchData();
    } catch (error) {
      throw new Error(parseSupabaseError(error, `adjusting subscription for misc entry for customer ${customerId}`));
    }
  };
  
  const updateInstallment = async (installmentId: string, updates: Partial<Installment>): Promise<Installment> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot perform updates');
    try {
      const { data, error } = await supabase.from('installments').update(updates).eq('id', installmentId).select().single();
      if (error || !data) throw error;
      await fetchData();
      return data as Installment;
    } catch (error) {
      throw new Error(parseSupabaseError(error, `updating installment ${installmentId}`));
    }
  };

  const clearData = () => {
    setCustomers([]);
    setLoans([]);
    setSubscriptions([]);
    setInstallments([]);
    setDataEntries([]);
  }

  // Clear client-side caches and storage that may persist after session expiry.
  // This addresses cases where stale data (e.g. truncated dates) remains visible
  // after an inactivity logout. We remove Supabase-related keys and reset
  // sessionStorage/localStorage where appropriate.
  const clearClientCache = () => {
    try {
      // Reset in-memory React state
      clearData();

      if (typeof window === 'undefined') return;

      // Clear sessionStorage fully (session-scoped)
      try {
        window.sessionStorage.clear();
      } catch (err) {
        // ignore
      }

      // Remove Supabase and app-specific keys from localStorage to avoid stale cached session/data.
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (!key) continue;
          const lower = key.toLowerCase();
          // Supabase auth/storage keys often contain 'supabase', 'sb-' or 'gotrue' or 'auth'
          if (
            lower.includes('supabase') ||
            lower.startsWith('sb-') ||
            lower.includes('gotrue') ||
            lower.includes('auth') && lower.includes('token')
          ) {
            keysToRemove.push(key);
          }
        }
        for (const k of keysToRemove) {
          try {
            window.localStorage.removeItem(k);
          } catch (e) {
            // ignore individual key removal failures
          }
        }
      } catch (err) {
        // ignore
      }

      // If the app uses any other caches (IndexedDB, service worker caches) consider clearing here.
    } catch (err) {
      // best-effort; do not throw
      console.error('Error clearing client cache', err);
    }
  }
  // Add Data Entry
  const addDataEntry = async (entry: NewDataEntry): Promise<DataEntry> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot add data entries');
    try {
      const { data, error } = await supabase.from('data_entries').insert([entry]).select().single();
      if (error || !data) throw error;
      // If this misc data entry represents a subscription adjustment, update subscriptions accordingly
      try {
        if ((entry as any).subtype === 'Subscription Return') {
          await adjustSubscriptionForMisc(entry.customer_id, Number(entry.amount), entry.date);
        }
      } catch (err) {
        // Log but don't fail the main insert; adjustment failure should be visible in console
        console.error('Failed to adjust subscription for misc entry:', err);
      }

      await fetchData();
      return data as DataEntry;
    } catch (error) {
      throw new Error(parseSupabaseError(error, 'adding data entry'));
    }
  };

  // Update Data Entry
  const updateDataEntry = async (id: string, updates: Partial<DataEntry>): Promise<DataEntry> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot update data entries');
    try {
      const { data, error } = await supabase.from('data_entries').update(updates).eq('id', id).select().single();
      if (error || !data) throw error;
      await fetchData();
      return data as DataEntry;
    } catch (error) {
      throw new Error(parseSupabaseError(error, 'updating data entry'));
    }
  };

  // Delete Data Entry
  const deleteDataEntry = async (id: string): Promise<void> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot delete data entries');
    try {
      const { error } = await supabase.from('data_entries').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (error) {
      throw new Error(parseSupabaseError(error, 'deleting data entry'));
    }
  };

  // FIX: This useEffect hook is updated to prevent the race condition.
  useEffect(() => {
    // Wrap the initialization in an async function to handle promises correctly.
    const initializeSession = async () => {
      setLoading(true);
      // 1. Get the current session from Supabase.
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      // 2. If a session exists, determine whether the auth user is mapped to a customer (scoped user)
      if (session && session.user && session.user.id) {
        try {
          const { data: matchedCustomers, error } = await supabase.from('customers').select('id').eq('user_id', session.user.id).limit(1);
          if (!error && matchedCustomers && matchedCustomers.length > 0) {
            setIsScopedCustomer(true);
            setScopedCustomerId(matchedCustomers[0].id);
          } else {
            setIsScopedCustomer(false);
            setScopedCustomerId(null);
          }
        } catch (err) {
          console.error('Error checking scoped customer', err);
          setIsScopedCustomer(false);
          setScopedCustomerId(null);
        }
        // Fetch data (scoped or full) after setting flags
        await fetchData();
        // fetch user's seniority list as well
        await fetchSeniorityList();
      }

      // 3. Only set loading to false AFTER all data is fetched.
      setLoading(false);
    };

    initializeSession();

    // The listener for SIGNED_IN and SIGNED_OUT events remains the same.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (_event === 'SIGNED_IN') {
        setSession(session);
        // Check if this user is a scoped customer and fetch accordingly
        if (session && session.user && session.user.id) {
          try {
            const { data: matchedCustomers, error } = await supabase.from('customers').select('id').eq('user_id', session.user.id).limit(1);
            if (!error && matchedCustomers && matchedCustomers.length > 0) {
              setIsScopedCustomer(true);
              setScopedCustomerId(matchedCustomers[0].id);
            } else {
              setIsScopedCustomer(false);
              setScopedCustomerId(null);
            }
          } catch (err) {
            console.error('Error checking scoped customer on signin', err);
            setIsScopedCustomer(false);
            setScopedCustomerId(null);
          }
          // Fetch data after determining scoped status
          await fetchData();
          await fetchSeniorityList();
        }
      } else if (_event === 'SIGNED_OUT') {
        setSession(null);
        // Clear both React state and any client-side persisted caches so the UI doesn't show stale data
        clearClientCache();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchData]);

  // All other functions are correct and unchanged...
  const signInWithPassword = async (email: string, pass: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
    } catch (error) {
      throw new Error(parseSupabaseError(error, 'signing in'));
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // Ensure local caches are cleared after sign out (explicit or due to inactivity)
      clearClientCache();
    } catch(error) {
      throw new Error(parseSupabaseError(error, 'signing out'));
    }
  };

  const addCustomer = async (customerData: Omit<NewCustomer, 'user_id'>): Promise<Customer> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot add customers');
    try {
      const { data, error } = await supabase.from('customers').insert([customerData] as any).select().single();
      if (error || !data) throw error;

      // Automatically create Supabase user for this customer
      // This happens asynchronously in the background
      try {
        const createUserResponse = await fetch('/.netlify/functions/create-user-from-customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: data.id,
            name: customerData.name,
            phone: customerData.phone,
          }),
        });

        if (!createUserResponse.ok) {
          const errorData = await createUserResponse.json();
          console.warn('⚠️  Failed to auto-create user:', errorData.error);
          // Don't throw - customer was created successfully even if user creation failed
        } else {
          const successData = await createUserResponse.json();
          console.log('✅ User auto-created:', successData.user_id);
        }
      } catch (userCreateError) {
        console.warn('⚠️  Failed to auto-create user in background:', userCreateError);
        // Don't throw - customer was created successfully even if user creation failed
      }

      await fetchData();
      return data as Customer;
    } catch(error) {
      throw new Error(parseSupabaseError(error, 'adding customer'));
    }
  };

  const addLoan = async (loanData: NewLoan): Promise<Loan> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot add loans');
    try {
      const { data, error } = await supabase.from('loans').insert([loanData] as any).select().single();
      if (error || !data) throw error;
      // If a loan was created for a customer, remove that customer from the current user's loan_seniority list
      try {
        if (session?.user?.id && data.customer_id) {
          await supabase.from('loan_seniority').delete().match({ customer_id: data.customer_id, user_id: session.user.id });
        }
      } catch (e) {
        // Log but don't fail the main operation
        console.error('Failed to cleanup loan_seniority after loan create', e);
      }
      await fetchData();
      return data as Loan;
    } catch(error) {
      throw new Error(parseSupabaseError(error, 'adding loan'));
    }
  };

  const addSubscription = async (subscriptionData: NewSubscription): Promise<Subscription> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot add subscriptions');
    try {
      const { data, error } = await supabase.from('subscriptions').insert([subscriptionData] as any).select().single();
      if (error || !data) throw error;
      // If a subscription was created for a customer, remove that customer from the current user's loan_seniority list
      try {
        if (session?.user?.id && data.customer_id) {
          await supabase.from('loan_seniority').delete().match({ customer_id: data.customer_id, user_id: session.user.id });
        }
      } catch (e) {
        console.error('Failed to cleanup loan_seniority after subscription create', e);
      }
      await fetchData();
      return data as Subscription;
    } catch(error) {
      throw new Error(parseSupabaseError(error, 'adding subscription'));
    }
  };
  
  const addInstallment = async (installmentData: NewInstallment): Promise<Installment> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot add installments');
    try {
      const { data, error } = await supabase.from('installments').insert([installmentData] as any).select().single();
      if (error || !data) throw error;
      await fetchData();
      return data as Installment;
    } catch(error) {
      throw new Error(parseSupabaseError(error, 'adding installment'));
    }
  };

  const deleteCustomer = async (customerId: string): Promise<void> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot delete customers');
    try {
      // Fetch customer row to determine if a linked auth user exists
      let customerUserId: string | null = null;
      try {
        const { data: custData, error: custFetchErr } = await supabase.from('customers').select('user_id').eq('id', customerId).limit(1);
        if (!custFetchErr && custData && custData.length > 0) {
          customerUserId = (custData[0] as any).user_id || null;
        }
      } catch (e) {
        console.warn('Failed to fetch customer user_id before delete', e);
      }

      // If a linked auth user exists, attempt to delete it via server-side function
      if (customerUserId) {
        try {
          const resp = await fetch('/.netlify/functions/delete-user-from-customer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customer_id: customerId, user_id: customerUserId }),
          });
          if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            console.warn('Warning: failed to delete linked auth user:', errData.error || resp.statusText);
            // Don't throw - continue deleting DB records to avoid leaving orphaned business data
          } else {
            console.log('✅ Linked auth user deleted for customer', customerId);
          }
        } catch (e) {
          console.warn('Warning: error calling delete-user-from-customer function', e);
        }
      }

      // Delete dependent data_entries
      const { error: delDataErr } = await supabase.from('data_entries').delete().eq('customer_id', customerId);
      if (delDataErr) throw delDataErr;

      // Delete loans and their installments
      const { data: loansForCustomer, error: loansFetchError } = await supabase.from('loans').select('id').eq('customer_id', customerId);
      if (loansFetchError) throw loansFetchError;
      const loanIds = (loansForCustomer || []).map((l: any) => l.id);
      if (loanIds.length > 0) {
        const { error: delInstallErr } = await supabase.from('installments').delete().in('loan_id', loanIds);
        if (delInstallErr) throw delInstallErr;
        const { error: delLoanErr } = await supabase.from('loans').delete().in('id', loanIds);
        if (delLoanErr) throw delLoanErr;
      }

      // Delete subscriptions
      const { error: delSubErr } = await supabase.from('subscriptions').delete().eq('customer_id', customerId);
      if (delSubErr) throw delSubErr;

      // Finally delete the customer
      const { error: delCustErr } = await supabase.from('customers').delete().eq('id', customerId);
      if (delCustErr) throw delCustErr;

      await fetchData();
    } catch (error) {
      throw new Error(parseSupabaseError(error, `deleting customer ${customerId}`));
    }
  };

  const deleteLoan = async (loanId: string): Promise<void> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot delete loans');
    try {
      const { error } = await supabase.from('loans').delete().eq('id', loanId);
      if (error) throw error;
      await fetchData();
    } catch(error) {
      throw new Error(parseSupabaseError(error, `deleting loan ${loanId}`));
    }
  };

  const deleteSubscription = async (subscriptionId: string): Promise<void> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot delete subscriptions');
    try {
      const { error } = await supabase.from('subscriptions').delete().eq('id', subscriptionId);
      if (error) throw error;
      await fetchData();
    } catch(error) {
      throw new Error(parseSupabaseError(error, `deleting subscription ${subscriptionId}`));
    }
  };
  
  const deleteInstallment = async (installmentId: string): Promise<void> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot delete installments');
    try {
      const { data, error } = await supabase.from('installments').delete().eq('id', installmentId);
      if (error) throw error;
      await fetchData();
    } catch(error) {
      throw new Error(parseSupabaseError(error, `deleting installment ${installmentId}`));
    }
  };


  return (
    <DataContext.Provider value={{ session, customers, loans, subscriptions, installments, dataEntries, loading, isRefreshing, isScopedCustomer, scopedCustomerId, signInWithPassword, signOut, addCustomer, updateCustomer, addLoan, updateLoan, addSubscription, updateSubscription, addInstallment, updateInstallment, addDataEntry, updateDataEntry, deleteDataEntry, deleteCustomer, deleteLoan, deleteSubscription, deleteInstallment, adjustSubscriptionForMisc, seniorityList, fetchSeniorityList, addToSeniority, updateSeniority, removeFromSeniority }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};