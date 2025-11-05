import React, { useMemo, useEffect, useState } from 'react';
import PageWrapper from '../ui/PageWrapper';
import GlassCard from '../ui/GlassCard';
import { UsersIcon } from '../../constants';
import { useData } from '../../context/DataContext';
import type { Customer } from '../../types';

const LoanSeniorityPage = () => {
  const { customers, loans, subscriptions, seniorityList, fetchSeniorityList, addToSeniority, removeFromSeniority } = useData();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSeniorityList().catch(err => console.error('Failed to load seniority list', err));
  }, [fetchSeniorityList]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    // Build a set of customer IDs already in the seniority list to exclude them from suggestions
    const existingIds = new Set<string>((seniorityList || []).map((e: any) => e.customer_id));

    // Customers that have no loans and no subscriptions
    const withoutLoansOrSubs = customers.filter(c => {
      if (existingIds.has(c.id)) return false;
      const hasLoan = loans.some(l => l.customer_id === c.id);
      const hasSub = subscriptions.some(s => s.customer_id === c.id);
      return !hasLoan && !hasSub;
    });

    // If no search term, show a short list of customers without loans/subscriptions (excluding already-added)
    if (!term) return withoutLoansOrSubs.slice(0, 10);

    // Otherwise, search across the whole customers list (name or phone) but exclude already-added customers
    return customers
      .filter(c => !existingIds.has(c.id))
      .filter(c => c.name.toLowerCase().includes(term) || String(c.phone).toLowerCase().includes(term));
  }, [customers, loans, subscriptions, searchTerm, seniorityList]);


  const addCustomerToList = async (customer: Customer) => {
    try {
      await addToSeniority(customer.id);
    } catch (err) {
      alert((err as Error).message || 'Failed to add customer to seniority list');
    }
  };

  const removeFromList = async (id: string) => {
    try {
      await removeFromSeniority(id);
    } catch (err) {
      alert((err as Error).message || 'Failed to remove customer from seniority list');
    }
  };

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <UsersIcon className="w-8 h-8" />
          Loan Seniority
        </h2>
      </div>

      <GlassCard className="mb-6 !p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            className="flex-1 bg-white border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search customers by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

          <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Search results</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-sm text-gray-500">No customers found.</div>
            ) : (
              filtered.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-white border border-gray-100 rounded p-2">
                  <div>
                    <div className="font-semibold text-indigo-700">{c.name}</div>
                    <div className="text-sm text-gray-500">{c.phone}</div>
                  </div>
                  <button
                    onClick={() => addCustomerToList(c)}
                    className="px-3 py-1 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                  >
                    Add
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </GlassCard>

      <GlassCard className="!p-4">
        <h3 className="text-xl font-bold mb-3">Loan Seniority List</h3>
        {(!seniorityList || seniorityList.length === 0) ? (
          <div className="text-sm text-gray-500">No customers added yet. Search above and click Add to include a customer.</div>
        ) : (
          <div className="space-y-2">
            {seniorityList.map((entry: any) => (
              <div key={entry.id} className="flex items-center justify-between bg-white border border-gray-100 rounded p-2">
                <div>
                  <div className="font-semibold text-indigo-700">{entry.customers?.name || 'Unknown'}</div>
                  <div className="text-sm text-gray-500">{entry.customers?.phone || ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => removeFromList(entry.id)} className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </PageWrapper>
  );
};

export default LoanSeniorityPage;
