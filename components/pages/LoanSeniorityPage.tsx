import React, { useMemo, useEffect, useState } from 'react';
import PageWrapper from '../ui/PageWrapper';
import GlassCard from '../ui/GlassCard';
import { UsersIcon } from '../../constants';
import { useData } from '../../context/DataContext';
import type { Customer } from '../../types';
import { formatDate } from '../../utils/dateFormatter';

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
    // Open entry modal to collect extra fields before adding
    setModalCustomer(customer);
  };

  const removeFromList = async (id: string) => {
    try {
      await removeFromSeniority(id);
    } catch (err) {
      alert((err as Error).message || 'Failed to remove customer from seniority list');
    }
  };

  // Modal state for entry details
  const [modalCustomer, setModalCustomer] = useState<Customer | null>(null);
  const [stationName, setStationName] = useState('');
  const [loanNumber, setLoanNumber] = useState('');
  const [loanRequestDate, setLoanRequestDate] = useState('');

  const closeModal = () => {
    setModalCustomer(null);
    setStationName('');
    setLoanNumber('');
    setLoanRequestDate('');
  };

  const saveModalEntry = async () => {
    if (!modalCustomer) return;
    try {
      await addToSeniority(modalCustomer.id, {
        station_name: stationName || null,
        loan_number: loanNumber || null,
        loan_request_date: loanRequestDate || null,
      });
      closeModal();
    } catch (err: any) {
      alert(err.message || 'Failed to save seniority entry');
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
                <div key={c.id} className="flex items:center justify-between bg-white border border-gray-100 rounded p-2">
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

      {/* Entry modal */}
      {modalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add Seniority Entry for {modalCustomer.name}</h3>
              <button onClick={closeModal} className="text-gray-500">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Station Name</label>
                <input value={stationName} onChange={(e) => setStationName(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Loan Number</label>
                <input value={loanNumber} onChange={(e) => setLoanNumber(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Loan Request Date</label>
                <input value={loanRequestDate} onChange={(e) => setLoanRequestDate(e.target.value)} type="date" className="w-full border border-gray-300 rounded px-3 py-2" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={closeModal} className="px-3 py-2 rounded bg-gray-200">Cancel</button>
              <button onClick={saveModalEntry} className="px-3 py-2 rounded bg-indigo-600 text-white">Save</button>
            </div>
          </div>
        </div>
      )}

      <GlassCard className="!p-4">
        <h3 className="text-xl font-bold mb-3">Loan Seniority List</h3>
        {(!seniorityList || seniorityList.length === 0) ? (
          <div className="text-sm text-gray-500">No customers added yet. Search above and click Add to include a customer.</div>
        ) : (
          <div className="space-y-2">
            {seniorityList.map((entry: any) => (
              <div key={entry.id} className="flex items-center justify-between bg-white border border-gray-100 rounded p-3">
                <div className="min-w-0">
                  <div className="font-semibold text-indigo-700 truncate">{entry.customers?.name || 'Unknown'}</div>
                  <div className="text-sm text-gray-500">{entry.customers?.phone || ''}</div>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    {entry.station_name && <div>Station: <span className="font-medium text-gray-800">{entry.station_name}</span></div>}
                    {entry.loan_number && <div>Loan #: <span className="font-medium text-gray-800">{entry.loan_number}</span></div>}
                    {entry.loan_request_date && <div>Requested: <span className="font-medium text-gray-800">{formatDate(entry.loan_request_date)}</span></div>}
                  </div>
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
