import React from 'react';
import { useData } from '../../context/DataContext';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../ui/GlassCard';
import PageWrapper from '../ui/PageWrapper';
import { motion } from 'framer-motion';
import RequestSeniorityModal from '../ui/RequestSeniorityModal';

const CustomerDashboard = () => {
  const {
    customers,
    customerMap,
    isScopedCustomer,
    scopedCustomerId,
    loans,
    installmentsByLoanId,
    seniorityList,
  } = useData();
  const navigate = useNavigate();

  const [showRequestModal, setShowRequestModal] = React.useState(false);
  const [stationName, setStationName] = React.useState('');
  const [loanType, setLoanType] = React.useState('General');
  const [loanRequestDate, setLoanRequestDate] = React.useState('');

  // Get the current customer's data
  const customer = isScopedCustomer && scopedCustomerId
    ? customerMap.get(scopedCustomerId)
    : customers.length > 0 ? customers[0] : null;

  const customerLoans = React.useMemo(() => {
    if (!customer) return [];
    return loans.filter((loan) => loan.customer_id === customer.id);
  }, [customer, loans]);

  const hasPendingSeniorityRequest = React.useMemo(() => {
    if (!customer) return false;
    return seniorityList.some((entry) => entry.customer_id === customer.id);
  }, [customer, seniorityList]);

  const repaymentProgress = React.useMemo(() => {
    if (!customerLoans.length) return 0;

    let maxProgress = 0;
    customerLoans.forEach((loan) => {
      const loanInstallments = installmentsByLoanId.get(loan.id) || [];
      const paidAmount = loanInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
      const totalRepayable = (loan.original_amount || 0) + (loan.interest_amount || 0);
      if (totalRepayable > 0) {
        const progress = Math.min(paidAmount / totalRepayable, 1);
        if (progress > maxProgress) {
          maxProgress = progress;
        }
      }
    });

    return maxProgress;
  }, [customerLoans, installmentsByLoanId]);

  const meetsRepaymentThreshold = repaymentProgress >= 0.8;
  const canRequest = Boolean(isScopedCustomer && customer && !hasPendingSeniorityRequest && meetsRepaymentThreshold);
  const progressPercent = Math.round(repaymentProgress * 100);
  const requestDisabledReason = !customer
    ? 'No customer found for this account.'
    : hasPendingSeniorityRequest
      ? 'Request already submitted and pending.'
      : !meetsRepaymentThreshold
        ? `You need at least 80% repayment (current ${progressPercent}%).`
        : undefined;


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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-dark-text mb-2">
              Welcome, {customer?.name}!
            </h1>
            <p className="text-gray-600 dark:text-dark-muted text-sm sm:text-base">
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
          isScopedCustomer={isScopedCustomer}
        />



        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <GlassCard className="!p-6 sm:!p-8">
            <h2 className="text-xl font-bold text-gray-800 dark:text-dark-text mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/summary')}
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                View Summary Dashboard
              </motion.button>
              {isScopedCustomer && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (!canRequest) return;
                    // default requested date to today
                    const today = new Date().toISOString().slice(0, 10);
                    setLoanRequestDate(today);
                    setShowRequestModal(true);
                  }}
                  title={requestDisabledReason}
                  disabled={!canRequest}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors md:col-span-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Request Loan/Subscription
                </motion.button>
              )}
            </div>
            {isScopedCustomer && (
              <p className="mt-2 text-sm text-gray-700 dark:text-dark-muted">
                {hasPendingSeniorityRequest
                  ? 'Your request is already in the loan seniority list.'
                  : meetsRepaymentThreshold
                    ? `Eligibility met: ${progressPercent}% of loan repayment completed.`
                    : `Eligibility blocked until 80% repayment is completed. Current progress: ${progressPercent}%.`}
              </p>
            )}
          </GlassCard>
        </motion.div>




      </div>
    </PageWrapper>
  );
};

export default CustomerDashboard;

