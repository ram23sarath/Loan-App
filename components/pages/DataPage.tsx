import React, { useState, useRef } from 'react';
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
      alert(err.message || 'Failed to add data entry.');
    }
  };

  // Filter logic for data entries table
  const filteredEntries = dataEntries.filter(entry => {
    if (!customerFilter) return true;
    const customer = customers.find(c => c.id === entry.customer_id);
    return customer && customer.name.toLowerCase().includes(customerFilter.toLowerCase());
  });

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      await deleteDataEntry(id);
    }
  };


  // Close dropdown on outside click
  React.useEffect(() => {
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

  return (
    <div className="mx-auto my-4 p-3 bg-white rounded-2xl shadow flex flex-col gap-3 border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-indigo-700">Data Entries</h2>
        <button
          className="ml-auto px-4 py-2 rounded-lg bg-indigo-100 text-indigo-700 font-semibold hover:bg-indigo-200 transition"
          onClick={() => setShowTable(v => !v)}
        >
          {showTable ? 'Add Data Entry' : 'View All Entries'}
        </button>
      </div>


      {showTable ? (
        <div className="w-full overflow-x-auto max-w-6xl mx-auto">
          <table className="min-w-[1100px] w-full text-base border-collapse border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-indigo-50">
                <th className="px-6 py-4 text-left text-sm font-bold text-indigo-700">Name</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-indigo-700">Date</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-indigo-700">Type</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-indigo-700">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-indigo-700">Receipt #</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-indigo-700">Notes</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-red-600">Delete</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-10 text-lg">No data entries found.</td></tr>
              ) : (
                filteredEntries.map(entry => {
                  const customer = customers.find(c => c.id === entry.customer_id);
                  return (
                    <tr key={entry.id} className="border-b last:border-b-0 hover:bg-indigo-50/30 transition">
                      <td className="px-6 py-4 font-medium text-indigo-900">{customer ? customer.name : 'Unknown'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{entry.date}</td>
                      <td className="px-6 py-4">
                        {entry.type === 'credit' ? (
                          <span className="inline-block px-3 py-1 rounded-full bg-green-100 text-green-700 font-semibold text-xs">Credit</span>
                        ) : (
                          <span className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-700 font-semibold text-xs">Expenditure</span>
                        )}
                      </td>
                      <td className={`px-6 py-4 font-bold ${entry.type === 'credit' ? 'text-green-700' : 'text-red-700'}`}>{entry.type === 'credit' ? '+' : '-'}₹{entry.amount.toLocaleString()}</td>
                      <td className="px-6 py-4">{entry.receipt_number}</td>
                      <td className="px-6 py-4">{entry.notes || '-'}</td>
                      <td className="px-6 py-4">
                        <button
                          className="text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded px-3 py-1 border border-red-200 font-semibold"
                          onClick={() => handleDelete(entry.id)}
                        >Delete</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <form className="flex flex-col gap-3 max-w-2xl mx-auto" onSubmit={handleSubmit}>
          <div className="p-2 border border-gray-200 rounded-lg flex flex-col gap-1 relative" ref={customerDropdownRef}>
            <span className="font-medium text-gray-700">Name</span>
            <button
              type="button"
              className="p-2 border rounded-lg bg-white text-left focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm w-full flex justify-between items-center"
              onClick={() => setShowCustomerDropdown(v => !v)}
            >
              {form.customerId ? (customers.find((c: any) => c.id === form.customerId)?.name || 'Select Customer') : 'Select Customer'}
              <svg className="w-4 h-4 ml-2 inline-block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showCustomerDropdown && (
              <div className="absolute top-full left-0 z-20 w-full bg-white border border-gray-200 rounded-lg shadow max-h-48 overflow-y-auto mt-1">
                <div className="p-2 sticky top-0 bg-white">
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
                {customers.filter((c: any) => c.name.toLowerCase().includes(customerFilter.toLowerCase())).length === 0 ? (
                  <div className="p-2 text-gray-400 text-sm">No customers found.</div>
                ) : (
                  customers.filter((c: any) => c.name.toLowerCase().includes(customerFilter.toLowerCase())).map((c: any) => (
                    <div
                      key={c.id}
                      className={`p-2 cursor-pointer hover:bg-indigo-100 text-sm ${form.customerId === c.id ? 'bg-indigo-50 font-semibold' : ''}`}
                      onClick={() => {
                        setForm({ ...form, customerId: c.id });
                        setTimeout(() => setShowCustomerDropdown(false), 0);
                        setCustomerFilter('');
                      }}
                    >
                      {c.name}
                    </div>
                  ))
                )}
                {customerFilter && (
                  <div
                    className="p-2 text-xs text-indigo-600 cursor-pointer hover:underline sticky bottom-0 bg-white"
                    onClick={() => { setCustomerFilter(''); }}
                  >
                    Clear filter
                  </div>
                )}
              </div>
            )}
            {/* Hidden select for form validation */}
            <select
              name="customerId"
              value={form.customerId}
              onChange={handleChange}
              className="hidden"
              required
            >
              <option value="">Select Customer</option>
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="p-2 border border-gray-200 rounded-lg flex flex-col gap-1">
            <span className="font-medium text-gray-700">Date</span>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              className="p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
          </div>
          <div className="p-2 border border-gray-200 rounded-lg flex gap-2 items-end">
            <label className="flex flex-col gap-1 flex-1">
              <span className="font-medium text-gray-700">Amount</span>
              <input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                className="p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                required
                min="0"
              />
            </label>
            <label className="flex flex-col gap-1 w-36">
              <span className="font-medium text-gray-700">Type</span>
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                required
              >
                <option value="credit">Credit</option>
                <option value="expenditure">Expenditure</option>
              </select>
            </label>
          </div>
          <div className="p-2 border border-gray-200 rounded-lg flex flex-col gap-1">
            <span className="font-medium text-gray-700">Receipt Number</span>
            <input
              type="text"
              name="receipt"
              value={form.receipt}
              onChange={handleChange}
              className="p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div className="p-2 border border-gray-200 rounded-lg flex flex-col gap-1">
            <span className="font-medium text-gray-700">Notes</span>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              className="p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              rows={3}
              placeholder="Enter any notes..."
            />
          </div>
          <button
            type="submit"
            className="mt-2 bg-indigo-600 text-white font-semibold py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            Submit Entry
          </button>
        </form>
      )}
    </div>
  );
};

export default DataPage;