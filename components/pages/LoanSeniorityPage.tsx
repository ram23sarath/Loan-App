import React, { useMemo, useEffect, useState } from 'react';
import PageWrapper from '../ui/PageWrapper';
import GlassCard from '../ui/GlassCard';
import { UsersIcon } from '../../constants';
import { useData } from '../../context/DataContext';
import type { Customer } from '../../types';
import { Trash2Icon, PencilIcon } from '../../constants';
import { formatDate } from '../../utils/dateFormatter';
import { useDebounce } from '../../utils/useDebounce';

const LoanSeniorityPage = () => {
  const { customers, loans, subscriptions, seniorityList, fetchSeniorityList, addToSeniority, updateSeniority, removeFromSeniority } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    fetchSeniorityList().catch(err => console.error('Failed to load seniority list', err));
  }, [fetchSeniorityList]);

  const filtered = useMemo(() => {
    const term = debouncedSearchTerm.trim().toLowerCase();

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
  }, [customers, loans, subscriptions, debouncedSearchTerm, seniorityList]);


  const addCustomerToList = async (customer: Customer) => {
    // Open entry modal to collect extra fields before adding
    setModalCustomer({ id: customer.id, name: customer.name });
    setModalEditingId(null);
  };

  const removeFromList = async (id: string) => {
    try {
      await removeFromSeniority(id);
    } catch (err) {
      alert((err as Error).message || 'Failed to remove customer from seniority list');
    }
  };

  // Modal state for entry details
  const [modalCustomer, setModalCustomer] = useState<any | null>(null);
  const [stationName, setStationName] = useState('');
  const [loanType, setLoanType] = useState('General');
  const [loanRequestDate, setLoanRequestDate] = useState('');
  const [modalEditingId, setModalEditingId] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeFromSeniority(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      alert((err as Error).message || 'Failed to remove customer from seniority list');
    }
  };

  const closeModal = () => {
    setModalCustomer(null);
    setStationName('');
    setLoanType('General');
    setLoanRequestDate('');
  };

  const saveModalEntry = async () => {
    if (!modalCustomer) return;
    try {
      const details = {
        station_name: stationName || null,
        loan_type: loanType || null,
        loan_request_date: loanRequestDate || null,
      };
      if (modalEditingId) {
        await updateSeniority(modalEditingId, details);
      } else {
        await addToSeniority(modalCustomer.id, details);
      }
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
          <div className="relative flex-1">
            <input
              className="w-full bg-white border border-gray-300 rounded-lg py-2 px-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Search customers by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Search results</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-sm text-gray-500">No customers found.</div>
            ) : (
              filtered.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-white border border-gray-100 rounded p-2">
                  <div className="min-w-0 mr-2">
                    <div className="font-semibold text-indigo-700 truncate">{c.name}</div>
                    <div className="text-sm text-gray-500">{c.phone}</div>
                  </div>
                  <button
                    onClick={() => addCustomerToList(c)}
                    className="px-3 py-1 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 shrink-0"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-md">
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
                <label className="block text-sm font-medium mb-1">Loan Type</label>
                <select value={loanType} onChange={(e) => setLoanType(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2">
                  <option value="General">General</option>
                  <option value="Medical">Medical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Loan Request Date</label>
                <input 
                  value={loanRequestDate} 
                  onChange={(e) => setLoanRequestDate(e.target.value)} 
                  type="date" 
                  className="w-full border border-gray-300 rounded px-3 py-2 text-base bg-white block"
                  style={{ minHeight: '42px', WebkitAppearance: 'none' }}
                />
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
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">#</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Customer</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Phone</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Station</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Loan Type</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Requested</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {seniorityList.map((entry: any, idx: number) => (
                    <tr key={entry.id} className="even:bg-gray-50">
                      <td className="px-4 py-3">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-indigo-700">{entry.customers?.name || 'Unknown'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{entry.customers?.phone || ''}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{entry.station_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{entry.loan_type || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{entry.loan_request_date ? formatDate(entry.loan_request_date) : '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => {
                            // open edit modal prefilled
                            setModalCustomer({ id: entry.customer_id, name: entry.customers?.name });
                            setStationName(entry.station_name || '');
                            setLoanType(entry.loan_type || 'General');
                            setLoanRequestDate(entry.loan_request_date || '');
                            setModalEditingId(entry.id);
                          }}
                            aria-label={`Edit seniority entry ${entry.id}`}
                            className="px-2 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">
                            Edit
                          </button>
                          <button onClick={() => setDeleteTarget({ id: entry.id, name: entry.customers?.name || 'Unknown' })} aria-label={`Remove seniority entry ${entry.id}`} className="p-1 rounded-full hover:bg-red-500/10 transition-colors">
                            <Trash2Icon className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {seniorityList.map((entry: any, idx: number) => (
                <div key={entry.id} className="bg-white border border-gray-100 rounded p-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="text-xs text-gray-400">#{idx + 1}</div>
                      <div className="font-semibold text-indigo-700 truncate">{entry.customers?.name || 'Unknown'}</div>
                      <div className="text-sm text-gray-500">{entry.customers?.phone || ''}</div>
                      <div className="mt-2 text-sm text-gray-600 space-y-1">
                        {entry.station_name && <div>Station: <span className="font-medium text-gray-800">{entry.station_name}</span></div>}
                        {entry.loan_type && <div>Loan Type: <span className="font-medium text-gray-800">{entry.loan_type}</span></div>}
                        {entry.loan_request_date && <div>Requested: <span className="font-medium text-gray-800">{formatDate(entry.loan_request_date)}</span></div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <button onClick={() => {
                        setModalCustomer({ id: entry.customer_id, name: entry.customers?.name });
                        setStationName(entry.station_name || '');
                        setLoanType(entry.loan_type || 'General');
                        setLoanRequestDate(entry.loan_request_date || '');
                        setModalEditingId(entry.id);
                      }} className="px-3 py-1 rounded bg-blue-600 text-white text-sm" aria-label="Edit">
                        Edit
                      </button>
                      <button onClick={() => setDeleteTarget({ id: entry.id, name: entry.customers?.name || 'Unknown' })} className="p-2 rounded-md bg-red-50 text-red-600" aria-label="Remove">
                        <Trash2Icon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </GlassCard>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 md:p-8 w-[90%] max-w-md">
            <h3 className="text-lg font-bold mb-3">Remove from Seniority List?</h3>
            <p className="mb-4 text-sm text-gray-600">
              Are you sure you want to remove <span className="font-semibold">{deleteTarget.name}</span> from the seniority list?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
};

export default LoanSeniorityPage;
