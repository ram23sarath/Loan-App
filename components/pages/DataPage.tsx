import React, { useState } from 'react';
import { useData } from '../../context/DataContext';

const DataPage = () => {
  const { customers = [], dataEntries = [], addDataEntry } = useData();
  const [form, setForm] = useState({
    customerId: '',
    date: '',
    amount: '',
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
        receipt_number: form.receipt,
        notes: form.notes,
      });
      setForm({ customerId: '', date: '', amount: '', receipt: '', notes: '' });
      setShowTable(true);
    } catch (err: any) {
      alert(err.message || 'Failed to add data entry.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-8 rounded-2xl bg-white border border-gray-200 shadow flex flex-col gap-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-indigo-700 text-center">Data Entries</h2>
        <button
          className="ml-auto px-4 py-2 rounded-lg bg-indigo-100 text-indigo-700 font-semibold hover:bg-indigo-200 transition"
          onClick={() => setShowTable(v => !v)}
        >
          {showTable ? 'Add Data Entry' : 'View All Entries'}
        </button>
      </div>
      {showTable ? (
        <div className="w-full overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-xl shadow">
            <thead>
              <tr className="bg-indigo-50">
                <th className="px-4 py-2 text-left text-xs font-bold text-indigo-700">Name</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-indigo-700">Date</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-indigo-700">Amount</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-indigo-700">Receipt #</th>
                <th className="px-4 py-2 text-left text-xs font-bold text-indigo-700">Notes</th>
              </tr>
            </thead>
            <tbody>
              {dataEntries.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-gray-400 py-6">No data entries found.</td></tr>
              ) : (
                dataEntries.map(entry => {
                  const customer = customers.find(c => c.id === entry.customer_id);
                  return (
                    <tr key={entry.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2">{customer ? customer.name : 'Unknown'}</td>
                      <td className="px-4 py-2">{entry.date}</td>
                      <td className="px-4 py-2">₹{entry.amount.toLocaleString()}</td>
                      <td className="px-4 py-2">{entry.receipt_number}</td>
                      <td className="px-4 py-2">{entry.notes || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-gray-700">Name</span>
            <select
              name="customerId"
              value={form.customerId}
              onChange={handleChange}
              className="p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            >
              <option value="">Select Customer</option>
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-gray-700">Date</span>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              className="p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
          </label>
          <label className="flex flex-col gap-1">
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
          <label className="flex flex-col gap-1">
            <span className="font-medium text-gray-700">Receipt Number</span>
            <input
              type="text"
              name="receipt"
              value={form.receipt}
              onChange={handleChange}
              className="p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-gray-700">Notes</span>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              className="p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              rows={3}
              placeholder="Enter any notes..."
            />
          </label>
          <button
            type="submit"
            className="mt-2 bg-indigo-600 text-white font-semibold py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            Submit
          </button>
        </form>
      )}
    </div>
  );
};

export default DataPage;
