import React, { useMemo, useState } from 'react';
import PageWrapper from '../ui/PageWrapper';
import GlassCard from '../ui/GlassCard';
import { UsersIcon } from '../../constants';
import { useData } from '../../context/DataContext';
import type { Customer } from '../../types';

const LoanSeniorityPage = () => {
  const { customers } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [seniorityList, setSeniorityList] = useState<Customer[]>([]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return customers.slice(0, 10);
    return customers.filter(c => c.name.toLowerCase().includes(term) || c.phone.includes(term));
  }, [customers, searchTerm]);

  const addCustomerToList = (customer: Customer) => {
    if (seniorityList.some(c => c.id === customer.id)) return;
    setSeniorityList(prev => [customer, ...prev]);
  };

  const removeFromList = (id: string) => {
    setSeniorityList(prev => prev.filter(c => c.id !== id));
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
        {seniorityList.length === 0 ? (
          <div className="text-sm text-gray-500">No customers added yet. Search above and click Add to include a customer.</div>
        ) : (
          <div className="space-y-2">
            {seniorityList.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-white border border-gray-100 rounded p-2">
                <div>
                  <div className="font-semibold text-indigo-700">{c.name}</div>
                  <div className="text-sm text-gray-500">{c.phone}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => removeFromList(c.id)} className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700">Remove</button>
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
