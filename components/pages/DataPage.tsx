import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { PencilIcon, Trash2Icon } from '../../constants';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../context/DataContext';
import { formatDate } from '../../utils/dateFormatter';
import { useDebounce } from '../../utils/useDebounce';

const DataPage = () => {
  const { customers = [], dataEntries = [], addDataEntry, deleteDataEntry, updateDataEntry, isScopedCustomer, scopedCustomerId } = useData();

  // State for the edit modal (full entry edit)
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [editEntryForm, setEditEntryForm] = useState({
    customerId: '',
    date: '',
    amount: '',
    type: 'credit',
    subtype: '',
    receipt: '',
    notes: '',
  });
  const [editEntryLoading, setEditEntryLoading] = useState(false);

  // Open the edit modal for a full data entry
  const openEditEntry = (entry: any) => {
    setEditEntryForm({
      customerId: entry.customer_id || '',
      date: entry.date || '',
      amount: entry.amount?.toString() || '',
      type: entry.type || 'credit',
      subtype: entry.subtype || '',
      receipt: entry.receipt_number || '',
      notes: entry.notes || '',
    });
    setEditEntryId(entry.id);
    // small timeout for focus stability on mobile
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('#edit-amount');
      try { el?.focus(); } catch (e) { /* ignore */ }
    }, 120);
  };

  // State for the customer filter/dropdown in the form
  const [customerFilter, setCustomerFilter] = useState('');
  const debouncedCustomerFilter = useDebounce(customerFilter, 300);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Form state
  const [form, setForm] = useState({
    customerId: '',
    date: '',
    amount: '',
    type: 'credit',
    subtype: '',
    receipt: '',
    notes: '',
  });

  // UI state
  const [showTable, setShowTable] = useState(isScopedCustomer ? true : false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const notesRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // --- LOGIC FIX & OPTIMIZATION ---
  // Create a performant customer lookup map to avoid using .find() in a loop.
  const customerMap = useMemo(() => {
    return new Map(customers.map(c => [c.id, c.name]));
  }, [customers]);

  // Filter data entries by scoped customer if applicable
  const displayedDataEntries = useMemo(() => {
    if (isScopedCustomer && scopedCustomerId) {
      return dataEntries.filter(entry => entry.customer_id === scopedCustomerId);
    }
    return dataEntries;
  }, [dataEntries, isScopedCustomer, scopedCustomerId]);

  // Pagination logic
  const totalPages = Math.ceil(displayedDataEntries.length / itemsPerPage);
  const paginatedEntries = useMemo(() => {
    return displayedDataEntries.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [displayedDataEntries, currentPage, itemsPerPage]);

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [displayedDataEntries.length]);

  // Memoized list of customers for the form's dropdown
  const filteredCustomers = useMemo(() => {
    if (!debouncedCustomerFilter) return customers;
    return customers.filter(c => c.name.toLowerCase().includes(debouncedCustomerFilter.toLowerCase()));
  }, [customers, debouncedCustomerFilter]);

  // Note: `filteredEntries` is removed as the table will now just show all `dataEntries`
  // Filtering is now handled by a dedicated search bar if needed, or not at all.
  // For this correction, we will display all entries as the original filtering was flawed.

  // --- EFFECTS ---
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // Focus the edit amount input after the modal opens.
  useEffect(() => {
    if (!editEntryId) return;
    const t = setTimeout(() => {
      try { document.querySelector<HTMLInputElement>('#edit-amount')?.focus(); } catch (e) { /* ignore */ }
    }, 80);
    return () => clearTimeout(t);
  }, [editEntryId]);

  useEffect(() => {
    if (!showCustomerDropdown) return;
    function handleClickOutside(event: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCustomerDropdown]);

  useEffect(() => {
    const handleClickOutsideNotes = (event: MouseEvent) => {
      if (expandedNoteId && notesRefs.current[expandedNoteId] && !notesRefs.current[expandedNoteId]?.contains(event.target as Node)) {
        setExpandedNoteId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideNotes);
    return () => document.removeEventListener('mousedown', handleClickOutsideNotes);
  }, [expandedNoteId]);


  // --- HANDLERS ---
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target as HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement;
    setForm(prevForm => {
      // If the user switches the type to credit, ensure we don't keep a Subscription subtype (Subscription should be hidden for credits)
      if (name === 'type') {
        const newType = value;
        if (newType === 'credit' && prevForm.subtype === 'Subscription Return') {
          return { ...prevForm, type: newType, subtype: '' };
        }
        return { ...prevForm, type: newType };
      }
      return { ...prevForm, [name]: value };
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // --- LOGIC FIX ---
    // Added direct validation instead of relying on a hidden select element.
    if (!form.customerId) {
      setToastMsg('Please select a customer.');
      setShowToast(true);
      return;
    }
    try {
      await addDataEntry({
        customer_id: form.customerId,
        date: form.date,
        amount: Number(form.amount),
        type: form.type,
        subtype: form.subtype,
        receipt_number: form.receipt,
        notes: form.notes,
      });
      setForm({ customerId: '', date: '', amount: '', type: 'credit', subtype: '', receipt: '', notes: '' });
      setToastMsg('Entry added successfully!');
      setShowToast(true);
    } catch (err: any) {
      setToastMsg(err.message || 'Failed to add data entry.');
      setShowToast(true);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      try {
        await deleteDataEntry(deleteId);
        setToastMsg('Entry deleted successfully.');
        setShowToast(true);
      } catch (err: any) {
        setToastMsg(err.message || 'Failed to delete entry.');
        setShowToast(true);
      } finally {
        setDeleteId(null);
      }
    }
  };

  // Save full entry edits
  const handleSaveEditEntry = async () => {
    if (!editEntryId) return;
    setEditEntryLoading(true);
    try {
      await updateDataEntry(editEntryId, {
        customer_id: editEntryForm.customerId,
        date: editEntryForm.date,
        amount: Number(editEntryForm.amount),
        type: editEntryForm.type,
        subtype: editEntryForm.subtype || null,
        receipt_number: editEntryForm.receipt,
        notes: editEntryForm.notes,
      });
      setEditEntryId(null);
      setToastMsg('Entry updated successfully.');
      setShowToast(true);
    } catch (err: any) {
      setToastMsg(err?.message || 'Failed to update entry.');
      setShowToast(true);
    } finally {
      setEditEntryLoading(false);
    }
  };

  const handleNoteClick = (id: string) => {
    setExpandedNoteId(expandedNoteId === id ? null : id);
  };

  // --- STYLES & VARIANTS ---
  const inputBaseStyle = "w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow";
  const dateInputStyle = "w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow text-base bg-white block";
  const dateInputInlineStyles = { minHeight: '42px', WebkitAppearance: 'none' as const };
  const labelBaseStyle = "block mb-2 text-sm font-medium text-gray-700";
  const viewVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }, exit: { opacity: 0, y: -20, transition: { duration: 0.3, ease: 'easeIn' } } };
  const modalVariants = { hidden: { scale: 0.9, opacity: 0 }, visible: { scale: 1, opacity: 1 }, exit: { scale: 0.95, opacity: 0 } };
  const toastVariants = { hidden: { opacity: 0, x: "100%" }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 150, damping: 20 } }, exit: { opacity: 0, x: "100%", transition: { ease: "easeIn", duration: 0.4 } } };
  const dropdownVariants = { hidden: { opacity: 0, y: -10 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } };

  return (
    <div className="w-full max-w-7xl mx-auto my-8 flex justify-center md:min-h-[calc(100vh-4rem)] md:items-start">
      <motion.div layout transition={{ type: 'spring', stiffness: 280, damping: 30 }} className={`bg-white rounded-xl shadow-md flex flex-col gap-6 border border-gray-200/80 mx-auto ${showTable ? 'p-6 md:p-8 w-[90%] md:w-full md:max-w-full max-w-md' : 'p-6 md:p-8 w-[90%] max-w-md md:max-w-2xl md:min-h-[calc(100vh-4rem)]'}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
          <h2 className="text-xl md:text-2xl font-bold text-indigo-700 md:uppercase md:tracking-widest whitespace-normal break-words">
            {showTable ? 'All Entries' : 'New Data Entry'}
          </h2>
          <div className="w-full md:w-auto">
            <button
              type="button"
              disabled={isScopedCustomer}
              className={`w-full md:w-auto px-4 py-2 rounded-lg font-semibold transition-colors duration-200 text-center mt-2 md:mt-0 ${isScopedCustomer
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                }`}
              onClick={() => {
                setShowTable(v => !v);
                // --- LOGIC FIX ---
                // Reset the filter when toggling views to prevent confusion.
                setCustomerFilter('');
              }}
            >
              {showTable ? 'Add Data Entry' : 'View All Entries'}
            </button>
          </div>
        </div>

        <div className={`w-full min-h-[300px] md:min-h-[500px] relative flex-1 flex flex-col ${showTable ? 'px-2' : ''}`}>
          <AnimatePresence mode="wait">
            {showTable ? (
              <motion.div key="table" variants={viewVariants} initial="hidden" animate="visible" exit="exit">
                <div className="w-full border border-gray-200 rounded-lg overflow-hidden">
                  {/* Desktop Table */}
                  <table className="hidden md:table w-full" style={{ tableLayout: 'auto' }}>
                    <thead className="bg-indigo-50">
                      <tr className="text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">
                        <th className="px-4 py-3 resize-x overflow-auto cursor-col-resize" style={{ minWidth: '40px' }}>#</th>
                        <th className="px-4 py-3 resize-x overflow-auto cursor-col-resize" style={{ minWidth: '80px' }}>Name</th>
                        <th className="px-4 py-3 text-center resize-x overflow-auto cursor-col-resize" style={{ minWidth: '80px' }}>Date</th>
                        <th className="px-4 py-3 text-center resize-x overflow-auto cursor-col-resize" style={{ minWidth: '60px' }}>Type</th>
                        <th className="px-4 py-3 resize-x overflow-auto cursor-col-resize" style={{ minWidth: '80px' }}>Subtype</th>
                        <th className="px-4 py-3 resize-x overflow-auto cursor-col-resize" style={{ minWidth: '80px' }}>Amount</th>
                        <th className="px-4 py-3 resize-x overflow-auto cursor-col-resize" style={{ minWidth: '70px' }}>Receipt #</th>
                        <th className="px-4 py-3 resize-x overflow-auto cursor-col-resize" style={{ minWidth: '150px' }}>Notes</th>
                        <th className="px-4 py-3 text-center text-red-600" style={{ minWidth: '100px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {displayedDataEntries.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center text-gray-500 py-16 text-base">
                            {isScopedCustomer && scopedCustomerId
                              ? (() => {
                                const customerName = customerMap.get(scopedCustomerId);
                                return `No Entries for ${customerName || 'you'} yet!`;
                              })()
                              : 'No data entries found.'}
                          </td>
                        </tr>
                      ) : (
                        paginatedEntries.map((entry, idx) => {
                          const customerName = customerMap.get(entry.customer_id) || 'Unknown';
                          const isExpanded = expandedNoteId === entry.id;
                          const actualIndex = (currentPage - 1) * itemsPerPage + idx + 1;
                          return (
                            <tr
                              key={`desktop-${entry.id}`}
                              className="border-b border-gray-200 last:border-b-0 hover:bg-indigo-50/50 text-sm align-top"
                            >
                              <td className="px-4 py-3 text-gray-500 text-left">{actualIndex}</td>
                              <td className="px-4 py-3 font-medium text-gray-900 text-left">{customerName}</td>
                              <td className="px-4 py-3 text-gray-600 text-center">{formatDate(entry.date)}</td>
                              <td className="px-4 py-3 text-center">
                                {entry.type === 'credit' ? (
                                  <span className="inline-block px-2 py-1 rounded-full bg-green-100 text-green-800 font-semibold text-xs">Credit</span>
                                ) : (
                                  <span className="inline-block px-2 py-1 rounded-full bg-red-100 text-red-800 font-semibold text-xs">Expense</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-left">{entry.subtype || '-'}</td>
                              <td className={`px-4 py-3 font-bold text-left ${entry.type === 'credit' ? 'text-green-700' : 'text-red-700'}`}>{entry.type === 'credit' ? '+' : ''}₹{entry.amount.toLocaleString()}</td>
                              <td className="px-4 py-3 text-gray-600 text-left">{entry.receipt_number || '-'}</td>
                              <td ref={(el) => (notesRefs.current[entry.id] = el)} className="px-4 py-3 text-gray-600 text-left">
                                <div className={`cursor-pointer break-words whitespace-pre-wrap ${!isExpanded ? 'line-clamp-2' : ''}`} onClick={() => handleNoteClick(entry.id)}>
                                  {entry.notes || '-'}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button type="button" className="px-2 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700" aria-label="Edit entry" onClick={(e) => { e.stopPropagation(); openEditEntry(entry); }}>
                                    Edit
                                  </button>
                                  <button type="button" className="p-1 rounded-full hover:bg-red-500/10 transition-colors" onClick={(e) => { e.stopPropagation(); handleDeleteClick(entry.id); }}>
                                    <Trash2Icon className="w-5 h-5 text-red-500" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                  
                  {/* Mobile Cards */}
                  <div className="md:hidden bg-white">
                    {displayedDataEntries.length === 0 ? (
                      <div className="text-center text-gray-500 py-16 text-base">
                        {isScopedCustomer && scopedCustomerId
                          ? (() => {
                            const customerName = customerMap.get(scopedCustomerId);
                            return `No Entries for ${customerName || 'you'} yet!`;
                          })()
                          : 'No data entries found.'}
                      </div>
                    ) : (
                      paginatedEntries.map((entry, idx) => {
                        const customerName = customerMap.get(entry.customer_id) || 'Unknown';
                        const actualIndex = (currentPage - 1) * itemsPerPage + idx + 1;
                        return (
                          <div
                            key={`mobile-${entry.id}`}
                            className="px-4 py-4 border-b last:border-b-0 hover:bg-indigo-50/30"
                          >
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 truncate"><span className="text-gray-400 font-normal">#{actualIndex}</span> {customerName}</div>
                                <div className="text-sm text-gray-600 truncate">{entry.subtype || entry.type}</div>
                              </div>
                              <div className={`ml-2 text-right font-bold text-base ${entry.type === 'credit' ? 'text-green-700' : 'text-red-700'}`}>{entry.type === 'credit' ? '+' : ''}₹{entry.amount.toLocaleString()}</div>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                              <div>{formatDate(entry.date)}</div>
                              <div className="flex items-center gap-3">
                                {entry.receipt_number && <div className="px-2 py-1 bg-gray-100 rounded text-xs">#{entry.receipt_number}</div>}
                                <button type="button" className="px-3 py-1 rounded bg-blue-600 text-white text-sm" aria-label="Edit entry" onClick={(e) => { e.stopPropagation(); openEditEntry(entry); }}>
                                  Edit
                                </button>
                                <button aria-label="Delete entry" type="button" className="p-2 rounded-md bg-red-50 text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteClick(entry.id); }}>
                                  <Trash2Icon className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                            {entry.notes && (
                              <div className="mt-3 pt-3 border-t border-gray-200/80">
                                <p className="text-sm text-gray-700 break-words">{entry.notes}</p>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(currentPage * itemsPerPage, displayedDataEntries.length)} of{" "}
                      {displayedDataEntries.length} entries
                    </div>
                    <div className="flex gap-2 flex-wrap justify-center">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        First
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      
                      {/* Page numbers */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        // Show first, last, current, and neighbors
                        if (
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1
                        ) {
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-1 rounded border ${
                                currentPage === page
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              {page}
                            </button>
                          );
                        }
                        // Show dots for skipped pages
                        if (page === 2 && currentPage > 3) {
                          return <span key="dots-start" className="px-2">...</span>;
                        }
                        if (page === totalPages - 1 && currentPage < totalPages - 2) {
                          return <span key="dots-end" className="px-2">...</span>;
                        }
                        return null;
                      })}
                      
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="form" variants={viewVariants} initial="hidden" animate="visible" exit="exit" className="w-full h-full flex flex-col">
                {isScopedCustomer ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <p className="text-gray-600 text-lg mb-4">You don't have permission to add data entries.</p>
                    <p className="text-gray-500">As a customer, you can only view your own entries.</p>
                  </div>
                ) : (
                  <form className="flex flex-col gap-4 w-full p-1 pb-2 flex-1" onSubmit={handleSubmit}>
                    <div className="relative" ref={customerDropdownRef}>
                      <label htmlFor="customer-btn" className={labelBaseStyle}>Name</label>
                      <button id="customer-btn" type="button" className={`${inputBaseStyle} flex justify-between items-center text-left bg-white`} onClick={() => setShowCustomerDropdown(v => !v)}>
                        {form.customerId ? (customerMap.get(form.customerId) || 'Select Customer') : 'Select Customer'}
                        <svg className="w-4 h-4 ml-2 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      <AnimatePresence>
                        {showCustomerDropdown && (
                          <motion.div variants={dropdownVariants} initial="hidden" animate="visible" exit="exit" className="absolute top-full left-0 z-20 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-52 overflow-y-auto mt-1">
                            <div className="p-2 sticky top-0 bg-white z-10 border-b border-gray-200">
                              <input type="text" placeholder="Search customer..." value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} className="p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm w-full" autoFocus />
                            </div>
                            {filteredCustomers.length === 0 ? (
                              <div className="p-2 text-gray-400 text-sm">No customers found.</div>
                            ) : (
                              filteredCustomers.map((c) => (
                                <div key={c.id} className={`p-2 cursor-pointer hover:bg-indigo-100 text-sm ${form.customerId === c.id ? 'bg-indigo-50 font-semibold' : ''}`} onClick={() => { setForm({ ...form, customerId: c.id }); setShowCustomerDropdown(false); setCustomerFilter(''); }}>
                                  {c.name}
                                </div>
                              ))
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div>
                      <label htmlFor="date" className={labelBaseStyle}>Date</label>
                      <input type="date" id="date" name="date" value={form.date} onChange={handleChange} className={dateInputStyle} style={dateInputInlineStyles} required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                      <div className="md:col-span-2">
                        <label htmlFor="type" className={labelBaseStyle}>Type</label>
                        <select id="type" name="type" value={form.type} onChange={handleChange} className={`${inputBaseStyle} bg-white`} required>
                          <option value="credit">Credit</option>
                          <option value="expenditure">Expenditure</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="subtype" className={labelBaseStyle}>Subtype</label>
                        <select id="subtype" name="subtype" value={form.subtype} onChange={handleChange} className={`${inputBaseStyle} bg-white`}>
                          <option value="">None</option>
                          {/* Show Subscription only when type is NOT credit (hidden for credit entries) */}
                          {form.type !== 'credit' && <option value="Subscription Return">Subscription Return</option>}
                          <option value="Retirement Gift">Retirement Gift</option>
                          <option value="Death Fund">Death Fund</option>
                          <option value="Misc Expense">Misc Expense</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="amount" className={labelBaseStyle}>Amount</label>
                        <input type="number" id="amount" name="amount" value={form.amount} onChange={handleChange} className={inputBaseStyle} required min="0" placeholder="e.g. 5000" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="receipt" className={labelBaseStyle}>Receipt Number <span className="text-gray-400 font-normal">(Optional)</span></label>
                      <input type="text" id="receipt" name="receipt" value={form.receipt} onChange={handleChange} className={inputBaseStyle} />
                    </div>
                    <div>
                      <label htmlFor="notes" className={labelBaseStyle}>Notes <span className="text-gray-400 font-normal">(Optional)</span></label>
                      <textarea id="notes" name="notes" value={form.notes} onChange={handleChange} className={`${inputBaseStyle} min-h-[80px] resize-y`} rows={2} placeholder="Enter any notes..." />
                    </div>
                    <button type="submit" className="w-full mt-2 bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 transition-colors duration-300 focus:outline-none focus:ring-4 focus:ring-indigo-300">Submit Entry</button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* --- LOGIC FIX --- */}
      {/* Modals are moved here to the top level. They are no longer rendered inside a loop. */}
      {/* This fixes both the performance issue and the broken table layout. */}
      <AnimatePresence>
        {editEntryId && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div role="dialog" aria-modal="true" aria-labelledby="edit-entry-modal-title" variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white rounded-xl shadow-lg p-4 w-full max-w-sm max-h-[90vh] overflow-y-auto mx-4">
              <div id="edit-entry-modal-title" className="text-lg font-semibold text-gray-800 mb-4">Edit Entry</div>
              <div className="grid grid-cols-1 gap-3">
                <label className={labelBaseStyle}>Customer</label>
                <select name="customerId" value={editEntryForm.customerId} onChange={e => setEditEntryForm(prev => ({ ...prev, customerId: e.target.value }))} className={inputBaseStyle}>
                  <option value="">Select Customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <label className={labelBaseStyle}>Date</label>
                <input type="date" name="date" value={editEntryForm.date} onChange={e => setEditEntryForm(prev => ({ ...prev, date: e.target.value }))} className={dateInputStyle} style={dateInputInlineStyles} />

                <label className={labelBaseStyle}>Type</label>
                <select name="type" value={editEntryForm.type} onChange={e => setEditEntryForm(prev => ({ ...prev, type: e.target.value }))} className={inputBaseStyle}>
                  <option value="credit">Credit</option>
                  <option value="expenditure">Expenditure</option>
                </select>

                <label className={labelBaseStyle}>Subtype</label>
                <select name="subtype" value={editEntryForm.subtype} onChange={e => setEditEntryForm(prev => ({ ...prev, subtype: e.target.value }))} className={inputBaseStyle}>
                  <option value="">None</option>
                  {editEntryForm.type !== 'credit' && <option value="Subscription Return">Subscription Return</option>}
                  <option value="Retirement Gift">Retirement Gift</option>
                  <option value="Death Fund">Death Fund</option>
                  <option value="Misc Expense">Misc Expense</option>
                </select>

                <label className={labelBaseStyle}>Amount</label>
                <input id="edit-amount" type="number" name="amount" value={editEntryForm.amount} onChange={e => setEditEntryForm(prev => ({ ...prev, amount: e.target.value }))} className={inputBaseStyle} />

                <label className={labelBaseStyle}>Receipt Number</label>
                <input type="text" name="receipt" value={editEntryForm.receipt} onChange={e => setEditEntryForm(prev => ({ ...prev, receipt: e.target.value }))} className={inputBaseStyle} />

                <label className={labelBaseStyle}>Notes</label>
                <textarea name="notes" value={editEntryForm.notes} onChange={e => setEditEntryForm(prev => ({ ...prev, notes: e.target.value }))} className={`${inputBaseStyle} min-h-[80px]`} />
              </div>

              <div className="flex gap-3 mt-4">
                <button type="button" className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition" onClick={() => setEditEntryId(null)} disabled={editEntryLoading}>Cancel</button>
                <button type="button" className="flex-1 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition" onClick={handleSaveEditEntry} disabled={editEntryLoading}>
                  {editEntryLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteId && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div role="dialog" aria-modal="true" aria-labelledby="delete-modal-title" variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white rounded-xl shadow-lg p-6 md:p-8 w-[90%] max-w-md flex flex-col items-center">
              <div id="delete-modal-title" className="text-lg font-semibold text-gray-800 mb-4">Delete Entry?</div>
              <p className="text-gray-600 mb-6 text-center">Are you sure? This action cannot be undone.</p>
              <div className="flex gap-3 w-full">
                <button type="button" className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition" onClick={() => setDeleteId(null)}>Cancel</button>
                <button type="button" className="flex-1 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition" onClick={confirmDelete}>Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed top-4 right-4 z-50">
        <AnimatePresence>
          {showToast && (
            <motion.div variants={toastVariants} initial="hidden" animate="visible" exit="exit" className="bg-indigo-700 text-white px-6 py-3 rounded-lg shadow-lg text-base font-medium">
              {toastMsg}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DataPage;