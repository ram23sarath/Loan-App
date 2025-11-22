import React from 'react';
import { useData } from '../../context/DataContext';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../ui/GlassCard';
import PageWrapper from '../ui/PageWrapper';
import { motion } from 'framer-motion';

const CustomerDashboard = () => {
  const { customers, loans, subscriptions, dataEntries } = useData();
  const navigate = useNavigate();

  // Get the current customer's data
  const customer = customers.length > 0 ? customers[0] : null;
  const totalLoans = loans.length;
  const totalSubscriptions = subscriptions.length;
  const totalMiscEntries = dataEntries.length;

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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Loans Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <GlassCard
              className="!p-6 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate('/loans')}
            >
              <div className="text-center">
                <div className="text-4xl font-bold text-indigo-600 mb-2">
                  {totalLoans}
                </div>
                <p className="text-gray-600 font-medium">Active Loans</p>
                <p className="text-xs text-gray-500 mt-1">
                  Click to view details
                </p>
              </div>
            </GlassCard>
          </motion.div>

          {/* Subscriptions Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <GlassCard
              className="!p-6 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate('/subscriptions')}
            >
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600 mb-2">
                  {totalSubscriptions}
                </div>
                <p className="text-gray-600 font-medium">Subscriptions</p>
                <p className="text-xs text-gray-500 mt-1">
                  Click to view details
                </p>
              </div>
            </GlassCard>
          </motion.div>

          {/* Misc Entries Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <GlassCard
              className="!p-6 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate('/data')}
            >
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-600 mb-2">
                  {totalMiscEntries}
                </div>
                <p className="text-gray-600 font-medium">Misc Entries</p>
                <p className="text-xs text-gray-500 mt-1">
                  Click to view details
                </p>
              </div>
            </GlassCard>
          </motion.div>
        </div>

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
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/add-record')}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Add Record
              </motion.button>
            </div>
          </GlassCard>
        </motion.div>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-6"
        >
          <GlassCard className="!p-6 sm:!p-8 bg-blue-50 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              📋 Your Account Information
            </h3>
            <div className="space-y-2 text-sm text-blue-800">
              <p>
                <span className="font-semibold">Name:</span> {customer?.name}
              </p>
              <p>
                <span className="font-semibold">Phone:</span> {customer?.phone}
              </p>
              <p className="text-xs text-blue-700 mt-4">
                You can view and manage all your loans, subscriptions, and
                miscellaneous entries from this dashboard. Use the navigation
                menu to access different sections.
              </p>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </PageWrapper>
  );
};

export default CustomerDashboard;
