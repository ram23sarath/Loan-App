
import React from 'react';
import { motion, Transition } from 'framer-motion';
import { useData } from '../../context/DataContext';
import Toast from './Toast';
import RequestSeniorityModal from './RequestSeniorityModal';

const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  in: {
    opacity: 1,
    y: 0,
  },
  out: {
    opacity: 0,
    y: -20,
  },
};

const pageTransition: Transition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.5,
};

const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  const { isScopedCustomer, session, scopedCustomerId, customers } = useData();
  const [toast, setToast] = React.useState<{ show: boolean; message: string; type?: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'info' });
  const [showRequestModal, setShowRequestModal] = React.useState(false);
  const [fabDefaultDate, setFabDefaultDate] = React.useState('');

  React.useEffect(() => {
    const handler = (e: any) => {
      try {
        const d = e?.detail || {};
        const type = d.status === 'success' ? 'success' : 'error';
        const msg = d.message || (type === 'success' ? 'User created successfully' : 'Failed to create user');
        setToast({ show: true, message: msg, type });
      } catch (err) {
        // ignore
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('background-user-create', handler as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('background-user-create', handler as EventListener);
      }
    };
  }, []);

  React.useEffect(() => {
    try {
      setFabDefaultDate(new Date().toISOString().slice(0,10));
    } catch (e) {
      setFabDefaultDate('');
    }
  }, []);

  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="w-full min-h-full p-4 pb-24 sm:p-8 landscape:pb-16"
    >
      <Toast show={toast.show} message={toast.message} onClose={() => setToast({ show: false, message: '', type: 'info' })} type={toast.type as any} />

      {/* Admin banner shown for non-scoped users (admins) */}
      {session?.user && !isScopedCustomer && (
        <div
          aria-hidden
          className="fixed top-6 right-6 z-50 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shadow-sm text-sm font-semibold"
        >
          Admin
        </div>
      )}

      {children}

      {/* Floating action button for scoped customers to request loan/subscription */}
      {isScopedCustomer && scopedCustomerId && (
        <>
          <button
            onClick={() => setShowRequestModal(true)}
            title="Request Loan/Subscription"
            className="fixed right-6 bottom-6 z-50 bg-yellow-600 hover:bg-yellow-700 text-white p-3 rounded-full shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <RequestSeniorityModal
            open={showRequestModal}
            onClose={() => setShowRequestModal(false)}
            customerId={scopedCustomerId}
            customerName={customers.find(c => c.id === scopedCustomerId)?.name || ''}
            defaultDate={fabDefaultDate}
          />
        </>
      )}
    </motion.div>
  );
};

export default PageWrapper;
