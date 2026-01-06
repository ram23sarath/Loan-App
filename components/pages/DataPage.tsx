import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { PencilIcon, Trash2Icon } from '../../constants';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../context/DataContext';
import { formatDate } from '../../utils/dateFormatter';
import { useDebounce } from '../../utils/useDebounce';
import { formatNumberIndian } from '../../utils/numberFormatter';
import PageWrapper from '../ui/PageWrapper';

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

  // State for customer list search sidebar
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const debouncedCustomerSearchTerm = useDebounce(customerSearchTerm, 300);

  // Mobile customer modal state
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [mobileCustomerSearch, setMobileCustomerSearch] = useState('');
  const debouncedMobileCustomerSearch = useDebounce(mobileCustomerSearch, 300);

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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(isScopedCustomer ? scopedCustomerId ?? null : null);
  const notesRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Sorting state
  const [sortColumn, setSortColumn] = useState<'date' | 'type' | 'subtype' | 'amount' | 'receipt' | 'notes' | null>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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

  // Group entries by customer for two-pane layout
  const customerEntryGroups = useMemo(() => {
    const map = new Map<string, { customerId: string; name: string; entries: typeof dataEntries }>();
    displayedDataEntries.forEach((entry) => {
      const key = entry.customer_id;
      if (!map.has(key)) {
        map.set(key, { customerId: key, name: customerMap.get(key) || 'Unknown', entries: [] });
      }
      map.get(key)?.entries.push(entry);
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [displayedDataEntries, customerMap]);

  // Filter customer groups by search term
  const filteredCustomerGroups = useMemo(() => {
    if (!debouncedCustomerSearchTerm.trim()) return customerEntryGroups;
    const searchLower = debouncedCustomerSearchTerm.toLowerCase();
    return customerEntryGroups.filter((group) =>
      group.name.toLowerCase().includes(searchLower)
    );
  }, [customerEntryGroups, debouncedCustomerSearchTerm]);

  // Ensure a selected customer exists whenever groups change
  useEffect(() => {
    if (!customerEntryGroups.length) {
      setSelectedCustomerId(null);
      return;
    }

    // If search is active and selected customer is not in filtered results, clear selection
    if (debouncedCustomerSearchTerm.trim()) {
      const selectedInFiltered = filteredCustomerGroups.some((g) => g.customerId === selectedCustomerId);
      if (!selectedInFiltered) {
        setSelectedCustomerId(null);
      }
      return;
    }

    // For scoped customers, auto-select their customer on load
    if (isScopedCustomer && scopedCustomerId && !selectedCustomerId) {
      setSelectedCustomerId(scopedCustomerId);
      setCurrentPage(1);
    }
    // For admin users, do NOT auto-select - let them choose a customer manually
  }, [customerEntryGroups, selectedCustomerId, filteredCustomerGroups, debouncedCustomerSearchTerm, isScopedCustomer, scopedCustomerId]);

  const selectedGroupEntries = useMemo(() => {
    if (!selectedCustomerId) return [] as typeof displayedDataEntries;
    const group = customerEntryGroups.find((g) => g.customerId === selectedCustomerId);
    return group?.entries || [];
  }, [customerEntryGroups, selectedCustomerId]);

  // Sorting logic
  const sortedEntries = useMemo(() => {
    if (!sortColumn) return selectedGroupEntries;

    const sorted = [...selectedGroupEntries].sort((a, b) => {
      let compareA: any = a[sortColumn as keyof typeof a];
      let compareB: any = b[sortColumn as keyof typeof b];

      // Handle different data types
      if (sortColumn === 'date') {
        compareA = new Date(compareA).getTime();
        compareB = new Date(compareB).getTime();
      } else if (sortColumn === 'amount') {
        compareA = Number(compareA) || 0;
        compareB = Number(compareB) || 0;
      } else if (sortColumn === 'type' || sortColumn === 'subtype' || sortColumn === 'receipt' || sortColumn === 'notes') {
        compareA = String(compareA || '').toLowerCase();
        compareB = String(compareB || '').toLowerCase();
      }

      if (compareA < compareB) return sortDirection === 'asc' ? -1 : 1;
      if (compareA > compareB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [selectedGroupEntries, sortColumn, sortDirection]);

  // Pagination logic
  const totalPages = Math.ceil(sortedEntries.length / itemsPerPage);
  const paginatedEntries = useMemo(() => {
    return sortedEntries.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [sortedEntries, currentPage, itemsPerPage]);

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortedEntries.length]);

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

  // Close edit modal with Escape (capture phase to prevent parent handlers)
  useEffect(() => {
    if (!editEntryId) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      try {
        e.stopPropagation();
        if (typeof (e as any).stopImmediatePropagation === 'function') (e as any).stopImmediatePropagation();
      } catch (_) {}
      setEditEntryId(null);
    };
    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [editEntryId]);

  // Close delete modal with Escape (capture phase)
  useEffect(() => {
    if (!deleteId) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      try {
        e.stopPropagation();
        if (typeof (e as any).stopImmediatePropagation === 'function') (e as any).stopImmediatePropagation();
      } catch (_) {}
      setDeleteId(null);
    };
    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [deleteId]);

  // Close customer modal with Escape (capture phase)
  useEffect(() => {
    if (!showCustomerModal) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      try {
        e.stopPropagation();
        if (typeof (e as any).stopImmediatePropagation === 'function') (e as any).stopImmediatePropagation();
      } catch (_) {}
      setShowCustomerModal(false);
    };
    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [showCustomerModal]);

  // Sorting handler
  const handleSortColumn = (column: 'date' | 'type' | 'subtype' | 'amount' | 'receipt' | 'notes') => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Helper function to render sort indicator
  const getSortIndicator = (column: 'date' | 'type' | 'subtype' | 'amount' | 'receipt' | 'notes') => {
    if (sortColumn !== column) return ' ↕️';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };


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
  const inputBaseStyle = "w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted";
  const dateInputStyle = "w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow text-base bg-white block dark:bg-slate-700 dark:border-dark-border dark:text-dark-text";
  const dateInputInlineStyles = { minHeight: '42px', WebkitAppearance: 'none' as const };
  const labelBaseStyle = "block mb-2 text-sm font-medium text-gray-700 dark:text-dark-text";
  const viewVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }, exit: { opacity: 0, y: -20, transition: { duration: 0.3, ease: 'easeIn' } } };
  const modalVariants = { hidden: { scale: 0.9, opacity: 0 }, visible: { scale: 1, opacity: 1 }, exit: { scale: 0.95, opacity: 0 } };
  const toastVariants = { hidden: { opacity: 0, x: "100%" }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 150, damping: 20 } }, exit: { opacity: 0, x: "100%", transition: { ease: "easeIn", duration: 0.4 } } };
  const dropdownVariants = { hidden: { opacity: 0, y: -10 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } };

  // Early return for scoped users with no entries - show simple message box
  if (isScopedCustomer && displayedDataEntries.length === 0) {
    const customerName = scopedCustomerId ? customerMap.get(scopedCustomerId) : null;
    return (
      <PageWrapper>
        <div className="w-full max-w-7xl mx-auto my-8 flex justify-center md:min-h-[calc(100vh-4rem)] md:items-start">
          <motion.div
            layout
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="bg-white rounded-xl shadow-md flex flex-col gap-6 border border-gray-200/80 mx-auto p-6 md:p-8 w-[90%] max-w-md dark:bg-dark-card dark:border-dark-border"
          >
            <h2 className="text-xl md:text-2xl font-bold text-indigo-700 dark:text-indigo-400">
              Misc Entries
            </h2>
            <div className="text-center text-gray-500 py-8 text-base dark:text-dark-muted">
              No Entries for {customerName || 'you'} yet!
            </div>
          </motion.div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="w-full max-w-7xl mx-auto my-8 flex justify-center md:min-h-[calc(100vh-4rem)] md:items-start">
        <motion.div layout transition={{ type: 'spring', stiffness: 280, damping: 30 }} className={`bg-white rounded-xl shadow-md flex flex-col gap-6 border border-gray-200/80 mx-auto dark:bg-dark-card dark:border-dark-border ${showTable ? 'p-6 md:p-8 w-[90%] md:w-full md:max-w-full max-w-md' : 'p-6 md:p-8 w-[90%] max-w-md md:max-w-2xl md:min-h-[calc(100vh-4rem)]'}`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
            <h2 className="text-xl md:text-2xl font-bold text-indigo-700 md:uppercase md:tracking-widest whitespace-normal break-words dark:text-indigo-400">
              {showTable ? 'All Entries' : 'New Data Entry'}
            </h2>
            <div className="w-full md:w-auto">
              {!isScopedCustomer && (
                <button
                  type="button"
                  className="w-full md:w-auto px-4 py-2 rounded-lg font-semibold transition-colors duration-200 text-center mt-2 md:mt-0 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                  onClick={() => {
                    setShowTable(v => !v);
                    // --- LOGIC FIX ---
                    // Reset the filter when toggling views to prevent confusion.
                    setCustomerFilter('');
                  }}
                >
                  {showTable ? 'Add Data Entry' : 'View All Entries'}
                </button>
              )}
            </div>
          </div>

          <div className={`w-full min-h-[300px] md:min-h-[500px] relative flex-1 flex flex-col ${showTable ? 'px-2' : ''}`}>
            <AnimatePresence mode="wait">
              {showTable ? (
                <motion.div key="table" variants={viewVariants} initial="hidden" animate="visible" exit="exit">
                  {/* Mobile Customer Selection Button - Hidden on Desktop */}
                  <div className="md:hidden mb-4">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-dark-text mb-2">Select Customer</label>
                    <button
                      type="button"
                      onClick={() => setShowCustomerModal(true)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text text-left font-medium bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                    >
                      {selectedCustomerId 
                        ? (customerMap.get(selectedCustomerId) || 'Select Customer')
                        : '-- All Customers --'}
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Desktop Customer Sidebar - Hidden on Mobile */}
                    <div className="hidden md:block md:w-1/3 lg:w-1/4 bg-white border border-gray-200 rounded-lg shadow-sm p-3 dark:bg-dark-card dark:border-dark-border">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-dark-text">Customers</h3>
                        <span className="text-xs text-gray-500 dark:text-dark-muted">{filteredCustomerGroups.length}</span>
                      </div>
                      {customerEntryGroups.length === 0 ? (
                        <div className="text-center text-gray-500 py-10 text-sm dark:text-dark-muted">No data entries found.</div>
                      ) : (
                        <>
                          <div className="mb-3">
                            <input
                              type="text"
                              placeholder="Search customer..."
                              value={customerSearchTerm}
                              onChange={(e) => setCustomerSearchTerm(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 scrollbar-thin dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted"
                            />
                          </div>
                          {filteredCustomerGroups.length === 0 ? (
                            <div className="text-center text-gray-500 py-8 text-sm dark:text-dark-muted">
                              {customerSearchTerm.trim() ? 'No customers found.' : 'No data entries found.'}
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-[470px] overflow-y-auto pr-1 scrollbar-thin">
                              {filteredCustomerGroups.map((group) => {
                                const creditTotal = group.entries.filter((e) => e.type === 'credit').reduce((sum, e) => sum + e.amount, 0);
                                const expenseTotal = group.entries.filter((e) => e.type !== 'credit').reduce((sum, e) => sum + e.amount, 0);
                                return (
                                  <button
                                    key={group.customerId}
                                    type="button"
                                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors duration-150 ${selectedCustomerId === group.customerId
                                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500/60 dark:bg-indigo-900/20 dark:text-indigo-200'
                                      : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-dark-border dark:hover:border-indigo-800 dark:hover:bg-slate-700/50 dark:text-dark-text'
                                      }`}
                                    onClick={() => { setSelectedCustomerId(group.customerId); setCurrentPage(1); }}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="font-semibold truncate">{group.name}</div>
                                      <div className="text-xs text-gray-500 dark:text-dark-muted whitespace-nowrap">{group.entries.length} entries</div>
                                    </div>
                                        <div className="mt-1 text-xs flex gap-2">
                                          {creditTotal > 0 && <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /><span className="text-green-700 dark:text-green-400">+₹{formatNumberIndian(creditTotal)}</span></span>}
                                          {expenseTotal > 0 && <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /><span className="text-red-700 dark:text-red-400">₹{formatNumberIndian(expenseTotal)}</span></span>}
                                        </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex-1 md:min-w-0">
                      <div className="w-full border border-gray-200 rounded-lg overflow-hidden dark:border-dark-border">
                        {/* Desktop Table */}
                        <table className="hidden md:table w-full" style={{ tableLayout: 'auto' }}>
                          <thead className="bg-indigo-50 dark:bg-indigo-900/30">
                            <tr className="text-left text-xs font-bold text-indigo-700 uppercase tracking-wider dark:text-indigo-400">
                              <th className="px-4 py-3 resize-x overflow-auto cursor-col-resize" style={{ minWidth: '40px' }}>#</th>
                              <th className="px-4 py-3 text-left resize-x overflow-auto cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/50" style={{ minWidth: '120px' }} onClick={() => handleSortColumn('date')}>Date{getSortIndicator('date')}</th>
                              <th className="px-4 py-3 text-center resize-x overflow-auto cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/50" style={{ minWidth: '60px' }} onClick={() => handleSortColumn('type')}>Type{getSortIndicator('type')}</th>
                              <th className="px-4 py-3 resize-x overflow-auto cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/50" style={{ minWidth: '80px' }} onClick={() => handleSortColumn('subtype')}>Subtype{getSortIndicator('subtype')}</th>
                              <th className="px-4 py-3 resize-x overflow-auto cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/50" style={{ minWidth: '90px' }} onClick={() => handleSortColumn('amount')}>Amount{getSortIndicator('amount')}</th>
                              <th className="px-4 py-3 resize-x overflow-auto cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/50" style={{ minWidth: '90px' }} onClick={() => handleSortColumn('receipt')}>Receipt #{getSortIndicator('receipt')}</th>
                              <th className="px-4 py-3 resize-x overflow-auto cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/50" style={{ minWidth: '180px' }} onClick={() => handleSortColumn('notes')}>Notes{getSortIndicator('notes')}</th>
                              {!isScopedCustomer && <th className="px-4 py-3 text-center text-red-600 dark:text-red-400" style={{ minWidth: '100px' }}>Actions</th>}
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-dark-card">
                            {!selectedCustomerId || customerEntryGroups.length === 0 || selectedGroupEntries.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="text-center text-gray-500 py-16 text-base dark:text-dark-muted">
                                  {!selectedCustomerId
                                    ? 'Select a customer to view their entries'
                                    : isScopedCustomer && scopedCustomerId
                                    ? (() => {
                                      const customerName = customerMap.get(scopedCustomerId);
                                      return `No Entries for ${customerName || 'you'} yet!`;
                                    })()
                                    : 'No entries for this customer.'}
                                </td>
                              </tr>
                            ) : (
                              paginatedEntries.map((entry, idx) => {
                                const isExpanded = expandedNoteId === entry.id;
                                const actualIndex = (currentPage - 1) * itemsPerPage + idx + 1;
                                return (
                                  <tr
                                    key={`desktop-${entry.id}`}
                                    className="border-b border-gray-200 last:border-b-0 hover:bg-indigo-50/50 text-sm align-top dark:border-dark-border dark:hover:bg-slate-700/50"
                                  >
                                    <td className="px-4 py-3 text-gray-500 text-left dark:text-dark-muted">{actualIndex}</td>
                                    <td className="px-4 py-3 text-gray-600 text-left dark:text-dark-muted">{formatDate(entry.date)}</td>
                                    <td className="px-4 py-3 text-center">
                                      {entry.type === 'credit' ? (
                                        <span className="inline-block px-2 py-1 rounded-full bg-green-100 text-green-800 font-semibold text-xs dark:bg-green-900/30 dark:text-green-400">Credit</span>
                                      ) : (
                                        <span className="inline-block px-2 py-1 rounded-full bg-red-100 text-red-800 font-semibold text-xs dark:bg-red-900/30 dark:text-red-400">Expense</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 text-left dark:text-dark-muted">{entry.subtype || '-'}</td>
                                    <td className={`px-4 py-3 font-bold text-left ${entry.type === 'credit' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>₹{formatNumberIndian(entry.amount)}</td>
                                    <td className="px-4 py-3 text-gray-600 text-left dark:text-dark-muted">{entry.receipt_number || '-'}</td>
                                    <td ref={(el) => (notesRefs.current[entry.id] = el)} className="px-4 py-3 text-gray-600 text-left dark:text-dark-muted">
                                      <div className={`cursor-pointer break-words whitespace-pre-wrap ${!isExpanded ? 'line-clamp-2' : ''}`} onClick={() => handleNoteClick(entry.id)}>
                                        {entry.notes || '-'}
                                      </div>
                                    </td>
                                    {!isScopedCustomer && (
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
                                    )}
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>

                        {/* Mobile Cards */}
                        <div className="md:hidden bg-white dark:bg-dark-card">
                          {!selectedCustomerId || customerEntryGroups.length === 0 || selectedGroupEntries.length === 0 ? (
                            <div className="text-center text-gray-500 py-16 text-base dark:text-dark-muted">
                              {!selectedCustomerId
                                ? 'Select a customer to view their entries'
                                : isScopedCustomer && scopedCustomerId
                                ? (() => {
                                  const customerName = customerMap.get(scopedCustomerId);
                                  return `No Entries for ${customerName || 'you'} yet!`;
                                })()
                                : 'No entries for this customer.'}
                            </div>
                          ) : (
                            paginatedEntries.map((entry, idx) => {
                              const actualIndex = (currentPage - 1) * itemsPerPage + idx + 1;
                              return (
                                <div
                                  key={`mobile-${entry.id}`}
                                  className="mx-3 my-3 sm:mx-4 sm:my-4 p-3 sm:p-4 border border-gray-200 rounded-xl hover:shadow-md dark:border-dark-border dark:hover:shadow-lg bg-white dark:bg-dark-card transition-shadow"
                                >
                                  {/* Header Row: Entry Number + Customer + Amount */}
                                  <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs text-gray-500 dark:text-dark-muted mb-1">
                                        Entry #{actualIndex}
                                      </div>
                                      <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-dark-text truncate">
                                        {customerMap.get(entry.customer_id) || 'Unknown'}
                                      </h3>
                                    </div>
                                    <div className={`text-right flex-shrink-0`}>
                                      <div className={`font-bold text-base sm:text-lg ${entry.type === 'credit' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                        ₹{formatNumberIndian(entry.amount)}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Type & Subtype Badges */}
                                  <div className="flex flex-wrap gap-2 mb-3">
                                    {entry.type === 'credit' ? (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-green-100 text-green-800 font-semibold text-xs dark:bg-green-900/30 dark:text-green-400">
                                        ✓ Credit
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-semibold text-xs dark:bg-red-900/30 dark:text-red-400">
                                        ↗ Expense
                                      </span>
                                    )}
                                    {entry.subtype && (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 font-semibold text-xs dark:bg-indigo-900/30 dark:text-indigo-400">
                                        {entry.subtype}
                                      </span>
                                    )}
                                  </div>

                                  {/* Details Grid */}
                                  <div className="grid grid-cols-2 gap-3 py-3 border-t border-b border-gray-100 dark:border-slate-700/50 mb-3">
                                    <div>
                                      <span className="text-xs font-semibold text-gray-500 dark:text-dark-muted block mb-1">Date</span>
                                      <span className="text-sm font-medium text-gray-900 dark:text-dark-text">{formatDate(entry.date)}</span>
                                    </div>
                                    {entry.receipt_number && (
                                      <div>
                                        <span className="text-xs font-semibold text-gray-500 dark:text-dark-muted block mb-1">Receipt</span>
                                        <span className="text-sm font-medium text-gray-900 dark:text-dark-text">#{entry.receipt_number}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Notes Section */}
                                  {entry.notes && (
                                    <div className="mb-3 p-2.5 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-100 dark:border-slate-700/50">
                                      <span className="text-xs font-semibold text-gray-500 dark:text-dark-muted block mb-1">Notes</span>
                                      <p className="text-xs sm:text-sm text-gray-700 dark:text-dark-muted break-words whitespace-pre-wrap line-clamp-2">
                                        {entry.notes}
                                      </p>
                                    </div>
                                  )}

                                  {/* Action Buttons */}
                                  {!isScopedCustomer && (
                                    <div className="flex gap-2 pt-2">
                                      <button
                                        type="button"
                                        className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs sm:text-sm font-semibold hover:bg-blue-700 active:scale-95 transition"
                                        aria-label="Edit entry"
                                        onClick={(e) => { e.stopPropagation(); openEditEntry(entry); }}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition"
                                        aria-label="Delete entry"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(entry.id); }}
                                      >
                                        <Trash2Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                        </div>

                      {/* Pagination Controls - Bottom */}
                      {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
                          <div className="text-sm text-gray-600 dark:text-dark-muted">
                            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                            {Math.min(currentPage * itemsPerPage, sortedEntries.length)} of{" "}
                            {sortedEntries.length} entries
                          </div>
                          <div className="flex gap-2 flex-wrap justify-center">
                            <button
                              onClick={() => setCurrentPage(1)}
                              disabled={currentPage === 1}
                              className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:border-dark-border dark:text-dark-text dark:hover:bg-slate-700"
                            >
                              First
                            </button>
                            <button
                              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                              disabled={currentPage === 1}
                              className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:border-dark-border dark:text-dark-text dark:hover:bg-slate-700"
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
                                    className={`px-3 py-1 rounded border ${currentPage === page
                                      ? "bg-indigo-600 text-white border-indigo-600"
                                      : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-dark-border dark:text-dark-text dark:hover:bg-slate-700"
                                      }`}
                                  >
                                    {page}
                                  </button>
                                );
                              }
                              // Show dots for skipped pages
                              if (page === 2 && currentPage > 3) {
                                return <span key="dots-start" className="px-2 dark:text-dark-muted">...</span>;
                              }
                              if (page === totalPages - 1 && currentPage < totalPages - 2) {
                                return <span key="dots-end" className="px-2 dark:text-dark-muted">...</span>;
                              }
                              return null;
                            })}

                            <button
                              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                              disabled={currentPage === totalPages}
                              className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:border-dark-border dark:text-dark-text dark:hover:bg-slate-700"
                            >
                              Next
                            </button>
                            <button
                              onClick={() => setCurrentPage(totalPages)}
                              disabled={currentPage === totalPages}
                              className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:border-dark-border dark:text-dark-text dark:hover:bg-slate-700"
                            >
                              Last
                            </button>
                          </div>
                        </div>
                      )}

                      </div>
                    </div>
                  </motion.div>
              ) : (
                <motion.div key="form" variants={viewVariants} initial="hidden" animate="visible" exit="exit" className="w-full h-full flex flex-col">
                  {isScopedCustomer ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                      <p className="text-gray-600 text-lg mb-4 dark:text-dark-muted">You don't have permission to add data entries.</p>
                      <p className="text-gray-500 dark:text-dark-muted">As a customer, you can only view your own entries.</p>
                    </div>
                  ) : (
                    <form className="flex flex-col gap-4 w-full p-1 pb-2 flex-1" onSubmit={handleSubmit}>
                      <div className="relative" ref={customerDropdownRef}>
                        <label htmlFor="customer-btn" className={labelBaseStyle}>Name</label>
                        <button id="customer-btn" type="button" className={`${inputBaseStyle} flex justify-between items-center text-left bg-white dark:bg-slate-700`} onClick={() => setShowCustomerDropdown(v => !v)}>
                          {form.customerId ? (customerMap.get(form.customerId) || 'Select Customer') : 'Select Customer'}
                          <svg className="w-4 h-4 ml-2 text-gray-500 dark:text-dark-muted" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        <AnimatePresence>
                          {showCustomerDropdown && (
                            <motion.div variants={dropdownVariants} initial="hidden" animate="visible" exit="exit" className="absolute top-full left-0 z-20 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-52 overflow-y-auto mt-1 scrollbar-thin dark:bg-dark-card dark:border-dark-border">
                              <div className="p-2 sticky top-0 bg-white z-10 border-b border-gray-200 dark:bg-dark-card dark:border-dark-border">
                                <input type="text" placeholder="Search customer..." value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} className="p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm w-full dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted" autoFocus />
                              </div>
                              {filteredCustomers.length === 0 ? (
                                <div className="p-2 text-gray-400 text-sm dark:text-dark-muted">No customers found.</div>
                              ) : (
                                filteredCustomers.map((c) => (
                                  <div key={c.id} className={`p-2 cursor-pointer hover:bg-indigo-100 text-sm dark:hover:bg-slate-700 dark:text-dark-text ${form.customerId === c.id ? 'bg-indigo-50 font-semibold dark:bg-indigo-900/30' : ''}`} onClick={() => { setForm({ ...form, customerId: c.id }); setShowCustomerDropdown(false); setCustomerFilter(''); }}>
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
                          <select id="type" name="type" value={form.type} onChange={handleChange} className={`${inputBaseStyle} bg-white dark:bg-slate-700`} required>
                            <option value="credit">Credit</option>
                            <option value="expenditure">Expenditure</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label htmlFor="subtype" className={labelBaseStyle}>Subtype</label>
                          <select id="subtype" name="subtype" value={form.subtype} onChange={handleChange} className={`${inputBaseStyle} bg-white dark:bg-slate-700`}>
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
                        <label htmlFor="receipt" className={labelBaseStyle}>Receipt Number <span className="text-gray-400 font-normal dark:text-dark-muted">(Optional)</span></label>
                        <input type="text" id="receipt" name="receipt" value={form.receipt} onChange={handleChange} className={inputBaseStyle} />
                      </div>
                      <div>
                        <label htmlFor="notes" className={labelBaseStyle}>Notes <span className="text-gray-400 font-normal dark:text-dark-muted">(Optional)</span></label>
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
        {/* Modals are moved here to the top level and portaled to document.body. */}
        {/* This ensures they center relative to the viewport and are not affected by transformed ancestors. */}

        {/* Mobile Customer Selection Modal */}
        {typeof document !== 'undefined' && ReactDOM.createPortal(
          <AnimatePresence>
            {showCustomerModal && (
              <motion.div
                className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/30 p-4"
                style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCustomerModal(false)}
              >
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="customer-modal-title"
                  variants={modalVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="bg-white rounded-xl shadow-lg p-4 w-full max-w-sm max-h-[85vh] flex flex-col mx-4 dark:bg-dark-card dark:border dark:border-dark-border"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-dark-border">
                    <h2 id="customer-modal-title" className="text-lg font-semibold text-gray-800 dark:text-dark-text">Select Customer</h2>
                    <button
                      type="button"
                      onClick={() => setShowCustomerModal(false)}
                      className="text-gray-500 hover:text-gray-700 dark:text-dark-muted dark:hover:text-dark-text"
                      aria-label="Close modal"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Search customers..."
                      value={mobileCustomerSearch}
                      onChange={(e) => setMobileCustomerSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted"
                      autoFocus
                    />
                  </div>

                  {/* Customer List */}
                  <div className="flex-1 overflow-y-auto scrollbar-thin space-y-2">
                    {/* All Customers Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(null);
                        setCurrentPage(1);
                        setShowCustomerModal(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                        selectedCustomerId === null
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500/60 dark:bg-indigo-900/20 dark:text-indigo-200'
                          : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-dark-border dark:hover:border-indigo-800 dark:hover:bg-slate-700/50 dark:text-dark-text'
                      }`}
                    >
                      <div className="font-semibold">All Customers</div>
                      <div className="text-xs text-gray-500 dark:text-dark-muted">Show entries from all customers</div>
                    </button>

                    {/* Individual Customers */}
                    {filteredCustomerGroups
                      .filter((group) =>
                        debouncedMobileCustomerSearch.trim()
                          ? group.name.toLowerCase().includes(debouncedMobileCustomerSearch.toLowerCase())
                          : true
                      )
                      .map((group) => {
                        const creditTotal = group.entries.filter((e) => e.type === 'credit').reduce((sum, e) => sum + e.amount, 0);
                        const expenseTotal = group.entries.filter((e) => e.type !== 'credit').reduce((sum, e) => sum + e.amount, 0);
                        return (
                          <button
                            key={group.customerId}
                            type="button"
                            onClick={() => {
                              setSelectedCustomerId(group.customerId);
                              setCurrentPage(1);
                              setShowCustomerModal(false);
                            }}
                            className={`w-full text-left px-3 py-3 rounded-lg border transition-colors ${
                              selectedCustomerId === group.customerId
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500/60 dark:bg-indigo-900/20 dark:text-indigo-200'
                                : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-dark-border dark:hover:border-indigo-800 dark:hover:bg-slate-700/50 dark:text-dark-text'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="font-semibold truncate">{group.name}</div>
                              <div className="text-xs whitespace-nowrap px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded">
                                {group.entries.length}
                              </div>
                            </div>
                            <div className="mt-1 text-xs flex gap-2 text-gray-600 dark:text-dark-muted">
                              {creditTotal > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <span className="h-2 w-2 rounded-full bg-green-500" />
                                  ₹{formatNumberIndian(creditTotal)}
                                </span>
                              )}
                              {expenseTotal > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <span className="h-2 w-2 rounded-full bg-red-500" />
                                  ₹{formatNumberIndian(expenseTotal)}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}

                    {/* No Results */}
                    {debouncedMobileCustomerSearch.trim() &&
                      !filteredCustomerGroups.some((group) =>
                        group.name.toLowerCase().includes(debouncedMobileCustomerSearch.toLowerCase())
                      ) && (
                        <div className="text-center text-gray-500 py-8 text-sm dark:text-dark-muted">
                          No customers found.
                        </div>
                      )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

        {typeof document !== 'undefined' && ReactDOM.createPortal(
          <AnimatePresence>
            {editEntryId && (
              <motion.div
                className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/30 p-4"
                style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditEntryId(null)}
              >
                <motion.div role="dialog" aria-modal="true" aria-labelledby="edit-entry-modal-title" variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white rounded-xl shadow-lg p-4 w-full max-w-sm max-h-[90vh] overflow-y-auto mx-4 scrollbar-thin dark:bg-dark-card dark:border dark:border-dark-border" onClick={(e) => e.stopPropagation()}>
                  <div id="edit-entry-modal-title" className="text-lg font-semibold text-gray-800 mb-4 dark:text-dark-text">Edit Entry</div>
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
                    <button type="button" className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition dark:bg-slate-700 dark:text-dark-text dark:hover:bg-slate-600" onClick={() => setEditEntryId(null)} disabled={editEntryLoading}>Cancel</button>
                    <button type="button" className="flex-1 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition" onClick={handleSaveEditEntry} disabled={editEntryLoading}>
                      {editEntryLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

        {typeof document !== 'undefined' && ReactDOM.createPortal(
          <AnimatePresence>
            {deleteId && (
              <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteId(null)}>
                <motion.div role="dialog" aria-modal="true" aria-labelledby="delete-modal-title" variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white rounded-xl shadow-lg p-6 md:p-8 w-[90%] max-w-md flex flex-col items-center dark:bg-dark-card dark:border dark:border-dark-border" onClick={(e) => e.stopPropagation()}>
                  <div id="delete-modal-title" className="text-lg font-semibold text-gray-800 mb-4 dark:text-dark-text">Delete Entry?</div>
                  <p className="text-gray-600 mb-6 text-center dark:text-dark-muted">Are you sure? This action cannot be undone.</p>
                  <div className="flex gap-3 w-full">
                    <button type="button" className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition dark:bg-slate-700 dark:text-dark-text dark:hover:bg-slate-600" onClick={() => setDeleteId(null)}>Cancel</button>
                    <button type="button" className="flex-1 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition" onClick={confirmDelete}>Delete</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

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
    </PageWrapper>
  );
};

export default DataPage;