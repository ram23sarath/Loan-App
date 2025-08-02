import React from 'react';
import type { Customer, LoanWithCustomer, SubscriptionWithCustomer } from '../../types';

interface EditModalProps {
  type: 'customer' | 'loan' | 'subscription';
  data: Customer | LoanWithCustomer | SubscriptionWithCustomer;
  onSave: (updated: any) => void;
  onClose: () => void;
}

const EditModal: React.FC<EditModalProps> = ({ type, data, onSave, onClose }) => {
  // TODO: Implement form fields and logic for each type
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-gray-700">✕</button>
        <h2 className="text-2xl font-bold mb-4">Edit {type.charAt(0).toUpperCase() + type.slice(1)}</h2>
        {/* Render form fields based on type */}
        {/* ... */}
        <button className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded" onClick={() => onSave(data)}>Save</button>
      </div>
    </div>
  );
};

export default EditModal;
