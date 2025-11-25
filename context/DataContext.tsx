import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { supabase } from '../src/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { Customer, Loan, Subscription, Installment, NewCustomer, NewLoan, NewSubscription, NewInstallment, LoanWithCustomer, SubscriptionWithCustomer, DataEntry, NewDataEntry } from '../types';

// ... [parseSupabaseError function remains unchanged] ...
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

// ... [DataContextType interface remains unchanged] ...
interface DataContextType {
    session: Session | null;
    customers: Customer[];
    loans: LoanWithCustomer[];
    subscriptions: SubscriptionWithCustomer[];
    installments: Installment[];
    dataEntries: DataEntry[];
    loading: boolean;
    isRefreshing: boolean;
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
    seniorityList: Array<any>;
    fetchSeniorityList: (overrideSession?: Session | null, overrideIsScoped?: boolean) => Promise<void>;
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

    // UPDATED: Accepts optional arguments. If provided, uses them; otherwise falls back to state.
    // This allows the useEffect to call it with calculated values before state updates commit.
    const fetchData = useCallback(async (overrideIsScoped?: boolean, overrideScopedId?: string | null) => {
        setIsRefreshing(true);
        try {
            // Use overrides if they are explicitly passed (even if false/null), otherwise use state
            const effectiveIsScoped = overrideIsScoped !== undefined ? overrideIsScoped : isScopedCustomer;
            const effectiveScopedId = overrideScopedId !== undefined ? overrideScopedId : scopedCustomerId;

            // If the user is scoped to a customer, fetch only that customer's related data
            if (effectiveIsScoped && effectiveScopedId) {
                // Customers: only the scoped customer
                const { data: customerData, error: custErr } = await supabase.from('customers').select('*').eq('id', effectiveScopedId).limit(1);
                if (custErr) throw custErr;
                setCustomers((customerData as unknown as Customer[]) || []);

                // Loans for this customer
                const { data: loansData, error: loansError } = await supabase.from('loans').select('*, customers(name, phone)').eq('customer_id', effectiveScopedId);
                if (loansError) throw loansError;
                const loansArr = (loansData as unknown as LoanWithCustomer[]) || [];
                setLoans(loansArr);

                // Subscriptions for this customer
                const { data: subscriptionsData, error: subscriptionsError } = await supabase.from('subscriptions').select('*, customers(name, phone)').eq('customer_id', effectiveScopedId);
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
                const { data: dataEntriesData, error: dataEntriesError } = await supabase.from('data_entries').select('*').eq('customer_id', effectiveScopedId);
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
            console.error('Error in fetchData:', error);
            alert(parseSupabaseError(error, 'fetching data'));
        } finally {
            setIsRefreshing(false);
        }
    }, [isScopedCustomer, scopedCustomerId]);

    // UPDATED: Accepts optional arguments to avoid stale state during initialization and auth state changes.
    // If provided, uses them; otherwise falls back to state.
    const fetchSeniorityList = useCallback(async (overrideSession?: Session | null, overrideIsScoped?: boolean) => {
        try {
            // Use overrides if they are explicitly passed, otherwise use state
            const effectiveSession = overrideSession !== undefined ? overrideSession : session;
            const effectiveIsScoped = overrideIsScoped !== undefined ? overrideIsScoped : isScopedCustomer;

            if (!effectiveSession || !effectiveSession.user || !effectiveSession.user.id) {
                setSeniorityList([]);
                return;
            }

            let query = supabase.from('loan_seniority').select('*, customers(name, phone)').order('created_at', { ascending: false });
            if (effectiveIsScoped) {
                query = query.eq('user_id', effectiveSession.user.id as string);
            }

            const { data, error } = await query;
            if (error) {
                console.error('Supabase error fetching loan_seniority:', error);
                throw error;
            }
            setSeniorityList((data as any[]) || []);
        } catch (err: any) {
            console.error('Failed to fetch loan seniority list', err);
        }
    }, [session, isScopedCustomer]);

    // ... [addToSeniority, removeFromSeniority, updateSeniority functions remain unchanged] ...
    const addToSeniority = async (customerId: string, details?: { station_name?: string; loan_type?: string; loan_request_date?: string }) => {
        if (isScopedCustomer && scopedCustomerId && customerId !== scopedCustomerId) {
            throw new Error('Read-only access: scoped customers can only request seniority for their own account');
        }
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

    // ... [All CRUD operations remain unchanged] ...
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

    const adjustSubscriptionForMisc = async (customerId: string, amount: number, date?: string): Promise<void> => {
        if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot perform subscription adjustments');
        try {
            const { data: subs, error: subsError } = await supabase.from('subscriptions').select('*').eq('customer_id', customerId).order('date', { ascending: false }).limit(1);
            if (subsError) throw subsError;
            if (subs && subs.length > 0) {
                const sub = subs[0] as Subscription;
                const newAmount = Number(sub.amount) - Number(amount);
                const { data, error } = await supabase.from('subscriptions').update({ amount: newAmount }).eq('id', sub.id).select().single();
                if (error) throw error;
            } else {
                const now = date || new Date().toISOString().slice(0, 10);
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
    };

    // ... [clearClientCache function remains unchanged] ...
    const clearClientCache = async () => {
        try {
            clearData();
            if (typeof window === 'undefined') return;
            try { window.sessionStorage.clear(); } catch (err) { }
            try {
                const keysToRemove: string[] = [];
                for (let i = 0; i < window.localStorage.length; i++) {
                    const key = window.localStorage.key(i);
                    if (!key) continue;
                    const lower = key.toLowerCase();
                    if (lower.includes('supabase') || lower.startsWith('sb-') || lower.includes('gotrue') || (lower.includes('auth') && lower.includes('token'))) {
                        keysToRemove.push(key);
                    }
                }
                for (const k of keysToRemove) {
                    try { window.localStorage.removeItem(k); } catch (e) { }
                }
            } catch (err) { }
            // ... [rest of cache clearing logic] ...
        } catch (err) {
            console.error('Error clearing client cache', err);
        }
    };

    // ... [addDataEntry, updateDataEntry, deleteDataEntry functions remain unchanged] ...
    const addDataEntry = async (entry: NewDataEntry): Promise<DataEntry> => {
        if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot add data entries');
        try {
            const { data, error } = await supabase.from('data_entries').insert([entry]).select().single();
            if (error || !data) throw error;
            try {
                if ((entry as any).subtype === 'Subscription Return') {
                    await adjustSubscriptionForMisc(entry.customer_id, Number(entry.amount), entry.date);
                }
            } catch (err) {
                console.error('Failed to adjust subscription for misc entry:', err);
            }
            await fetchData();
            return data as DataEntry;
        } catch (error) {
            throw new Error(parseSupabaseError(error, 'adding data entry'));
        }
    };

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

// Ref to track the last processed session token to prevent redundant updates
const lastSessionTokenRef = React.useRef<string | null>(null);

// FIX: This useEffect now runs strictly ONCE on mount (empty dependency array).
// Logic inside calculates state variables locally before calling fetch, avoiding
// the need to depend on updated state values.
useEffect(() => {
    const initializeSession = async () => {
        setLoading(true);
        try {
            // 1. Get the current session
            const { data: { session } } = await supabase.auth.getSession();

            // Prevent redundant initialization if we already have this session
            if (session?.access_token === lastSessionTokenRef.current) {
                setLoading(false);
                return;
            }

            setSession(session);
            lastSessionTokenRef.current = session?.access_token || null;

            let currentIsScoped = false;
            let currentScopedId: string | null = null;

            // 2. If session exists, determine scope LOCALLY first
            if (session && session.user && session.user.id) {
                try {
                    const { data: matchedCustomers, error } = await supabase.from('customers').select('id').eq('user_id', session.user.id).limit(1);
                    if (!error && matchedCustomers && matchedCustomers.length > 0) {
                        currentIsScoped = true;
                        currentScopedId = matchedCustomers[0].id;
                    }
                } catch (err) {
                    console.error('Error checking scoped customer', err);
                }

                // 3. Update State (these are async, so we can't use them in the next line)
                setIsScopedCustomer(currentIsScoped);
                setScopedCustomerId(currentScopedId);

                // 4. Fetch data using the LOCALLY calculated variables
                try {
                    await fetchData(currentIsScoped, currentScopedId);
                } catch (err) {
                    console.error('Error in fetchData during initialization', err);
                }

                // Seniority List fetch
                try {
                    await fetchSeniorityList(session, currentIsScoped);
                } catch (err) {
                    console.error('Error in fetchSeniorityList during initialization', err);
                }
            }
        } catch (err) {
            console.error('Error initializing session', err);
        } finally {
            setLoading(false);
        }
    };

    initializeSession();

    // Event Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        // Check if the token actually changed to avoid infinite loops on TOKEN_REFRESHED
        const newToken = session?.access_token || null;
        if (newToken === lastSessionTokenRef.current && _event === 'TOKEN_REFRESHED') {
            return;
        }

        lastSessionTokenRef.current = newToken;

        if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
            setSession(session);

            // Check scope again locally for the new session
            let currentIsScoped = false;
            let currentScopedId: string | null = null;

            if (session && session.user && session.user.id) {
                try {
                    const { data: matchedCustomers, error } = await supabase.from('customers').select('id').eq('user_id', session.user.id).limit(1);
                    if (!error && matchedCustomers && matchedCustomers.length > 0) {
                        currentIsScoped = true;
                        currentScopedId = matchedCustomers[0].id;
                    }
                } catch (err) {
                    console.error('Error checking scoped customer on signin', err);
                }

                setIsScopedCustomer(currentIsScoped);
                setScopedCustomerId(currentScopedId);

                // Pass calculated values to fetch immediately
                await fetchData(currentIsScoped, currentScopedId);
                await fetchSeniorityList(session, currentIsScoped);
            }
        } else if (_event === 'SIGNED_OUT') {
            setSession(null);
            lastSessionTokenRef.current = null;
            clearClientCache();
        }
    });

    return () => {
        subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Dependency array is explicitly empty to run only on mount

// ... [Rest of the component remains unchanged: signIn, signOut, adds, deletes, etc.] ...

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
        clearClientCache();
    } catch (error) {
        throw new Error(parseSupabaseError(error, 'signing out'));
    }
};

const addCustomer = async (customerData: Omit<NewCustomer, 'user_id'>): Promise<Customer> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot add customers');
    try {
        const { data, error } = await supabase.from('customers').insert([customerData] as any).select().single();
        if (error || !data) throw error;

        // Trigger background user creation without blocking the customer add flow.
        try {
            (async () => {
                try {
                    const createUrl = `/.netlify/functions/create-user-from-customer?_=${Date.now()}`;
                    const resp = await fetch(createUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
                        body: JSON.stringify({
                            customer_id: data.id,
                            name: customerData.name,
                            phone: customerData.phone,
                        }),
                    });

                    if (!resp.ok) {
                        const errData = await resp.json().catch(() => ({}));
                        console.warn('⚠️  Background user creation failed:', errData.error || resp.statusText);
                        try {
                            if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('background-user-create', {
                                    detail: { status: 'error', customer_id: data.id, message: errData.error || resp.statusText }
                                }));
                            }
                        } catch (e) { }
                    } else {
                        const successData = await resp.json().catch(() => ({}));
                        console.log('✅ Background user auto-created:', successData.user_id || '<unknown>');
                        try {
                            if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('background-user-create', {
                                    detail: { status: 'success', customer_id: data.id, user_id: successData.user_id, message: 'User created successfully' }
                                }));
                            }
                        } catch (e) { }
                    }
                } catch (err) {
                    console.warn('⚠️  Error during background user creation:', err);
                }
            })();
        } catch (userCreateError) {
            console.warn('⚠️  Failed to schedule background user creation:', userCreateError);
        }

        await fetchData();
        return data as Customer;
    } catch (error) {
        throw new Error(parseSupabaseError(error, 'adding customer'));
    }
};

