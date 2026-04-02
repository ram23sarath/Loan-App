import { supabase } from './supabase';
import type { Customer, CustomerInterest, DataEntry, Installment, LoanWithCustomer, SubscriptionWithCustomer } from '../types';

export type AppDataSnapshot = {
  customers: Customer[];
  loans: LoanWithCustomer[];
  subscriptions: SubscriptionWithCustomer[];
  installments: Installment[];
  dataEntries: DataEntry[];
  customerInterest: CustomerInterest[];
};

type LoaderOptions = {
  isScoped: boolean;
  scopedCustomerId: string | null;
};

const inflightDataLoads = new Map<string, Promise<AppDataSnapshot>>();

type RangeQueryResult<T> = Promise<{ data: T[] | null; error: { message: string } | null }>;

const fetchAllRecords = async <T,>(queryFactory: () => { range: (from: number, to: number) => RangeQueryResult<T> }, tableName: string): Promise<T[]> => {
  const PAGE_SIZE = 1000;
  let offset = 0;
  const allData: T[] = [];
  while (true) {
    const { data, error } = await queryFactory().range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Error fetching ${tableName}: ${error.message}`);
    const rows = (data as T[]) || [];
    allData.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return allData;
};

export const resolveScopedCustomer = async (userId: string) => {
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .limit(1);
  if (error) throw error;
  const scopedCustomerId = data?.[0]?.id ?? null;
  return { isScoped: Boolean(scopedCustomerId), scopedCustomerId };
};

export const loadAppData = async ({ isScoped, scopedCustomerId }: LoaderOptions): Promise<AppDataSnapshot> => {
  const cacheKey = isScoped && scopedCustomerId ? `scoped:${scopedCustomerId}` : 'admin';
  const existing = inflightDataLoads.get(cacheKey);
  if (existing) return existing;

  const promise = (async (): Promise<AppDataSnapshot> => {
    if (isScoped && scopedCustomerId) {
      const [customerRes, loansRes, subsRes, dataEntriesRes, customerInterestRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', scopedCustomerId).is('deleted_at', null).limit(1),
        supabase.from('loans').select('*, customers(name, phone)').eq('customer_id', scopedCustomerId).is('deleted_at', null),
        supabase.from('subscriptions').select('*, customers(name, phone)').eq('customer_id', scopedCustomerId).is('deleted_at', null).order('date', { ascending: true }),
        supabase.from('data_entries').select('*').eq('customer_id', scopedCustomerId).is('deleted_at', null),
        supabase.from('customer_interest').select('*').eq('customer_id', scopedCustomerId).limit(1),
      ]);
      if (customerRes.error) throw customerRes.error;
      if (loansRes.error) throw loansRes.error;
      if (subsRes.error) throw subsRes.error;
      if (dataEntriesRes.error) throw dataEntriesRes.error;
      if (customerInterestRes.error) throw customerInterestRes.error;
      const loans = (loansRes.data as unknown as LoanWithCustomer[]) || [];
      const loanIds = loans.map((loan) => loan.id);
      let installments: Installment[] = [];
      if (loanIds.length > 0) {
        const { data, error } = await supabase.from('installments').select('*').in('loan_id', loanIds).is('deleted_at', null);
        if (error) throw error;
        installments = (data as Installment[]) || [];
      }
      return {
        customers: (customerRes.data as unknown as Customer[]) || [],
        loans,
        subscriptions: (subsRes.data as unknown as SubscriptionWithCustomer[]) || [],
        installments,
        dataEntries: (dataEntriesRes.data as DataEntry[]) || [],
        customerInterest: (customerInterestRes.data as CustomerInterest[]) || [],
      };
    }

    const fetchCustomerInterestRows = async () =>
      fetchAllRecords<CustomerInterest>(
        () =>
          supabase
            .from('customer_interest')
            .select('*')
            .order('updated_at', { ascending: false }),
        'customer_interest',
      );

    const [customers, loans, subscriptions, installments, dataEntries, customerInterest] = await Promise.all([
      fetchAllRecords<Customer>(() => supabase.from('customers').select('*').is('deleted_at', null).order('created_at', { ascending: false }), 'customers'),
      fetchAllRecords<LoanWithCustomer>(() => supabase.from('loans').select('*, customers(name, phone)').is('deleted_at', null).order('created_at', { ascending: false }), 'loans'),
      fetchAllRecords<SubscriptionWithCustomer>(() => supabase.from('subscriptions').select('*, customers(name, phone)').is('deleted_at', null).order('created_at', { ascending: false }), 'subscriptions'),
      fetchAllRecords<Installment>(() => supabase.from('installments').select('*').is('deleted_at', null).order('created_at', { ascending: false }), 'installments'),
      fetchAllRecords<DataEntry>(() => supabase.from('data_entries').select('*').is('deleted_at', null).order('date', { ascending: false }), 'data_entries'),
      fetchCustomerInterestRows(),
    ]);
    return { customers, loans, subscriptions, installments, dataEntries, customerInterest };
  })();

  inflightDataLoads.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflightDataLoads.delete(cacheKey);
  }
};

export const loadGlobalSummaryRecords = async () => {
  const { loans, subscriptions, installments, dataEntries } = await loadAppData({ isScoped: false, scopedCustomerId: null });
  return { loans, subscriptions, installments, dataEntries };
};
