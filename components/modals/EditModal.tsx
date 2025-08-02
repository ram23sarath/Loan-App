import React from 'react';
import type { Customer, LoanWithCustomer, SubscriptionWithCustomer } from '../../types';

interface EditModalProps {
  type: 'customer' | 'loan' | 'subscription';
  data: Customer | LoanWithCustomer | SubscriptionWithCustomer;
  onSave: (updated: any) => void;
  onClose: () => void;
}

const EditModal: React.FC<EditModalProps> = ({ type, data, onSave, onClose }) => {
  const [form, setForm] = React.useState<any>(data);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-gray-700">✕</button>
        <h2 className="text-2xl font-bold mb-4">Edit {type.charAt(0).toUpperCase() + type.slice(1)}</h2>
        {type === 'customer' && (
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); onSave(form); }}>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                name="name"
                type="text"
                value={form.name || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                name="phone"
                type="tel"
                value={form.phone || ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
                maxLength={10}
                pattern="^\d{10}$"
              />
            </div>
            <button type="submit" className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded">Save</button>
          </form>
        )}
        {/* TODO: Add forms for loan and subscription editing */}
      </div>
    </div>
  );
};

export default EditModal;