const addLoan = async (loanData: NewLoan): Promise<Loan> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot add loans');
    try {
        const { data, error } = await supabase.from('loans').insert([loanData] as any).select().single();
        if (error || !data) throw error;
        try {
            if (session?.user?.id && data.customer_id) {
                await supabase.from('loan_seniority').delete().match({ customer_id: data.customer_id, user_id: session.user.id });
            }
        } catch (e) {
            console.error('Failed to cleanup loan_seniority after loan create', e);
        }
        await fetchData();
        return data as Loan;
    } catch (error) {
        throw new Error(parseSupabaseError(error, 'adding loan'));
    }
};

const addSubscription = async (subscriptionData: NewSubscription): Promise<Subscription> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot add subscriptions');
    try {
        const { data, error } = await supabase.from('subscriptions').insert([subscriptionData] as any).select().single();
        if (error || !data) throw error;
        try {
            if (session?.user?.id && data.customer_id) {
                await supabase.from('loan_seniority').delete().match({ customer_id: data.customer_id, user_id: session.user.id });
            }
        } catch (e) {
            console.error('Failed to cleanup loan_seniority after subscription create', e);
        }
        await fetchData();
        return data as Subscription;
    } catch (error) {
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
    } catch (error) {
        throw new Error(parseSupabaseError(error, 'adding installment'));
    }
};

