import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../../context/DataContext';

const DataPage = () => {
  const { customers = [], dataEntries = [], addDataEntry, deleteDataEntry } = useData();
  const [customerFilter, setCustomerFilter] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    customerId: '',
    date: '',
    amount: '',
    type: 'credit', // 'credit' or 'expenditure'
    receipt: '',
    notes: '',
  });
  const [showTable, setShowTable] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDataEntry({
        customer_id: form.customerId,
        date: form.date,
        amount: Number(form.amount),
        type: form.type,
        receipt_number: form.receipt,
        notes: form.notes,
      });
      setForm({ customerId: '', date: '', amount: '', type: 'credit', receipt: '', notes: '' });
      setShowTable(true);
    } catch (err: any) {
      setToastMsg(err.message || 'Failed to add data entry.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    }
  };

  const filteredEntries = dataEntries.filter(entry => {
    if (!customerFilter) return true;
    const customer = customers.find(c => c.id === entry.customer_id);
    return customer && customer.name.toLowerCase().includes(customerFilter.toLowerCase());
  });

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      setDeletingRowId(deleteId);
      setDeleteId(null);
      setTimeout(async () => {
        await deleteDataEntry(deleteId);
        setToastMsg('Entry deleted successfully.');
        setShowToast(true);
        setDeletingRowId(null);
        setTimeout(() => setShowToast(false), 5000);
      }, 350);
    }
  };

  useEffect(() => {
    if (!showCustomerDropdown) return;
    function handleClickOutside(event: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCustomerDropdown]);

  const inputBaseStyle = "w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow";
  const labelBaseStyle = "block mb-2 text-sm font-medium text-gray-700";

  return (
    <div className="w-full max-w-7xl mx-auto my-8">
      <div className="bg-white rounded-xl shadow-md flex flex-col gap-6 p-6 border border-gray-200/80">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-indigo-700">
            {showTable ? 'All Entries' : 'New Data Entry'}
          </h2>
          <button
            className="ml-auto px-4 py-2 rounded-lg bg-indigo-100 text-indigo-700 font-semibold hover:bg-indigo-200 transition-colors duration-200"
            onClick={() => setShowTable(v => !v)}
          >
            {showTable ? 'Add Data Entry' : 'View All Entries'}
          </button>
        </div>

        <div className="w-full min-h-[500px] relative overflow-hidden">
          {/* Table View Wrapper */}
          <div className="absolute inset-0 transition-all duration-500" style={{ pointerEvents: showTable ? 'auto' : 'none', zIndex: showTable ? 2 : 1 }}>
            <div className={`transition-all duration-500 w-full h-full ${showTable ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8 pointer-events-none'}`}>
              <div className="w-full h-full overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full w-full text-sm">
                  <thead className="bg-indigo-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">Name</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">Type</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">Amount</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">Receipt #</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">Notes</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-red-600 uppercase tracking-wider">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEntries.length === 0 ? (
                      <tr><td colSpan={7} className="text-center text-gray-500 py-16 text-base">No data entries found.</td></tr>
                    ) : (
                      filteredEntries.map(entry => {
                        const customer = customers.find(c => c.id === entry.customer_id);
                        const isDeleting = deletingRowId === entry.id;
                        return (
                          <tr
                            key={entry.id}
                            className={`hover:bg-indigo-50/50 ${isDeleting ? 'opacity-0 -translate-x-10' : 'opacity-100 translate-x-0'}`}
                            style={{ transition: 'opacity 300ms ease-out, transform 300ms ease-out, background-color 200ms' }}
                          >
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{customer ? customer.name : 'Unknown'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">{entry.date}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {entry.type === 'credit' ? (
                                <span className="inline-block px-3 py-1 rounded-full bg-green-100 text-green-800 font-semibold text-xs">Credit</span>
                              ) : (
                                <span className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-800 font-semibold text-xs">Expenditure</span>
                              )}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap font-bold ${entry.type === 'credit' ? 'text-green-700' : 'text-red-700'}`}>{entry.type === 'credit' ? '+' : '-'}₹{entry.amount.toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">{entry.receipt_number}</td>
                            <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{entry.notes || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                className="text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded px-3 py-1 border border-red-200 font-semibold"
                                type="button"
                                onClick={() => handleDeleteClick(entry.id)}
                              >Delete</button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          {/* Form View Wrapper */}
          <div className="absolute inset-0 transition-all duration-500" style={{ pointerEvents: !showTable ? 'auto' : 'none', zIndex: !showTable ? 2 : 1 }}>
            {/* MODIFIED: Added overflow-y-auto to allow scrolling inside the form view */}
            <div className={`transition-all duration-500 w-full h-full overflow-y-auto ${!showTable ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
              {/* MODIFIED: Added padding to the form for better scroll spacing */}
              <form className="flex flex-col gap-5 max-w-2xl mx-auto p-1 pb-8" onSubmit={handleSubmit}>
                <div className="relative" ref={customerDropdownRef}>
                  <label htmlFor="customer-btn" className={labelBaseStyle}>Name</label>
                  <button
                    id="customer-btn"
                    type="button"
                    className={`${inputBaseStyle} flex justify-between items-center text-left bg-white`}
                    onClick={() => setShowCustomerDropdown(v => !v)}
                  >
                    {form.customerId ? (customers.find(c => c.id === form.customerId)?.name || 'Select Customer') : 'Select Customer'}
                    <svg className="w-4 h-4 ml-2 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {showCustomerDropdown && (
                    <div className="absolute top-full left-0 z-20 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-52 overflow-y-auto mt-1">
                      <div className="p-2 sticky top-0 bg-white z-10">
                        <input
                          type="text"
                          placeholder="Search customer..."
                          value={customerFilter}
                          onChange={e => setCustomerFilter(e.target.value)}
                          className="mb-2 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm w-full"
                          autoFocus
                        />
                        <button
                          type="button"
                          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-2"
                          onClick={() => { setShowCustomerDropdown(false); }}
                          aria-label="Close"
                        >
                          ×
                        </button>
                      </div>
                      {customers.filter((c) => c.name.toLowerCase().includes(customerFilter.toLowerCase())).length === 0 ? (
                        <div className="p-2 text-gray-400 text-sm">No customers found.</div>
                      ) : (
                        customers.filter((c) => c.name.toLowerCase().includes(customerFilter.toLowerCase())).map((c) => (
                          <div
                            key={c.id}
                            className={`p-2 cursor-pointer hover:bg-indigo-100 text-sm ${form.customerId === c.id ? 'bg-indigo-50 font-semibold' : ''}`}
                            onClick={() => {
                              setForm({ ...form, customerId: c.id });
                              setShowCustomerDropdown(false);
                              setCustomerFilter('');
                            }}
                          >
                            {c.name}
                          </div>
                        ))
                      )}
                      {customerFilter && (
                        <div className="p-2 text-xs text-indigo-600 cursor-pointer hover:underline sticky bottom-0 bg-white" onClick={() => { setCustomerFilter(''); }}>
                          Clear filter
                        </div>
                      )}
                    </div>
                  )}
                  <select name="customerId" value={form.customerId} onChange={handleChange} className="hidden" required><option value="">Select Customer</option>{customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}</select>
                </div>
                <div>
                  <label htmlFor="date" className={labelBaseStyle}>Date</label>
                  <input type="date" id="date" name="date" value={form.date} onChange={handleChange} className={inputBaseStyle} required/>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="md:col-span-3">
                    <label htmlFor="amount" className={labelBaseStyle}>Amount</label>
                    <input type="number" id="amount" name="amount" value={form.amount} onChange={handleChange} className={inputBaseStyle} required min="0" placeholder="e.g. 5000" />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="type" className={labelBaseStyle}>Type</label>
                    <select id="type" name="type" value={form.type} onChange={handleChange} className={`${inputBaseStyle} bg-white`} required>
                      <option value="credit">Credit</option>
                      <option value="expenditure">Expenditure</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="receipt" className={labelBaseStyle}>Receipt Number <span className="text-gray-400 font-normal">(Optional)</span></label>
                  <input type="text" id="receipt" name="receipt" value={form.receipt} onChange={handleChange} className={inputBaseStyle} />
                </div>
                <div>
                  <label htmlFor="notes" className={labelBaseStyle}>Notes <span className="text-gray-400 font-normal">(Optional)</span></label>
                  <textarea id="notes" name="notes" value={form.notes} onChange={handleChange} className={`${inputBaseStyle} min-h-[100px]`} rows={3} placeholder="Enter any notes..."/>
                </div>
                <button
                  type="submit"
                  className="w-full mt-4 bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 transition-colors duration-300 focus:outline-none focus:ring-4 focus:ring-indigo-300"
                >
                  Submit Entry
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" style={{ animation: 'fadeIn 200ms ease-out forwards' }}>
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm flex flex-col items-center" style={{ animation: 'scaleIn 200ms ease-out forwards' }}>
              <div className="text-lg font-semibold text-gray-800 mb-4">Delete Entry?</div>
              <p className="text-gray-600 mb-6 text-center">Are you sure? This action cannot be undone.</p>
              <div className="flex gap-3 w-full">
                <button
                  className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition"
                  onClick={() => setDeleteId(null)}
                >Cancel</button>
                <button
                  className="flex-1 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition"
                  onClick={confirmDelete}
                >Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Message */}
        {showToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-indigo-700 text-white px-6 py-3 rounded-lg shadow-lg text-base font-medium" style={{ animation: 'fadeInUp 500ms ease-out forwards' }}>
            {toastMsg}
          </div>
        )}
      </div>
    </div>
  );
};

export default DataPage;