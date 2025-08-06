import React from 'react';
import type { Customer, LoanWithCustomer, SubscriptionWithCustomer } from '../../types';

interface EditModalProps {
  type: 'customer' | 'loan' | 'subscription' | 'customer_loan';
  data: any;
  onSave: (updated: any) => void;
  onClose: () => void;
}

const EditModal: React.FC<EditModalProps> = ({ type, data, onSave, onClose }) => {

  const [form, setForm] = React.useState<any>(data);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // For combined customer+loan form
  const handleCombinedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, dataset } = e.target;
    if (dataset.section === 'customer') {
      setForm({ ...form, customer: { ...form.customer, [name]: value } });
    } else if (dataset.section === 'loan') {
      setForm({ ...form, loan: { ...form.loan, [name]: value } });
    } else if (dataset.section === 'subscription') {
      setForm({ ...form, subscription: { ...form.subscription, [name]: value } });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-12 w-full max-w-lg max-h-[90vh] overflow-y-auto relative flex flex-col items-center">
        <button onClick={onClose} className="absolute top-4 right-4 text-2xl text-gray-500 hover:text-gray-700">✕</button>
        <h2 className="text-2xl font-bold mb-6">Edit {type.charAt(0).toUpperCase() + type.slice(1)}</h2>
        {type === 'customer_loan' && (
          <form className="space-y-6 w-full max-w-md" onSubmit={e => { e.preventDefault(); onSave(form); }}>
            {/* Customer Section */}
            <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 mb-4 shadow-sm">
              <h3 className="text-lg font-semibold mb-2 text-center text-blue-700">Customer Details</h3>
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input name="name" data-section="customer" type="text" value={form.customer?.name || ''} onChange={handleCombinedChange} className="w-full border border-gray-300 rounded px-3 py-2" />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input name="phone" data-section="customer" type="tel" value={form.customer?.phone || ''} onChange={handleCombinedChange} className="w-full border border-gray-300 rounded px-3 py-2" maxLength={10} pattern="^\d{10}$" />
              </div>
            </div>
            {/* Loan Section */}
            <div className="border border-green-200 bg-green-50 rounded-xl p-4 mb-4 shadow-sm">
              <h3 className="text-lg font-semibold mb-2 text-center text-green-700">Loan Details</h3>
              <div>
                <label className="block text-sm font-medium mb-1">Original Amount</label>
                <input name="original_amount" data-section="loan" type="number" value={form.loan?.original_amount || ''} onChange={handleCombinedChange} className="w-full border border-gray-300 rounded px-3 py-2" />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Interest Amount</label>
                <input name="interest_amount" data-section="loan" type="number" value={form.loan?.interest_amount || ''} onChange={handleCombinedChange} className="w-full border border-gray-300 rounded px-3 py-2" />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Check Number</label>
                <input name="check_number" data-section="loan" type="text" value={form.loan?.check_number || ''} onChange={handleCombinedChange} className="w-full border border-gray-300 rounded px-3 py-2" />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Installment Number</label>
                <input name="installment_number" data-section="loan" type="number" value={form.loan?.installment_number || ''} onChange={handleCombinedChange} className="w-full border border-gray-300 rounded px-3 py-2" />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Total Repayable</label>
                <input type="number" value={
                  (Number(form.loan?.original_amount || 0) + Number(form.loan?.interest_amount || 0))
                } readOnly className="w-full border border-gray-200 bg-gray-100 rounded px-3 py-2" />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Total Installments</label>
                <input name="total_instalments" data-section="loan" type="number" value={form.loan?.total_instalments || ''} onChange={handleCombinedChange} className="w-full border border-gray-300 rounded px-3 py-2" />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Payment Date</label>
                <input name="payment_date" data-section="loan" type="date" value={form.loan?.payment_date ? form.loan.payment_date.slice(0,10) : ''} onChange={handleCombinedChange} className="w-full border border-gray-300 rounded px-3 py-2" min="1980-01-01" max="2050-12-31" />
              </div>
            </div>
            {/* Subscription Section */}
            {form.subscription && (
              <div className="border border-purple-200 bg-purple-50 rounded-xl p-4 mb-4 shadow-sm">
                <h3 className="text-lg font-semibold mb-2 text-center text-purple-700">Subscription Details</h3>
                <div>
                  <label className="block text-sm font-medium mb-1">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 select-none font-sans" style={{fontFamily: 'Segoe UI Symbol, Arial Unicode MS, sans-serif'}}>&#8377;</span>
                    <input
                      name="amount"
                      data-section="subscription"
                      type="number"
                      value={form.subscription.amount || ''}
                      onChange={handleCombinedChange}
                      className="w-full border border-gray-300 rounded px-3 py-2 pl-7"
                      style={{fontFamily: 'inherit'}}
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium mb-1">Year</label>
                  <input name="year" data-section="subscription" type="number" value={form.subscription.year || ''} onChange={handleCombinedChange} className="w-full border border-gray-300 rounded px-3 py-2" />
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input name="date" data-section="subscription" type="date" value={form.subscription.date ? form.subscription.date.slice(0,10) : ''} onChange={handleCombinedChange} className="w-full border border-gray-300 rounded px-3 py-2" min="1980-01-01" max="2050-12-31" />
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium mb-1">Receipt</label>
                  <input name="receipt" data-section="subscription" type="text" value={form.subscription.receipt || ''} onChange={handleCombinedChange} className="w-full border border-gray-300 rounded px-3 py-2" />
                </div>
              </div>
            )}
            <button type="submit" className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded">Save</button>
          </form>
        )}
        {type === 'customer' && (
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); onSave(form); }}>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input name="name" type="text" value={form.name || ''} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input name="phone" type="tel" value={form.phone || ''} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2" maxLength={10} pattern="^\d{10}$" />
            </div>
            <button type="submit" className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded">Save</button>
          </form>
        )}
        {type === 'loan' && (
          <form className="space-y-4 w-full max-w-xs mx-auto" onSubmit={e => { e.preventDefault(); onSave(form); }}>
            <div>
              <label className="block text-sm font-medium mb-1">Original Amount</label>
              <input name="original_amount" type="number" value={form.original_amount || ''} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Interest Amount</label>
              <input name="interest_amount" type="number" value={form.interest_amount || ''} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Check Number</label>
              <input name="check_number" type="text" value={form.check_number || ''} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Installment Number</label>
              <input name="installment_number" type="number" value={form.installment_number || ''} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Total Installments</label>
              <input name="total_instalments" type="number" value={form.total_instalments || ''} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment Date</label>
              <input name="payment_date" type="date" value={form.payment_date ? form.payment_date.slice(0,10) : ''} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2" min="1980-01-01" max="2050-12-31" />
            </div>
            <button type="submit" className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded">Save</button>
          </form>
        )}
        {type === 'subscription' && (
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); onSave(form); }}>
            <div>
              <label className="block text-sm font-medium mb-1">Amount</label>
              <input name="amount" type="number" value={form.amount || ''} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Year</label>
              <input name="year" type="number" value={form.year || ''} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input name="date" type="date" value={form.date ? form.date.slice(0,10) : ''} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2" min="1980-01-01" max="2050-12-31" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Receipt</label>
              <input name="receipt" type="text" value={form.receipt || ''} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2" />
            </div>
            <button type="submit" className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded">Save</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default EditModal;
