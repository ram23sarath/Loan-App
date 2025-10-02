import React from 'react';
import { XIcon } from '../../constants';

type Item = {
  id?: string;
  date?: string;
  amount: number;
  receipt?: string;
  notes?: string;
  source?: string;
  extra?: Record<string, any>;
};

interface Props {
  open: boolean;
  title: string;
  items: Item[];
  onClose: () => void;
}

const formatCurrency = (n: number) => `₹${n.toLocaleString()}`;

const FYBreakdownModal: React.FC<Props> = ({ open, title, items, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><XIcon className="w-5 h-5 text-gray-600" /></button>
        </div>

        {items.length === 0 ? (
          <p className="text-gray-500">No records for this category in the selected financial year.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-gray-600 uppercase bg-gray-50 p-2 rounded">
              <div className="col-span-3">Date</div>
              <div className="col-span-3">Customer</div>
              <div className="col-span-2">Source</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-2">Notes / Receipt</div>
            </div>
            {items.map((it, idx) => (
              <div key={it.id || idx} className="grid grid-cols-12 gap-4 px-2 py-3 items-start border-b last:border-b-0">
                <div className="col-span-3 text-sm text-gray-700">{it.date ? new Date(it.date).toLocaleDateString('en-IN') : '-'}</div>
                <div className="col-span-3 text-sm text-gray-700">{(it as any).customer || '-'}</div>
                <div className="col-span-2 text-sm text-gray-700">{it.source || '-'}</div>
                <div className="col-span-2 text-sm font-medium text-right text-gray-800">{formatCurrency(it.amount)}</div>
                <div className="col-span-2 text-sm text-gray-600">{it.receipt || it.notes || '-'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FYBreakdownModal;
