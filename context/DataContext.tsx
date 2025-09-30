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
}


const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loans, setLoans] = useState<LoanWithCustomer[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithCustomer[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataEntries, setDataEntries] = useState<DataEntry[]>([]);

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // All supabase fetch calls are correct and unchanged...
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

    } catch (error: any) {
      alert(parseSupabaseError(error, 'fetching data'));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // All data mutation functions are correct and unchanged...
  const updateCustomer = async (customerId: string, updates: Partial<Customer>): Promise<Customer> => {
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
  // Add Data Entry
  const addDataEntry = async (entry: NewDataEntry): Promise<DataEntry> => {
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

      // 2. If a session exists, fetch the associated data.
      if (session) {
        await fetchData();
      }

      // 3. Only set loading to false AFTER all data is fetched.
      setLoading(false);
    };

    initializeSession();

    // The listener for SIGNED_IN and SIGNED_OUT events remains the same.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_IN') {
        setSession(session);
        fetchData();
      } else if (_event === 'SIGNED_OUT') {
        setSession(null);
        clearData();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchData]); // This dependency is stable, so the effect runs only once.

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
    } catch(error) {
      throw new Error(parseSupabaseError(error, 'signing out'));
    }
  };

  const addCustomer = async (customerData: Omit<NewCustomer, 'user_id'>): Promise<Customer> => {
    try {
      const { data, error } = await supabase.from('customers').insert([customerData] as any).select().single();
      if (error || !data) throw error;
      await fetchData();
      return data as Customer;
    } catch(error) {
      throw new Error(parseSupabaseError(error, 'adding customer'));
    }
  };

  const addLoan = async (loanData: NewLoan): Promise<Loan> => {
    try {
      const { data, error } = await supabase.from('loans').insert([loanData] as any).select().single();
      if (error || !data) throw error;
      await fetchData();
      return data as Loan;
    } catch(error) {
      throw new Error(parseSupabaseError(error, 'adding loan'));
    }
  };

  const addSubscription = async (subscriptionData: NewSubscription): Promise<Subscription> => {
    try {
      const { data, error } = await supabase.from('subscriptions').insert([subscriptionData] as any).select().single();
      if (error || !data) throw error;
      await fetchData();
      return data as Subscription;
    } catch(error) {
      throw new Error(parseSupabaseError(error, 'adding subscription'));
    }
  };
  
  const addInstallment = async (installmentData: NewInstallment): Promise<Installment> => {
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
    try {
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
    try {
      const { error } = await supabase.from('loans').delete().eq('id', loanId);
      if (error) throw error;
      await fetchData();
    } catch(error) {
      throw new Error(parseSupabaseError(error, `deleting loan ${loanId}`));
    }
  };

  const deleteSubscription = async (subscriptionId: string): Promise<void> => {
    try {
      const { error } = await supabase.from('subscriptions').delete().eq('id', subscriptionId);
      if (error) throw error;
      await fetchData();
    } catch(error) {
      throw new Error(parseSupabaseError(error, `deleting subscription ${subscriptionId}`));
    }
  };
  
  const deleteInstallment = async (installmentId: string): Promise<void> => {
    try {
      const { data, error } = await supabase.from('installments').delete().eq('id', installmentId);
      if (error) throw error;
      await fetchData();
    } catch(error) {
      throw new Error(parseSupabaseError(error, `deleting installment ${installmentId}`));
    }
  };


  return (
    <DataContext.Provider value={{ session, customers, loans, subscriptions, installments, dataEntries, loading, isRefreshing, signInWithPassword, signOut, addCustomer, updateCustomer, addLoan, updateLoan, addSubscription, updateSubscription, addInstallment, updateInstallment, addDataEntry, updateDataEntry, deleteDataEntry, deleteCustomer, deleteLoan, deleteSubscription, deleteInstallment, adjustSubscriptionForMisc }}>
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