const deleteCustomer = async (customerId: string): Promise<void> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot delete customers');
    try {
        let customerUserId: string | null = null;
        try {
            const { data: custData, error: custFetchErr } = await supabase.from('customers').select('user_id').eq('id', customerId).limit(1);
            if (!custFetchErr && custData && custData.length > 0) {
                customerUserId = (custData[0] as any).user_id || null;
            }
        } catch (e) {
            console.warn('Failed to fetch customer user_id before delete', e);
        }

        try {
            const optimisticLoanIds = loans.filter(l => l.customer_id === customerId).map(l => l.id);
            setCustomers(prev => prev.filter(c => c.id !== customerId));
            setLoans(prev => prev.filter(l => l.customer_id !== customerId));
            setSubscriptions(prev => prev.filter(s => s.customer_id !== customerId));
            setInstallments(prev => prev.filter(i => !optimisticLoanIds.includes(i.loan_id)));
            setDataEntries(prev => prev.filter(d => d.customer_id !== customerId));
        } catch (e) { }

        if (customerUserId) {
            try {
                const deleteUrl = `/.netlify/functions/delete-user-from-customer?_=${Date.now()}`;
                const resp = await fetch(deleteUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
                    body: JSON.stringify({ customer_id: customerId, user_id: customerUserId }),
                });
                if (!resp.ok) {
                    const errData = await resp.json().catch(() => ({}));
                    console.warn('Warning: failed to delete linked auth user:', errData.error || resp.statusText);
                } else {
                    console.log('✅ Linked auth user deleted for customer', customerId);
                }
            } catch (e) {
                console.warn('Warning: error calling delete-user-from-customer function', e);
            }
        }

        const { error: delDataErr } = await supabase.from('data_entries').delete().eq('customer_id', customerId);
        if (delDataErr) throw delDataErr;

        const { data: loansForCustomer, error: loansFetchError } = await supabase.from('loans').select('id').eq('customer_id', customerId);
        if (loansFetchError) throw loansFetchError;
        const loanIds = (loansForCustomer || []).map((l: any) => l.id);
        if (loanIds.length > 0) {
            const { error: delInstallErr } = await supabase.from('installments').delete().in('loan_id', loanIds);
            if (delInstallErr) throw delInstallErr;
            const { error: delLoanErr } = await supabase.from('loans').delete().in('id', loanIds);
            if (delLoanErr) throw delLoanErr;
        }

        const { error: delSubErr } = await supabase.from('subscriptions').delete().eq('customer_id', customerId);
        if (delSubErr) throw delSubErr;

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
    } catch (error) {
        throw new Error(parseSupabaseError(error, `deleting loan ${loanId}`));
    }
};

const deleteSubscription = async (subscriptionId: string): Promise<void> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot delete subscriptions');
    try {
        const { error } = await supabase.from('subscriptions').delete().eq('id', subscriptionId);
        if (error) throw error;
        await fetchData();
    } catch (error) {
        throw new Error(parseSupabaseError(error, `deleting subscription ${subscriptionId}`));
    }
};

const deleteInstallment = async (installmentId: string): Promise<void> => {
    if (isScopedCustomer) throw new Error('Read-only access: scoped customers cannot delete installments');
    try {
        const { data, error } = await supabase.from('installments').delete().eq('id', installmentId);
        if (error) throw error;
        await fetchData();
    } catch (error) {
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
