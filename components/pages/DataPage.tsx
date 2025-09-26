import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { PencilIcon, Trash2Icon } from '../../constants';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../context/DataContext';
import { formatDate } from '../../utils/dateFormatter';

const DataPage = () => {
  const { customers = [], dataEntries = [], addDataEntry, deleteDataEntry, updateDataEntry } = useData();

  // State for the edit modal
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [editNoteValue, setEditNoteValue] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // State for the customer filter/dropdown in the form
  const [customerFilter, setCustomerFilter] = useState('');
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
  const [showTable, setShowTable] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const notesRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // --- LOGIC FIX & OPTIMIZATION ---
  // Create a performant customer lookup map to avoid using .find() in a loop.
  const customerMap = useMemo(() => {
    return new Map(customers.map(c => [c.id, c.name]));
  }, [customers]);

  // Memoized list of customers for the form's dropdown
  const filteredCustomers = useMemo(() => {
    if (!customerFilter) return customers;
    return customers.filter(c => c.name.toLowerCase().includes(customerFilter.toLowerCase()));
  }, [customers, customerFilter]);

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
        if (newType === 'credit' && prevForm.subtype === 'Subscription') {
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

  const handleUpdateNote = async () => {
    if (!editNoteId) return;
    setEditLoading(true);
    try {
      await updateDataEntry(editNoteId, { notes: editNoteValue });
      setEditNoteId(null);
      setToastMsg('Note updated successfully.');
      setShowToast(true);
    } catch (err) {
      setToastMsg('Failed to update note.');
      setShowToast(true);
    } finally {
      setEditLoading(false);
    }
  };

  const handleNoteClick = (id: string) => {
    setExpandedNoteId(expandedNoteId === id ? null : id);
  };

  // --- STYLES & VARIANTS ---
  const inputBaseStyle = "w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow";
  const labelBaseStyle = "block mb-2 text-sm font-medium text-gray-700";
  const viewVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }, exit: { opacity: 0, y: -20, transition: { duration: 0.3, ease: 'easeIn' } } };
  const modalVariants = { hidden: { scale: 0.9, opacity: 0 }, visible: { scale: 1, opacity: 1 }, exit: { scale: 0.95, opacity: 0 } };
  const toastVariants = { hidden: { opacity: 0, x: "100%" }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 150, damping: 20 } }, exit: { opacity: 0, x: "100%", transition: { ease: "easeIn", duration: 0.4 } } };
  const dropdownVariants = { hidden: { opacity: 0, y: -10 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } };

  return (
    <div className="w-full max-w-7xl mx-auto my-8">
      <motion.div layout transition={{ type: 'spring', stiffness: 280, damping: 30 }} className={`bg-white rounded-xl shadow-md flex flex-col gap-6 border border-gray-200/80 w-full mx-auto ${showTable ? 'max-w-full p-3' : 'max-w-2xl p-4'}`}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-indigo-700 uppercase tracking-widest">
            {showTable ? 'All Entries' : 'New Data Entry'}
          </h2>
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-2">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-indigo-100 text-indigo-700 font-semibold hover:bg-indigo-200 transition-colors duration-200"
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

  <div className={`w-full min-h-[300px] md:min-h-[500px] relative ${showTable ? 'px-2' : ''}`}>
          <AnimatePresence mode="wait">
            {showTable ? (
              <motion.div key="table" variants={viewVariants} initial="hidden" animate="visible" exit="exit">
                <div className="w-full border border-gray-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-4 bg-indigo-50 px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">
                    <div className="col-span-2">Name</div>
                    <div className="col-span-2">Date</div>
                    <div className="col-span-1">Type</div>
                    <div className="col-span-2">Subtype</div>
                    <div className="col-span-1">Amount</div>
                    <div className="col-span-1">Receipt #</div>
                    <div className="col-span-2">Notes</div>
                    <div className="col-span-1 text-center text-red-600">Delete</div>
                  </div>
                  <div className="bg-white">
                    <AnimatePresence>
                      {dataEntries.length === 0 ? (
                        <div className="text-center text-gray-500 py-16 text-base">No data entries found.</div>
                      ) : (
                        dataEntries.map(entry => {
                          const customerName = customerMap.get(entry.customer_id) || 'Unknown';
                          const isExpanded = expandedNoteId === entry.id;
                          return (
                            <React.Fragment key={entry.id}>
                              {/* Desktop row (hidden on small screens) */}
                              <motion.div
                                layout
                                key={`desktop-${entry.id}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, height: 0, padding: 0, margin: 0, transition: { duration: 0.3 } }}
                                transition={{ layout: { type: 'spring', stiffness: 400, damping: 40 }, opacity: { duration: 0.2 } }}
                                className="hidden md:grid grid-cols-12 gap-4 items-center px-6 py-3 border-b border-gray-200 last:border-b-0 hover:bg-indigo-50/50 text-sm"
                              >
                                <div className="col-span-2 font-medium text-gray-900">{customerName}</div>
                                <div className="col-span-2 text-gray-600">{formatDate(entry.date)}</div>
                                <div className="col-span-1">
                                  {entry.type === 'credit' ? (
                                    <span className="inline-block px-3 py-1 rounded-full bg-green-100 text-green-800 font-semibold text-xs">Credit</span>
                                  ) : (
                                    <span className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-800 font-semibold text-xs">Expenditure</span>
                                  )}
                                </div>
                                <div className="col-span-2 text-gray-600">{entry.subtype || '-'}</div>
                                <div className={`col-span-1 font-bold ${entry.type === 'credit' ? 'text-green-700' : 'text-red-700'}`}>{entry.type === 'credit' ? '+' : '-'}₹{entry.amount.toLocaleString()}</div>
                                <div className="col-span-1 text-gray-600">{entry.receipt_number || '-'}</div>
                                <div ref={(el) => (notesRefs.current[entry.id] = el)} className="col-span-2 text-gray-600 flex items-center gap-2">
                                  <div className={`flex-1 cursor-pointer ${!isExpanded ? 'truncate' : ''}`} onClick={() => handleNoteClick(entry.id)}>
                                    {entry.notes || '-'}
                                  </div>
                                  {entry.notes && (
                                    <button type="button" className="p-1 rounded-full hover:bg-indigo-100 transition-colors" aria-label="Edit note" onClick={() => { setEditNoteId(entry.id); setEditNoteValue(entry.notes || ''); }}>
                                      <PencilIcon className="w-4 h-4 text-indigo-600" />
                                    </button>
                                  )}
                                </div>
                                <div className="col-span-1 flex justify-center">
                                  <motion.button type="button" className="p-2 transition-colors duration-200 rounded-full text-red-600 hover:bg-red-100" onClick={() => handleDeleteClick(entry.id)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                    <Trash2Icon className="w-5 h-5" />
                                  </motion.button>
                                </div>
                              </motion.div>

                              {/* Mobile card (visible on small screens) */}
                              <motion.div
                                layout
                                key={`mobile-${entry.id}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, height: 0, padding: 0, margin: 0, transition: { duration: 0.2 } }}
                                transition={{ opacity: { duration: 0.15 } }}
                                className="md:hidden px-4 py-3 border-b last:border-b-0 hover:bg-indigo-50/30"
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-gray-900 truncate">{customerName}</div>
                                    <div className="text-sm text-gray-600 truncate">{entry.subtype || entry.type}</div>
                                  </div>
                                  <div className={`ml-2 text-right font-bold ${entry.type === 'credit' ? 'text-green-700' : 'text-red-700'}`}>{entry.type === 'credit' ? '+' : '-'}₹{entry.amount.toLocaleString()}</div>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                  <div>{formatDate(entry.date)}</div>
                                  <div className="flex items-center gap-2">
                                    {entry.receipt_number && <div className="px-2 py-0.5 bg-gray-100 rounded text-xs">#{entry.receipt_number}</div>}
                                    <motion.button type="button" className="p-1 rounded-full text-red-600 hover:bg-red-100" onClick={() => handleDeleteClick(entry.id)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                      <Trash2Icon className="w-4 h-4" />
                                    </motion.button>
                                  </div>
                                </div>
                                {entry.notes && (
                                  <div className="mt-2 text-sm text-gray-700">
                                    <div className={`cursor-pointer ${!isExpanded ? 'truncate' : ''}`} onClick={() => handleNoteClick(entry.id)}>{entry.notes}</div>
                                    {isExpanded && (
                                      <div className="mt-2 flex items-center gap-2">
                                        <button type="button" className="text-indigo-600 text-sm font-medium" onClick={() => { setEditNoteId(entry.id); setEditNoteValue(entry.notes || ''); }}>Edit</button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </motion.div>
                            </React.Fragment>
                          );
                        })
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="form" variants={viewVariants} initial="hidden" animate="visible" exit="exit" className="w-full h-full">
                <form className="flex flex-col gap-4 w-full p-1 pb-6" onSubmit={handleSubmit}>
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
                    <input type="date" id="date" name="date" value={form.date} onChange={handleChange} className={inputBaseStyle} required />
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
                        {form.type !== 'credit' && <option value="Subscription">Subscription</option>}
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
                    <textarea id="notes" name="notes" value={form.notes} onChange={handleChange} className={`${inputBaseStyle} min-h-[100px]`} rows={3} placeholder="Enter any notes..." />
                  </div>
                  <button type="submit" className="w-full mt-4 bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 transition-colors duration-300 focus:outline-none focus:ring-4 focus:ring-indigo-300">Submit Entry</button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* --- LOGIC FIX --- */}
      {/* Modals are moved here to the top level. They are no longer rendered inside a loop. */}
      {/* This fixes both the performance issue and the broken table layout. */}
      <AnimatePresence>
        {editNoteId && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div role="dialog" aria-modal="true" aria-labelledby="edit-note-modal-title" variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm flex flex-col items-center">
              <div id="edit-note-modal-title" className="text-lg font-semibold text-gray-800 mb-4">Edit Note</div>
              <textarea
                className="w-full min-h-[80px] border border-gray-300 rounded-lg p-2 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={editNoteValue}
                onChange={e => setEditNoteValue(e.target.value)}
                disabled={editLoading}
                autoFocus
              />
              <div className="flex gap-3 w-full">
                <button type="button" className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition" onClick={() => setEditNoteId(null)} disabled={editLoading}>Cancel</button>
                <button type="button" className="flex-1 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition" onClick={handleUpdateNote} disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteId && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div role="dialog" aria-modal="true" aria-labelledby="delete-modal-title" variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm flex flex-col items-center">
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