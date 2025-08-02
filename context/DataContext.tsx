import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { supabase } from '../src/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { Customer, Loan, Subscription, Installment, NewCustomer, NewLoan, NewSubscription, NewInstallment, LoanWithCustomer, SubscriptionWithCustomer } from '../types';
import { useData } from '@/context/DataContext';

// Centralized error parser
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
  addInstallment: (installment: NewInstallment) => Promise<Installment>;
  deleteCustomer: (customerId: string) => Promise<void>;
  deleteLoan: (loanId: string) => Promise<void>;
  deleteSubscription: (subscriptionId: string) => Promise<void>;
  deleteInstallment: (installmentId: string) => Promise<void>;
}
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

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loans, setLoans] = useState<LoanWithCustomer[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithCustomer[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const { data: customersData, error: customersError } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
      if (customersError) throw customersError;
      setCustomers((customersData as unknown as Customer[]) || []);

      const { data: loansData, error: loansError } = await supabase.from('loans').select('*, customers(name)');
      if (loansError) throw loansError;
      setLoans((loansData as unknown as LoanWithCustomer[]) || []);

      const { data: subscriptionsData, error: subscriptionsError } = await supabase.from('subscriptions').select('*, customers(name)');
      if (subscriptionsError) throw subscriptionsError;
      setSubscriptions((subscriptionsData as unknown as SubscriptionWithCustomer[]) || []);
      
      const { data: installmentsData, error: installmentsError } = await supabase.from('installments').select('*');
      if (installmentsError) throw installmentsError;
      setInstallments((installmentsData as unknown as Installment[]) || []);

    } catch (error: any) {
       alert(parseSupabaseError(error, 'fetching data'));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

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
  
  const clearData = () => {
      setCustomers([]);
      setLoans([]);
      setSubscriptions([]);
      setInstallments([]);
  }

  useEffect(() => {
    setLoading(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false); // Only set loading to false once after the initial auth check.

      if (_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION') {
        if(session) fetchData();
      } else if (_event === 'SIGNED_OUT') {
        clearData();
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchData]);

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
      // The onAuthStateChange listener will handle clearing data
    } catch(error) {
        throw new Error(parseSupabaseError(error, 'signing out'));
    }
  };

  const addCustomer = async (customerData: Omit<NewCustomer, 'user_id'>): Promise<Customer> => {
    const user = session?.user;
    if (!user) throw new Error("You must be logged in to add a customer.");

    const customerPayload: NewCustomer = { ...customerData, user_id: user.id };
    
    try {
        const { data, error } = await supabase.from('customers').insert([customerPayload] as any).select().single();
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
      const { error } = await supabase.from('customers').delete().eq('id', customerId);
      if (error) throw error;
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
      const { error } = await supabase.from('installments').delete().eq('id', installmentId);
      if (error) throw error;
      await fetchData();
    } catch(error) {
       throw new Error(parseSupabaseError(error, `deleting installment ${installmentId}`));
    }
  };

  return (
    <DataContext.Provider value={{ session, customers, loans, subscriptions, installments, loading, isRefreshing, signInWithPassword, signOut, addCustomer, updateCustomer, addLoan, updateLoan, addSubscription, updateSubscription, addInstallment, deleteCustomer, deleteLoan, deleteSubscription, deleteInstallment }}>
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