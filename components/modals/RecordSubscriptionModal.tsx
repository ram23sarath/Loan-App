import React from 'react';
import ReactDOM from 'react-dom';
import { useForm, SubmitHandler } from 'react-hook-form';
import GlassCard from '../ui/GlassCard';
import { useData } from '../../context/DataContext';
import Toast from '../ui/Toast';
import type { Customer } from '../../types';

type Props = {
  customer: Customer;
  onClose: () => void;
};

type FormInputs = {
  amount: number;
  date: string;
  receipt?: string;
  late_fee?: number | null;
};

const getToday = () => new Date().toISOString().slice(0, 10);

const RecordSubscriptionModal: React.FC<Props> = ({ customer, onClose }) => {
  const { addSubscription } = useData();
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormInputs>({ defaultValues: { date: getToday(), late_fee: 0 } });
  const [toast, setToast] = React.useState<{ show: boolean; message: string; type?: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  const closeWithSuccess = (message: string) => {
    setToast({ show: true, message, type: 'success' });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
      onClose();
    }, 900);
  };

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    try {
      const payload = {
        customer_id: customer.id,
        amount: Number(data.amount),
        date: data.date,
        receipt: data.receipt || '',
        late_fee: data.late_fee != null ? Number(data.late_fee) : null,
      };
      await addSubscription(payload);
      closeWithSuccess('Subscription recorded');
      reset();
    } catch (err: any) {
      setToast({ show: true, message: err?.message || 'Failed to record subscription', type: 'error' });
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <GlassCard className="!p-4">
          <h3 className="text-lg font-semibold mb-3">Record Subscription for {customer.name}</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600">Amount</label>
              <input type="number" step="0.01" {...register('amount', { required: 'Required', min: { value: 0, message: 'Must be >= 0' } })} className="w-full p-2 border rounded" />
              {errors.amount && <div className="text-red-500 text-xs">{errors.amount.message as any}</div>}
            </div>

            <div>
              <label className="block text-sm text-gray-600">Date</label>
              <input type="date" {...register('date', { required: 'Required' })} className="w-full p-2 border rounded" />
            </div>

            <div>
              <label className="block text-sm text-gray-600">Receipt # (optional)</label>
              <input type="text" {...register('receipt')} className="w-full p-2 border rounded" />
            </div>

            <div>
              <label className="block text-sm text-gray-600">Late Fee (optional)</label>
              <input type="number" step="0.01" {...register('late_fee')} className="w-full p-2 border rounded" />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1 rounded bg-gray-200">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="px-3 py-1 rounded bg-cyan-600 text-white">Save Subscription</button>
            </div>
          </form>
        </GlassCard>
      </div>
      <Toast show={toast.show} message={toast.message} onClose={() => setToast({ show: false, message: '' })} type={toast.type === 'error' ? 'error' : 'success'} />
    </div>,
    document.body
  );
};

export default RecordSubscriptionModal;
