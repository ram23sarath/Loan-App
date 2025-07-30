
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
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-4xl font-bold flex items-center gap-4">
          <HistoryIcon className="w-10 h-10"/>
          <span>Subscription Details</span>
          {isRefreshing && <SpinnerIcon className="w-8 h-8 animate-spin text-indigo-500" />}
        </h2>
        {subscriptions.length > 0 && (
          <motion.button
            onClick={handleExport}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 transition-colors p-3 rounded-lg font-semibold"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FileDownIcon className="w-5 h-5"/>
            Export to Excel
          </motion.button>
        )}
      </div>

      {subscriptions.length === 0 && !isRefreshing ? (
        <GlassCard>
          <p className="text-center text-gray-500">No subscriptions recorded yet.</p>
        </GlassCard>
      ) : (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {subscriptions.map(sub => (
          <GlassCard key={sub.id} variants={itemVariants} whileHover={{y: -5, transition: { duration: 0.2 }}}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold">{sub.customers?.name ?? 'Unknown Customer'}</h3>
                <p className="text-xs text-gray-400">Receipt: {sub.receipt}</p>
              </div>
              <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-cyan-600">${sub.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">For Year: {sub.year}</p>
                  </div>
                   <motion.button
                        onClick={() => handleSendWhatsApp(sub)}
                        className="p-2 rounded-full hover:bg-green-500/10 transition-colors"
                        aria-label="Send on WhatsApp"
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <WhatsAppIcon className="w-5 h-5 text-green-500" />
                    </motion.button>
                   <motion.button
                        onClick={() => handleDeleteSubscription(sub)}
                        className="p-2 rounded-full hover:bg-red-500/10 transition-colors"
                        aria-label={`Delete subscription for ${sub.customers?.name}`}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <Trash2Icon className="w-5 h-5 text-red-500" />
                    </motion.button>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between text-sm text-gray-600">
                <span>Date: {formatDate(sub.date)}</span>
            </div>
          </GlassCard>
        ))}
      </motion.div>
      )}
    </PageWrapper>
  );
};

export default SubscriptionListPage;
