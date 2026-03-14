import React, { useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import useFocusTrap from '../hooks/useFocusTrap';
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
    // Close immediately; keep toast transient locally
    try { onClose(); } finally {
      setToast({ show: true, message, type: 'success' });
      setTimeout(() => setToast({ show: false, message: '' }), 900);
    }
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
      reset();
      onClose();
    } catch (err: any) {
      setToast({ show: true, message: err?.message || 'Failed to record subscription', type: 'error' });
    }
  };

  // Close modal on Escape (capture) and prevent propagation to parent modals
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [onClose]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(containerRef, '#subscription_amount_input');

  return ReactDOM.createPortal(
    <motion.div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40" onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div ref={containerRef} className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}
        initial={{ y: 20, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 12, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      >
        <GlassCard className="!p-4">
          <h3 className="text-lg font-semibold mb-3">Record Subscription for {customer.name}</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600">Amount</label>
              <input id="subscription_amount_input" autoFocus type="number" step="0.01" {...register('amount', { required: 'Required', min: { value: 0, message: 'Must be >= 0' } })} className="w-full p-2 border border-gray-300 rounded dark:bg-dark-bg dark:border-dark-border dark:text-dark-text" />
              {errors.amount && <div className="text-red-500 text-xs">{errors.amount.message as any}</div>}
            </div>

            <div>
              <label className="block text-sm text-gray-600">Date</label>
              <input type="date" {...register('date', { required: 'Required' })} className="w-full p-2 border border-gray-300 rounded dark:bg-dark-bg dark:border-dark-border dark:text-dark-text" />
            </div>

            <div>
              <label className="block text-sm text-gray-600">Receipt # (optional)</label>
              <input type="text" {...register('receipt')} className="w-full p-2 border border-gray-300 rounded dark:bg-dark-bg dark:border-dark-border dark:text-dark-text" />
            </div>

            <div>
              <label className="block text-sm text-gray-600">Late Fee (optional)</label>
              <input type="number" step="0.01" {...register('late_fee')} className="w-full p-2 border border-gray-300 rounded dark:bg-dark-bg dark:border-dark-border dark:text-dark-text" />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1 rounded bg-gray-200 dark:bg-slate-700 dark:text-dark-text">Cancel</button>
              <button type="submit" disabled={isSubmitting} className={`px-3 py-1 rounded bg-cyan-600 text-white dark:bg-cyan-600 flex items-center justify-center ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}>
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    Saving...
                  </>
                ) : 'Save Subscription'}
              </button>
            </div>
          </form>
        </GlassCard>
      </motion.div>
      <Toast show={toast.show} message={toast.message} onClose={() => setToast({ show: false, message: '' })} type={toast.type === 'error' ? 'error' : 'success'} />
    </motion.div>,
    document.body
  );
};

export default RecordSubscriptionModal;
