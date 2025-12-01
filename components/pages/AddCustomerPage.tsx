import React, { useState, useEffect } from 'react';
import Toast from '../ui/Toast';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useData } from '../../context/DataContext';
import GlassCard from '../ui/GlassCard';
import PageWrapper from '../ui/PageWrapper';

type FormInputs = {
  name: string;
  phone: string;
};

const AddCustomerPage = () => {
  const { addCustomer } = useData();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormInputs>();

  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [shakeButton, setShakeButton] = useState(false);
  const STORAGE_KEY = 'loan_app_user_creation_history';
  const [userCreationStatuses, setUserCreationStatuses] = useState<any[]>([]);

  // Load persisted history and listen for background events
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setUserCreationStatuses(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to load user creation history', e);
    }

    const handler = (ev: any) => {
      const d = ev?.detail || {};
      const customerId = d.customerId || d.customer_id || null;
      const status = d.status || 'unknown';
      const userId = d.user_id || d.userId || d.userId;
      const message = d.message || '';

      const entry = {
        customerId,
        status,
        userId,
        message,
        timestamp: Date.now(),
      };

      setUserCreationStatuses(prev => {
        const next = [entry, ...prev].slice(0, 100); // keep some history
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) { }
        return next;
      });
    };

    window.addEventListener('background-user-create', handler as EventListener);
    return () => window.removeEventListener('background-user-create', handler as EventListener);
  }, []);

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    try {
      const newCustomer = await addCustomer(data);
      navigate('/add-record', { state: { newCustomerId: newCustomer.id } });
    } catch (error: any) {
      if (error.message && error.message.toLowerCase().includes('already exists')) {
        // Trigger the wiggle animation
        setShakeButton(true);
        setTimeout(() => setShakeButton(false), 500);

        // Also, show the toast message
        setToast({ show: true, message: error.message });
      } else {
        // For all other errors, just show the toast
        setToast({ show: true, message: error.message || 'An error occurred.' });
      }
    }
  };

  const wiggleAnimation = {
    x: [0, -10, 10, -10, 10, 0],
    transition: { duration: 0.4 }
  };

  return (
    <PageWrapper>
      <Toast show={toast.show} message={toast.message} onClose={() => setToast({ show: false, message: '' })} type="error" />
      <div className="flex items-center justify-center min-h-[60vh] px-2 sm:px-0">
        <GlassCard className="w-full max-w-xs sm:max-w-md !p-4 sm:!p-8" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4 sm:mb-6">Onboard New Customer</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
            <div>
              <label htmlFor="name" className="block text-xs sm:text-sm font-medium mb-1 sm:mb-2">Customer Name</label>
              <input
                id="name"
                type="text"
                {...register('name', { required: 'Customer name is required' })}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg py-2 px-3 sm:px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400 text-sm sm:text-base"
                placeholder="e.g., John Doe"
                disabled={isSubmitting}
              />
              {errors.name && <p className="text-red-600 text-xs sm:text-sm mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label htmlFor="phone" className="block text-xs sm:text-sm font-medium mb-1 sm:mb-2">Phone Number</label>
              <input
                id="phone"
                type="tel"
                maxLength={10}
                {...register('phone', {
                  required: 'Phone number is required',
                  pattern: {
                    value: /^\d{10}$/,
                    message: 'Phone number must be exactly 10 digits.'
                  }
                })}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg py-2 px-3 sm:px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400 text-sm sm:text-base"
                placeholder="Enter 10-digit phone number"
                disabled={isSubmitting}
              />
              {errors.phone && <p className="text-red-600 text-xs sm:text-sm mt-1">{errors.phone.message}</p>}
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors duration-300 text-white font-bold py-2 sm:py-3 px-3 sm:px-4 rounded-lg text-sm sm:text-base"
              animate={shakeButton ? wiggleAnimation : {}}
            >
              {isSubmitting ? 'Saving...' : 'Add Customer & Proceed'}
            </motion.button>
          </form>
        </GlassCard>
      </div>

      {/* Recently created users table (last 5 successful creations) */}
      <div className="max-w-3xl mx-auto mt-6 px-4">
        {userCreationStatuses && userCreationStatuses.filter(s => s.status === 'success' && s.userId).length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold">Recently Created Auth Users</div>
              <div className="text-xs text-gray-500">Newest first — showing up to 5</div>
            </div>
            <div className="p-3">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-gray-600">
                      <th className="py-2 pr-4">Customer ID</th>
                      <th className="py-2 pr-4">User ID</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userCreationStatuses
                      .filter(s => s.status === 'success' && s.userId)
                      .sort((a, b) => b.timestamp - a.timestamp)
                      .slice(0, 5)
                      .map(s => (
                        <tr key={s.customerId + '-' + s.userId} className="border-t border-gray-100">
                          <td className="py-2 pr-4 align-top text-xs text-gray-800 break-all">{s.customerId}</td>
                          <td className="py-2 pr-4 align-top text-xs text-gray-700 break-all">{s.userId}</td>
                          <td className="py-2 pr-4 align-top text-xs text-green-700">{s.status}</td>
                          <td className="py-2 align-top text-xs text-gray-500">{new Date(s.timestamp).toLocaleString()}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
};

export default AddCustomerPage;