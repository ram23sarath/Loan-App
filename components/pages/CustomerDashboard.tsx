import React from 'react';
import { useData } from '../../context/DataContext';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../ui/GlassCard';
import PageWrapper from '../ui/PageWrapper';
import { motion } from 'framer-motion';
import RequestSeniorityModal from '../ui/RequestSeniorityModal';
import { formatCurrencyIN } from '../../utils/numberFormatter';
import { calculateSummaryData } from '../../utils/summaryCalculations';
import { supabase } from '../../src/lib/supabase';
import type { LoanWithCustomer, SubscriptionWithCustomer, Installment, DataEntry } from '../../types';

const CustomerDashboard = () => {
  const { customers, loans: contextLoans, installments: contextInstallments, subscriptions: contextSubscriptions, dataEntries: contextDataEntries, isScopedCustomer, scopedCustomerId } = useData();
  const navigate = useNavigate();
  const { addToSeniority } = useData();

  const [showRequestModal, setShowRequestModal] = React.useState(false);
  const [stationName, setStationName] = React.useState('');
  const [loanType, setLoanType] = React.useState('General');
  const [loanRequestDate, setLoanRequestDate] = React.useState('');
  const [isSavingRequest, setIsSavingRequest] = React.useState(false);

  // For scoped customers, fetch unfiltered data for summary calculations
  const [loansForSummary, setLoansForSummary] = React.useState<LoanWithCustomer[]>([]);
  const [installmentsForSummary, setInstallmentsForSummary] = React.useState<Installment[]>([]);
  const [subscriptionsForSummary, setSubscriptionsForSummary] = React.useState<SubscriptionWithCustomer[]>([]);
  const [dataEntriesForSummary, setDataEntriesForSummary] = React.useState<DataEntry[]>([]);

  React.useEffect(() => {
    const fetchUnfilteredData = async () => {
      if (isScopedCustomer) {
        try {
          // Fetch all data for summary calculations
          const [loansRes, subscriptionsRes, dataEntriesRes] = await Promise.all([
            supabase.from('loans').select('*, customers(name, phone)'),
            supabase.from('subscriptions').select('*, customers(name, phone)'),
            supabase.from('data_entries').select('*'),
          ]);

          if (loansRes.data) setLoansForSummary(loansRes.data as LoanWithCustomer[]);
          if (subscriptionsRes.data) setSubscriptionsForSummary(subscriptionsRes.data as SubscriptionWithCustomer[]);
          if (dataEntriesRes.data) setDataEntriesForSummary(dataEntriesRes.data as DataEntry[]);

          // Fetch installments for all loans
          if (loansRes.data && loansRes.data.length > 0) {
            const loanIds = (loansRes.data as LoanWithCustomer[]).map(l => l.id);
            const installmentsRes = await supabase.from('installments').select('*').in('loan_id', loanIds);
            if (installmentsRes.data) setInstallmentsForSummary(installmentsRes.data as Installment[]);
          }
        } catch (error) {
          console.error('Error fetching unfiltered data for summary:', error);
        }
      }
    };

    fetchUnfilteredData();
  }, [isScopedCustomer]);

  // Use unfiltered data for scoped customers, context data for admins
  const loans = isScopedCustomer ? loansForSummary : contextLoans;
  const installments = isScopedCustomer ? installmentsForSummary : contextInstallments;
  const subscriptions = isScopedCustomer ? subscriptionsForSummary : contextSubscriptions;
  const dataEntries = isScopedCustomer ? dataEntriesForSummary : contextDataEntries;

  // Get the current customer's data
  const customer = isScopedCustomer && scopedCustomerId 
    ? customers.find(c => c.id === scopedCustomerId)
    : customers.length > 0 ? customers[0] : null;

  // --- Summary Data Calculations using shared utility ---
  const summaryData = React.useMemo(
    () => calculateSummaryData(loans, installments, subscriptions, dataEntries),
    [loans, installments, subscriptions, dataEntries]
  );

  const {
    totalInterestCollected,
    totalLateFeeCollected,
    totalSubscriptionCollected,
    subscriptionReturnTotal,
    subscriptionBalance,
    totalExpenses,
    expenseTotalsBySubtype,
    totalAllCollected,
    totalLoansGiven,
    totalPrincipalRecovered,
    loanBalance,
  } = summaryData;

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

        {/* Summary Dashboard - Income and Expenses */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Income Section */}
            <GlassCard className="!p-6 sm:!p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                  ₹
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Income
                  </div>
                  <div className="text-xs text-gray-400">
                    Collections & recoveries
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col items-center p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                  <span className="text-sm font-medium text-indigo-800 uppercase">
                    Total Collected
                  </span>
                  <span className="text-3xl font-bold text-indigo-700 mt-2">
                    {formatCurrencyIN(totalAllCollected)}
                  </span>
                </div>

                <div className="flex flex-col items-center p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <span className="text-sm font-medium text-blue-800 uppercase">
                    Loan Recovery (Principal)
                  </span>
                  <span className="text-2xl font-bold text-blue-700 mt-2">
                    {formatCurrencyIN(totalPrincipalRecovered)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center p-3 rounded-lg bg-green-50 border border-green-200">
                    <span className="text-xs font-medium text-green-700">Interest</span>
                    <span className="text-sm font-bold text-green-800 mt-1">
                      {formatCurrencyIN(totalInterestCollected)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <span className="text-xs font-medium text-orange-700">Late Fees</span>
                    <span className="text-sm font-bold text-orange-800 mt-1">
                      {formatCurrencyIN(totalLateFeeCollected)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-lg bg-cyan-50 border border-cyan-200">
                    <span className="text-xs font-medium text-cyan-700">Subscriptions</span>
                    <span className="text-sm font-bold text-cyan-800 mt-1">
                      {formatCurrencyIN(totalSubscriptionCollected)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-center p-4 rounded-lg bg-cyan-50 border border-cyan-200">
                  <span className="text-sm font-medium text-cyan-800 mb-3">Subscriptions Balance</span>
                  <div className="w-full space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Subscriptions</span>
                      <span className="font-medium text-cyan-700">{formatCurrencyIN(totalSubscriptionCollected)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Return</span>
                      <span className="font-medium text-cyan-700">{formatCurrencyIN(subscriptionReturnTotal)}</span>
                    </div>
                    <div className="border-t border-cyan-200 pt-2 flex justify-between">
                      <span className="font-medium text-cyan-800">Balance</span>
                      <span className={`font-bold ${subscriptionBalance < 0 ? "text-red-600" : "text-cyan-800"}`}>
                        {formatCurrencyIN(subscriptionBalance)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick summary: Loan Balance (moved to Income column to avoid confusion in desktop two-column layout) */}
                <div className="w-full mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 flex flex-col items-start">
                    <div className="text-xs text-gray-600">Loan Balance</div>
                    <div className="text-lg font-bold text-blue-800 mt-1">{formatCurrencyIN(loanBalance)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-cyan-50 border border-cyan-100 flex flex-col items-start">
                    <div className="text-xs text-gray-600">Subscription Balance</div>
                    <div className="text-lg font-bold text-cyan-800 mt-1">{formatCurrencyIN(subscriptionBalance)}</div>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Expenses Section */}
            <GlassCard className="!p-6 sm:!p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-700 font-bold">
                  -
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Expenses
                  </div>
                  <div className="text-xs text-gray-400">
                    Outgoing & disbursed principal
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col items-center p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <span className="text-sm font-medium text-blue-800 uppercase">
                    Total Loans Given
                  </span>
                  <span className="text-3xl font-bold text-blue-700 mt-2">
                    {formatCurrencyIN(totalLoansGiven)}
                  </span>
                </div>

                <div className="flex flex-col items-center p-4 rounded-lg bg-red-50 border border-red-200">
                  <span className="text-sm font-medium text-red-800 uppercase">
                    Expenses
                  </span>
                  <span className="text-2xl font-bold text-red-700 mt-2">
                    {formatCurrencyIN(totalExpenses)}
                  </span>
                </div>

                <div className="space-y-2">
                  {Object.entries(expenseTotalsBySubtype).map(([subtype, amt]) => (
                    <div key={subtype} className="flex justify-between items-center p-2 rounded-md bg-red-50 border border-red-100 text-sm">
                      <span className="text-gray-700">{subtype}</span>
                      <span className="font-medium text-red-700">{formatCurrencyIN(amt || 0)}</span>
                    </div>
                  ))}
                </div>
                {/* Loan Balance moved to Income section above to avoid confusion in desktop two-column layout */}
              </div>
            </GlassCard>
          </div>
        </motion.div>


      </div>
    </PageWrapper>
  );
};

export default CustomerDashboard;

