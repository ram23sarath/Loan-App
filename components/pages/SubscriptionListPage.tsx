
import React from 'react';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import { useData } from '../../context/DataContext';
import GlassCard from '../ui/GlassCard';
import PageWrapper from '../ui/PageWrapper';
import { HistoryIcon, Trash2Icon, FileDownIcon, WhatsAppIcon, SpinnerIcon } from '../../constants';
import type { SubscriptionWithCustomer } from '../../types';
import { formatDate } from '../../utils/dateFormatter';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

const SubscriptionListPage = () => {
  const { customers, subscriptions, deleteSubscription, isRefreshing } = useData();
  
  const handleDeleteSubscription = async (sub: SubscriptionWithCustomer) => {
    if (window.confirm(`Are you sure you want to delete the subscription for ${sub.customers?.name} for the year ${sub.year}?`)) {
        try {
            await deleteSubscription(sub.id);
        } catch (error: any) {
            alert(error.message);
        }
    }
  };
  
  const handleSendWhatsApp = (sub: SubscriptionWithCustomer) => {
      const customer = customers.find(c => c.id === sub.customer_id);
      if (!customer) {
          alert("Could not find customer information.");
          return;
      }

      const message = `Hi ${customer.name}, your subscription of $${sub.amount} for the year ${sub.year} has been recorded on ${formatDate(sub.date, 'whatsapp')}. Thank you.`;
      const whatsappUrl = `https://wa.me/${customer.phone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
  };

  const handleExport = () => {
    const dataToExport = subscriptions.map(sub => ({
      'Customer Name': sub.customers?.name ?? 'N/A',
      'Amount': sub.amount,
      'Year': sub.year,
      'Date': formatDate(sub.date),
      'Receipt': sub.receipt,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Subscriptions');
    XLSX.writeFile(workbook, 'Subscription_List.xlsx');
  };

  return (
    <PageWrapper>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4 sm:gap-0 px-2 sm:px-0">
        <h2 className="text-2xl sm:text-4xl font-bold flex items-center gap-3 sm:gap-4">
          <HistoryIcon className="w-8 h-8 sm:w-10 sm:h-10"/>
          <span>Subscription Details</span>
          {isRefreshing && <SpinnerIcon className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-indigo-500" />}
        </h2>
        {subscriptions.length > 0 && (
          <motion.button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 transition-colors p-2 sm:p-3 rounded-lg font-semibold w-full sm:w-auto"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FileDownIcon className="w-5 h-5"/>
            <span className="hidden sm:inline">Export to Excel</span>
          </motion.button>
        )}
      </div>

      {subscriptions.length === 0 && !isRefreshing ? (
        <GlassCard>
          <p className="text-center text-gray-500">No subscriptions recorded yet.</p>
        </GlassCard>
      ) : (
        <GlassCard className="!p-2 sm:!p-4">
          <ul className="space-y-4">
            {subscriptions.map(sub => (
              <li key={sub.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-6 py-4 px-2 sm:py-6 sm:px-8 bg-white rounded-xl shadow mb-4 border border-gray-100 w-full">
                <div className="flex flex-col gap-2 flex-1">
                  <span className="font-bold text-lg sm:text-2xl text-indigo-700 break-words">{sub.customers?.name ?? 'Unknown Customer'}</span>
                  <div className="flex flex-wrap gap-2 sm:gap-4 mt-2">
                    <span className="bg-gray-100 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base font-medium text-gray-700 shadow-sm">Receipt: <span className="font-bold text-gray-900">{sub.receipt}</span></span>
                    <span className="bg-cyan-100 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base font-medium text-cyan-800 shadow-sm">Amount: <span className="font-bold">9{sub.amount.toLocaleString()}</span></span>
                    <span className="bg-indigo-100 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base font-medium text-indigo-800 shadow-sm">Year: <span className="font-bold">{sub.year}</span></span>
                    <span className="bg-gray-200 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base font-medium text-gray-700 shadow-sm">Date: <span className="font-bold">{formatDate(sub.date)}</span></span>
                  </div>
                </div>
                <motion.button
                  onClick={() => handleDeleteSubscription(sub)}
                  className="p-2 sm:p-3 rounded-full hover:bg-red-500/10 transition-colors ml-0 sm:ml-4 self-start"
                  aria-label={`Delete subscription for ${sub.customers?.name}`}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Trash2Icon className="w-6 h-6 sm:w-7 sm:h-7 text-red-500" />
                </motion.button>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </PageWrapper>
  );
};

export default SubscriptionListPage;