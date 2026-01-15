import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useData } from '../../context/DataContext';
import { formatCurrencyIN } from '../../utils/numberFormatter';
import Toast from '../ui/Toast';
import type { LoanWithCustomer, NewInstallment } from '../../types';

interface Props {
  loan: LoanWithCustomer;
  onClose: () => void;
  onSuccess?: () => void;
}

interface InstallmentFormInputs {
  amount: number;
  installment_number: number;
  date: string;
  receipt_number: string;
  late_fee?: number;
}

const getTodayDateString = (): string => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 },
  },
  exit: { opacity: 0, scale: 0.9, y: 20, transition: { duration: 0.2 } },
};

const RecordInstallmentModal: React.FC<Props> = ({ loan, onClose, onSuccess }) => {
  const { addInstallment, installmentsByLoanId } = useData();
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    setError,
  } = useForm<InstallmentFormInputs>({
    defaultValues: {
      date: getTodayDateString(),
      late_fee: 0,
    },
  });

  const modalRef = useRef<HTMLDivElement>(null);

  // Get loan installments and calculate paid numbers
  const loanInstallments = useMemo(() => {
    return installmentsByLoanId.get(loan.id) || [];
  }, [installmentsByLoanId, loan.id]);

  const paidInstallmentNumbers = useMemo(() => {
    return new Set(loanInstallments.map((inst) => inst.installment_number));
  }, [loanInstallments]);

  const availableInstallmentNumbers = useMemo(() => {
    return Array.from({ length: loan.total_instalments }, (_, i) => i + 1).filter(
      (num) => !paidInstallmentNumbers.has(num)
    );
  }, [loan.total_instalments, paidInstallmentNumbers]);

  const totalRepayable = loan.original_amount + loan.interest_amount;
  const totalPaid = useMemo(() => {
    return loanInstallments.reduce((sum, inst) => sum + inst.amount, 0);
  }, [loanInstallments]);

  // Set default values on mount
  useEffect(() => {
    if (loanInstallments.length > 0) {
      const sortedInstallments = [...loanInstallments].sort(
        (a, b) => b.installment_number - a.installment_number
      );
      const lastInstallment = sortedInstallments[0];
      const nextInstallmentNumber = lastInstallment.installment_number + 1;

      if (nextInstallmentNumber <= loan.total_instalments) {
        setValue('amount', lastInstallment.amount);
        setValue('installment_number', nextInstallmentNumber);
      }
    } else {
      const monthlyAmount = Math.round(totalRepayable / loan.total_instalments);
      setValue('amount', monthlyAmount);
      setValue('installment_number', 1);
    }
  }, [loanInstallments, loan.total_instalments, totalRepayable, setValue]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const onSubmit: SubmitHandler<InstallmentFormInputs> = async (data) => {
    // Validate total paid doesn't exceed total repayable
    const newTotalPaid = totalPaid + data.amount;
    if (newTotalPaid > totalRepayable) {
      setError('amount', {
        type: 'manual',
        message: `Total paid (${formatCurrencyIN(newTotalPaid)}) cannot exceed total repayable (${formatCurrencyIN(totalRepayable)})`,
      });
      return;
    }

    const installmentPayload: NewInstallment = {
      loan_id: loan.id,
      installment_number: data.installment_number,
      amount: data.amount,
      date: data.date,
      receipt_number: data.receipt_number,
    };

    if (data.late_fee && !Number.isNaN(data.late_fee) && data.late_fee > 0) {
      installmentPayload.late_fee = data.late_fee;
    }

    try {
      await addInstallment(installmentPayload);
      setToast({
        show: true,
        message: `Installment #${data.installment_number} recorded successfully!`,
        type: 'success',
      });

      // Close modal after a short delay to show success message
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }, 1500);
    } catch (error: any) {
      setToast({
        show: true,
        message: error.message || 'Failed to record installment',
        type: 'error',
      });
    }
  };

  const inputStyles =
    'w-full bg-gray-50 dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400 dark:placeholder-dark-muted text-gray-800 dark:text-dark-text';
  const dateInputStyles =
    'w-full bg-white dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400 dark:placeholder-dark-muted text-gray-800 dark:text-dark-text text-base block';
  const selectStyles =
    'w-full bg-gray-50 dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 dark:text-dark-text';

  const modalContent = (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
      >
        <motion.div
          ref={modalRef}
          className="bg-white dark:bg-dark-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          variants={modalVariants}
          onClick={(e) => e.stopPropagation()}
        >
          <Toast
            show={toast.show}
            message={toast.message}
            type={toast.type}
            onClose={() => setToast({ ...toast, show: false })}
          />

          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-6 py-4 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-dark-text">
              Record Installment
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors"
              aria-label="Close modal"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {/* Loan Info */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-dark-text mb-2">
                {loan.customers?.name || 'Unknown Customer'}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-dark-muted">Total Repayable:</span>
                  <span className="ml-2 font-semibold text-gray-800 dark:text-dark-text">
                    {formatCurrencyIN(totalRepayable)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-dark-muted">Paid:</span>
                  <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                    {formatCurrencyIN(totalPaid)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-dark-muted">Balance:</span>
                  <span className="ml-2 font-semibold text-red-600 dark:text-red-400">
                    {formatCurrencyIN(totalRepayable - totalPaid)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-dark-muted">Installments Paid:</span>
                  <span className="ml-2 font-semibold text-gray-800 dark:text-dark-text">
                    {loanInstallments.length} / {loan.total_instalments}
                  </span>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">
                    Installment Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    {...register('amount', {
                      required: 'Amount is required',
                      valueAsNumber: true,
                      min: { value: 0.01, message: 'Amount must be positive' },
                    })}
                    placeholder="e.g., 5000"
                    className={inputStyles}
                    disabled={isSubmitting}
                  />
                  {errors.amount && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                      {errors.amount.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">
                    Installment Number <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('installment_number', {
                      required: 'Please select an installment number',
                      valueAsNumber: true,
                    })}
                    className={selectStyles}
                    disabled={isSubmitting}
                  >
                    <option value="">Select...</option>
                    {availableInstallmentNumbers.map((num) => (
                      <option key={num} value={num}>
                        {num}
                      </option>
                    ))}
                  </select>
                  {errors.installment_number && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                      {errors.installment_number.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">
                    Payment Date <span className="text-red-500">*</span>
                  </label>
                  <div className="overflow-hidden rounded-lg">
                    <input
                      {...register('date', { required: 'Date is required' })}
                      type="date"
                      className={dateInputStyles}
                      disabled={isSubmitting}
                      min="1980-01-01"
                      max="2050-12-31"
                    />
                  </div>
                  {errors.date && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                      {errors.date.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">
                    Receipt Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('receipt_number', { required: 'Receipt number is required' })}
                    type="text"
                    placeholder="Installment Receipt No."
                    className={inputStyles}
                    disabled={isSubmitting}
                  />
                  {errors.receipt_number && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                      {errors.receipt_number.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">
                  Late Fee (Optional)
                </label>
                <input
                  type="number"
                  {...register('late_fee', {
                    valueAsNumber: true,
                    min: { value: 0, message: 'Late fee cannot be negative' },
                  })}
                  placeholder="e.g., 10"
                  className={inputStyles}
                  disabled={isSubmitting}
                />
                {errors.late_fee && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                    {errors.late_fee.message}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-dark-border">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting || availableInstallmentNumbers.length === 0}
                >
                  {isSubmitting ? 'Recording...' : 'Record Installment'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default RecordInstallmentModal;
