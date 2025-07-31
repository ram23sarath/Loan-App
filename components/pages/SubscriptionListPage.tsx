
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
        <GlassCard className="!p-2">
          <ul className="divide-y divide-gray-200">
            {subscriptions.map(sub => (
              <li key={sub.id} className="flex items-center justify-between py-2">
                <div className="flex flex-col">
                  <span className="font-bold text-base">{sub.customers?.name ?? 'Unknown Customer'}</span>
                  <span className="text-xs text-gray-400">Receipt: {sub.receipt}</span>
                  <span className="text-xs text-cyan-600">Amount: ${sub.amount.toLocaleString()} | Year: {sub.year}</span>
                  <span className="text-xs text-gray-500">Date: {formatDate(sub.date)}</span>
                </div>
                {/* ...existing code for actions... */}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </PageWrapper>
  );
};

export default SubscriptionListPage;