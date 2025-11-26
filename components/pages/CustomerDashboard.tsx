import React from 'react';
import { useData } from '../../context/DataContext';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../ui/GlassCard';
import PageWrapper from '../ui/PageWrapper';
import { motion } from 'framer-motion';
import RequestSeniorityModal from '../ui/RequestSeniorityModal';

const CustomerDashboard = () => {
  const { customers, loans, subscriptions, dataEntries, isScopedCustomer, scopedCustomerId } = useData();
  const navigate = useNavigate();
  const { addToSeniority } = useData();

  const [showRequestModal, setShowRequestModal] = React.useState(false);
  const [stationName, setStationName] = React.useState('');
  const [loanType, setLoanType] = React.useState('General');
  const [loanRequestDate, setLoanRequestDate] = React.useState('');
  const [isSavingRequest, setIsSavingRequest] = React.useState(false);

  // Get the current customer's data
  const customer = isScopedCustomer && scopedCustomerId 
    ? customers.find(c => c.id === scopedCustomerId)
    : customers.length > 0 ? customers[0] : null;

  return (
    <PageWrapper>
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Welcome Card */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <GlassCard className="!p-6 sm:!p-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
              Welcome, {customer?.name}!
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Here's a summary of your account information.
            </p>
          </GlassCard>
        </motion.div>

        {/* Request Modal for scoped customers */}
        <RequestSeniorityModal
          open={showRequestModal}
          onClose={() => setShowRequestModal(false)}
          customerId={customer?.id || ''}
          customerName={customer?.name || ''}
          defaultStation={stationName}
          defaultLoanType={loanType}
          defaultDate={loanRequestDate}
        />



        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <GlassCard className="!p-6 sm:!p-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/summary')}
                className="bg-slate-600 hover:bg-slate-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Summary Dashboard
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/loans')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                View My Loans
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/subscriptions')}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                View Subscriptions
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/data')}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                View Misc Entries
              </motion.button>
              {isScopedCustomer && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    // default requested date to today
                    const today = new Date().toISOString().slice(0,10);
                    setLoanRequestDate(today);
                    setShowRequestModal(true);
                  }}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Request Loan/Subscription
                </motion.button>
              )}
            </div>
          </GlassCard>
        </motion.div>


      </div>
    </PageWrapper>
  );
};

export default CustomerDashboard;

