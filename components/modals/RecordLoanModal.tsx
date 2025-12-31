import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import useFocusTrap from '../hooks/useFocusTrap';
import { useForm, SubmitHandler } from 'react-hook-form';
import GlassCard from '../ui/GlassCard';
import { useData } from '../../context/DataContext';
import { formatDate } from '../../utils/dateFormatter';
import Toast from '../ui/Toast';
import type { Customer, LoanWithCustomer } from '../../types';

type Props = {
  customer: Customer;
  onClose: () => void;
};

type FormInputs = {
  original_amount: number;
  totalRepayableAmount: number;
  payment_date: string;
  total_instalments: number;
  check_number?: string;
};

const getToday = () => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
};

const RecordLoanModal: React.FC<Props> = ({ customer, onClose }) => {
  const { addLoan, addInstallment, loans, installmentsByLoanId } = useData();
  const [mode, setMode] = useState<'loan' | 'installment'>('loan');
  const [toast, setToast] = useState<{ show: boolean; message: string; type?: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'success' });

  // Loan form
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setError, watch } = useForm<FormInputs>({ defaultValues: { payment_date: getToday(), total_instalments: 1 } });

  // Installment form using a separate instance
  const { register: regInst, handleSubmit: handleSubmitInst, formState: { errors: instErrors, isSubmitting: isSubmittingInst }, reset: resetInst, setValue: setInstValue, watch: watchInst } = useForm<any>({ defaultValues: { loan_id: '', installment_number: 1, amount: 0, date: getToday(), receipt_number: '', late_fee: 0 } });

  const customerLoans: LoanWithCustomer[] = useMemo(() => loans.filter(l => l.customer_id === customer.id), [loans, customer.id]);

  const selectedLoanId = watchInst('loan_id');
  const selectedLoan = useMemo(() => customerLoans.find(l => l.id === selectedLoanId) || null, [customerLoans, selectedLoanId]);

  // compute available installment numbers for selected loan
  const availableInstallmentNumbers = useMemo(() => {
    if (!selectedLoan) return [] as number[];
    const paid = (installmentsByLoanId.get(selectedLoan.id) || []).map((i: any) => i.installment_number);
    const setPaid = new Set(paid);
    return Array.from({ length: selectedLoan.total_instalments }, (_, i) => i + 1).filter(n => !setPaid.has(n));
  }, [selectedLoan, installmentsByLoanId]);

  useEffect(() => {
    if (selectedLoan) {
      const loanInsts = installmentsByLoanId.get(selectedLoan.id) || [];
      const sorted = [...loanInsts].sort((a: any, b: any) => b.installment_number - a.installment_number);
      if (sorted.length > 0) {
        const last = sorted[0];
        setInstValue('amount', last.amount);
        setInstValue('installment_number', last.installment_number + 1 <= selectedLoan.total_instalments ? last.installment_number + 1 : selectedLoan.total_instalments);
      } else {
        const monthly = Math.round((selectedLoan.original_amount + selectedLoan.interest_amount) / selectedLoan.total_instalments);
        setInstValue('amount', monthly);
        setInstValue('installment_number', 1);
      }
    }
  }, [selectedLoan, installmentsByLoanId, setInstValue]);

  const closeWithSuccess = (message: string) => {
    // Close immediately; don't delay while global data refresh happens
    try {
      onClose();
    } finally {
      setToast({ show: true, message, type: 'success' });
      setTimeout(() => setToast({ show: false, message: '' }), 1200);
    }
  };

  // Close modal on Escape (capture) and stop propagation so parent modals don't also close
  useEffect(() => {
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

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    try {
      if (Number(data.totalRepayableAmount) < Number(data.original_amount)) {
        setError('totalRepayableAmount', { type: 'manual', message: 'Must be >= original amount' });
        return;
      }
      const interest_amount = Number(data.totalRepayableAmount) - Number(data.original_amount);
      const payload = {
        customer_id: customer.id,
        original_amount: Number(data.original_amount),
        interest_amount: Number(interest_amount),
        payment_date: data.payment_date,
        total_instalments: Number(data.total_instalments),
        check_number: data.check_number || null,
      };
      await addLoan(payload);
      reset();
      onClose();
    } catch (err: any) {
      setToast({ show: true, message: err?.message || 'Failed to record loan', type: 'error' });
    }
  };

  const containerRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(containerRef, '#original_amount_input');

  return ReactDOM.createPortal(
    <motion.div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40" onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div ref={containerRef} className="w-full max-w-md" onClick={(e) => e.stopPropagation()}
        initial={{ y: 20, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 12, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      >
        <GlassCard className="!p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">{mode === 'loan' ? `Record Loan for ${customer.name}` : `Record Installment for ${customer.name}`}</h3>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setMode('loan')}
                className={`px-3 py-1 rounded ${mode === 'loan' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-700 dark:text-dark-text'}`}
              >
                Loan
              </button>
              <button
                type="button"
                onClick={() => setMode('installment')}
                className={`px-3 py-1 rounded ${mode === 'installment' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-700 dark:text-dark-text'}`}
              >
                Installment
              </button>
            </div>
          </div>

          {mode === 'loan' ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600">Original Amount</label>
                <input id="original_amount_input" autoFocus type="number" step="0.01" {...register('original_amount', { required: 'Required', min: { value: 0, message: 'Must be >= 0' } })} className="w-full p-2 border border-gray-300 rounded dark:bg-dark-bg dark:border-dark-border dark:text-dark-text" />
                {errors.original_amount && <div className="text-red-500 text-xs">{errors.original_amount.message as any}</div>}
              </div>

              <div>
                <label className="block text-sm text-gray-600">Total Repayable Amount</label>
                <input type="number" step="0.01" {...register('totalRepayableAmount', { required: 'Required', min: { value: 0, message: 'Must be >= 0' } })} className="w-full p-2 border border-gray-300 rounded dark:bg-dark-bg dark:border-dark-border dark:text-dark-text" />
                {errors.totalRepayableAmount && <div className="text-red-500 text-xs">{errors.totalRepayableAmount.message as any}</div>}
              </div>

              <div>
                <label className="block text-sm text-gray-600">First Payment Date</label>
                <input type="date" {...register('payment_date', { required: 'Required' })} className="w-full p-2 border border-gray-300 rounded dark:bg-dark-bg dark:border-dark-border dark:text-dark-text" />
              </div>

              <div>
                <label className="block text-sm text-gray-600">Total Installments</label>
                <input type="number" {...register('total_instalments', { required: 'Required', min: { value: 1, message: 'At least 1' } })} className="w-full p-2 border border-gray-300 rounded dark:bg-dark-bg dark:border-dark-border dark:text-dark-text" />
                {errors.total_instalments && <div className="text-red-500 text-xs">{errors.total_instalments.message as any}</div>}
              </div>

              <div>
                <label className="block text-sm text-gray-600">Check Number (optional)</label>
                <input type="text" {...register('check_number')} className="w-full p-2 border border-gray-300 rounded dark:bg-dark-bg dark:border-dark-border dark:text-dark-text" />
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="px-3 py-1 rounded bg-gray-200 dark:bg-slate-700 dark:text-dark-text">Cancel</button>
                <button type="submit" disabled={isSubmitting} className={`px-3 py-1 rounded bg-indigo-600 text-white dark:bg-indigo-600 flex items-center justify-center ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}>
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : 'Save Loan'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmitInst(async (data: any) => {
              try {
                if (!data.loan_id) {
                  setToast({ show: true, message: 'Select a loan', type: 'error' });
                  return;
                }
                const loanForInst = customerLoans.find(l => l.id === data.loan_id)!;
                const loanInstallments = installmentsByLoanId.get(loanForInst.id) || [];
                const totalPaid = loanInstallments.reduce((acc: number, i: any) => acc + Number(i.amount), 0);
                const totalRepayable = loanForInst.original_amount + loanForInst.interest_amount;
                if (totalPaid + Number(data.amount) > totalRepayable) {
                  setToast({ show: true, message: 'Amount would exceed total repayable', type: 'error' });
                  return;
                }
                const payload = {
                  loan_id: data.loan_id,
                  installment_number: Number(data.installment_number),
                  amount: Number(data.amount),
                  date: data.date,
                  receipt_number: data.receipt_number || null,
                  late_fee: data.late_fee ? Number(data.late_fee) : undefined,
                };
                await addInstallment(payload);
                resetInst();
                onClose();
              } catch (err: any) {
                setToast({ show: true, message: err?.message || 'Failed to record installment', type: 'error' });
              }
            })} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600">Select Loan</label>
                <select {...regInst('loan_id')} className="w-full p-2 border border-gray-300 rounded dark:bg-dark-bg dark:border-dark-border dark:text-dark-text">
                  <option value="">-- select loan --</option>
                  {customerLoans.map(l => (
                    <option key={l.id} value={l.id}>{`${formatDate(l.payment_date)} • ₹${l.original_amount} (inst: ${l.total_instalments})`}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600">Installment #</label>
                <select {...regInst('installment_number')} className="w-full p-2 border border-gray-300 rounded dark:bg-dark-bg dark:border-dark-border dark:text-dark-text">
                  {selectedLoan ? availableInstallmentNumbers.map(n => (
                    <option key={n} value={n}>{n}</option>
                  )) : <option value={1}>1</option>}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600">Amount</label>
                <input type="number" step="0.01" {...regInst('amount')} className="w-full p-2 border border-gray-300 rounded dark:bg-dark-bg dark:border-dark-border dark:text-dark-text" />
              </div>

              <div>
                <label className="block text-sm text-gray-600">Date</label>
                <input type="date" {...regInst('date')} className="w-full p-2 border border-gray-300 rounded dark:bg-dark-bg dark:border-dark-border dark:text-dark-text" />
              </div>

              <div>
                <label className="block text-sm text-gray-600">Receipt # (optional)</label>
                <input type="text" {...regInst('receipt_number')} className="w-full p-2 border border-gray-300 rounded dark:bg-dark-bg dark:border-dark-border dark:text-dark-text" />
              </div>

              <div>
                <label className="block text-sm text-gray-600">Late Fee (optional)</label>
                <input type="number" step="0.01" {...regInst('late_fee')} className="w-full p-2 border border-gray-300 rounded dark:bg-dark-bg dark:border-dark-border dark:text-dark-text" />
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="px-3 py-1 rounded bg-gray-200 dark:bg-slate-700 dark:text-dark-text">Cancel</button>
                <button type="submit" disabled={isSubmittingInst} className={`px-3 py-1 rounded bg-indigo-600 text-white dark:bg-indigo-600 flex items-center justify-center ${isSubmittingInst ? 'opacity-70 cursor-not-allowed' : ''}`}>
                  {isSubmittingInst ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : 'Save Installment'}
                </button>
              </div>
            </form>
          )}

          <Toast show={toast.show} message={toast.message} onClose={() => setToast({ show: false, message: '' })} type={toast.type === 'error' ? 'error' : 'success'} />
        </GlassCard>
      </motion.div>
    </motion.div>,
    document.body
  );
};

export default RecordLoanModal;
