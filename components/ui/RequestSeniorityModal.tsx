import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../context/DataContext';
import { useNavigate } from 'react-router-dom';

type Props = {
  customerId: string;
  customerName?: string;
  open: boolean;
  onClose: () => void;
  defaultStation?: string;
  defaultLoanType?: string;
  defaultDate?: string;
  isScopedCustomer?: boolean;
};

const RequestSeniorityModal = ({ customerId, customerName, open, onClose, defaultStation = '', defaultLoanType = 'General', defaultDate = '', isScopedCustomer = false }: Props) => {
  const { addToSeniority, seniorityList } = useData();
  const navigate = useNavigate();
  const [stationName, setStationName] = React.useState(defaultStation);
  const [loanType, setLoanType] = React.useState(defaultLoanType);
  const [loanRequestDate, setLoanRequestDate] = React.useState(defaultDate);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isClosing, setIsClosing] = React.useState(false);

  const EXIT_DURATION = 180; // ms - keep in sync with motion transition below

  React.useEffect(() => {
    setStationName(defaultStation);
    setLoanType(defaultLoanType);
    setLoanRequestDate(defaultDate);
  }, [defaultStation, defaultLoanType, defaultDate, open]);

  // Start a close animation and then call onClose
  const startClose = (cb?: () => void) => {
    setIsClosing(true);
    window.setTimeout(() => {
      setIsClosing(false);
      try {
        onClose();
      } finally {
        if (cb) cb();
      }
    }, EXIT_DURATION);
  };

  const alreadyRequested = React.useMemo(() => {
    return seniorityList.some((entry) => entry.customer_id === customerId);
  }, [seniorityList, customerId]);

  const handleSubmit = async () => {
    if (alreadyRequested) {
      alert('You already have a pending request in the loan seniority list.');
      return;
    }

    setIsSaving(true);
    try {
      await addToSeniority(customerId, {
        station_name: stationName || null,
        loan_type: loanType || null,
        loan_request_date: loanRequestDate || null,
      });

      // play close animation then navigate
      startClose(() => navigate('/loan-seniority'));
    } catch (err: any) {
      alert(err?.message || 'Failed to create request');
      setIsSaving(false);
    }
  };

  const variants = {
    backdrop: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
    modal: {
      hidden: { opacity: 0, y: 12, scale: 0.98 },
      visible: { opacity: 1, y: 0, scale: 1 },
    },
  };

  // Determine current animation state based on isClosing flag
  const animationState = isClosing ? 'hidden' : 'visible';

  return (
    <AnimatePresence>
      {(open || isClosing) && (
        <motion.div
          key="request-seniority-backdrop"
          initial="hidden"
          animate={animationState}
          exit="hidden"
          variants={variants.backdrop}
          transition={{ duration: EXIT_DURATION / 1000 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => startClose()}
          onMouseDown={() => startClose()}
          onTouchStart={() => startClose()}
        >
          <motion.div
            key="request-seniority-modal"
            initial="hidden"
            animate={animationState}
            exit="hidden"
            variants={variants.modal}
            transition={{ duration: EXIT_DURATION / 1000 }}
            className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-md overflow-hidden dark:bg-dark-card dark:border dark:border-dark-border"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-dark-text">Request Loan</h3>
              <button onClick={() => startClose()} className="text-gray-500 hover:text-gray-700 dark:text-dark-muted dark:hover:text-dark-text transition-colors">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">Station Name</label>
                <input
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">Loan Type</label>
                <select
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text"
                >
                  <option value="General">General</option>
                  <option value="Medical">Medical</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-dark-text">Requested Date</label>
                <input
                  value={loanRequestDate}
                  onChange={(e) => !isScopedCustomer && setLoanRequestDate(e.target.value)}
                  type="date"
                  disabled={isScopedCustomer}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-base text-gray-800 bg-white block focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ minHeight: '42px', WebkitAppearance: 'none' }}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => startClose()}
                className="px-3 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors dark:bg-slate-700 dark:text-dark-text dark:hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving || alreadyRequested}
                className="px-3 py-2 rounded bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-yellow-700 dark:hover:bg-yellow-800"
              >
                {isSaving ? 'Saving...' : 'Submit Request'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RequestSeniorityModal;
