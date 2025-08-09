import React from 'react';
import SubscriptionTableView from './SubscriptionTableView';
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
  const { customers, subscriptions, loans, installments, deleteSubscription, isRefreshing } = useData();

  // --- Summary Calculations ---
  // 1. Total Interest Collected
  const totalInterestCollected = loans.reduce((acc, loan) => {
    const loanInstallments = installments.filter(i => i.loan_id === loan.id);
    const totalPaidForLoan = loanInstallments.reduce((sum, inst) => sum + inst.amount, 0);
    if (totalPaidForLoan > loan.original_amount) {
      const interestCollected = Math.min(totalPaidForLoan - loan.original_amount, loan.interest_amount);
      return acc + interestCollected;
    }
    return acc;
  }, 0);

  // 2. Total Late Fee Collected
  const totalLateFeeCollected = installments.reduce((acc, inst) => acc + (inst.late_fee || 0), 0);

  // 3. Total Subscription Collected
  const totalSubscriptionCollected = subscriptions.reduce((acc, sub) => acc + (sub.amount || 0), 0);

  // 4. Sum of above three
  const totalAllCollected = totalInterestCollected + totalLateFeeCollected + totalSubscriptionCollected;

  // 5. Total Repayable for all customers (Total Loans Given)
  const totalLoansGiven = loans.reduce((acc, loan) => acc + loan.original_amount + loan.interest_amount, 0);
  const [tableView, setTableView] = React.useState(true); // Table view as default
  
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

      const message = `Hi ${customer.name}, your subscription of ₹${sub.amount} for the year ${sub.year} has been recorded on ${formatDate(sub.date, 'whatsapp')}. Thank you.`;
      const whatsappUrl = `https://wa.me/${customer.phone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
  };
    
  const handleExport = () => {
    // Prepare subscription data as arrays
    const allRows = [
      ['Customer Name', 'Amount', 'Year', 'Date', 'Receipt'],
      ...subscriptions.map(sub => [
        sub.customers?.name ?? 'N/A',
        sub.amount,
        sub.year,
        formatDate(sub.date),
        sub.receipt,
      ])
    ];

    // Create worksheet from array of arrays
    const worksheet = XLSX.utils.aoa_to_sheet(allRows);

    // Set fixed column widths (no auto-fit) - simple and consistent
    worksheet['!cols'] = [
      { wch: 20 }, // Customer Name
      { wch: 12 }, // Amount
      { wch: 8 },  // Year
      { wch: 12 }, // Date
      { wch: 12 }  // Receipt
    ];

    // Style the column header row (row 0)
    for (let col = 0; col < 5; col++) {
      const headerCell = XLSX.utils.encode_cell({ r: 0, c: col });
      if (worksheet[headerCell]) {
        if (!worksheet[headerCell].s) {
          worksheet[headerCell].s = {};
        }
        worksheet[headerCell].s.font = {
          bold: true
        };
        worksheet[headerCell].s.alignment = {
          horizontal: 'center',
          vertical: 'center'
        };
        worksheet[headerCell].s.fill = {
          fgColor: { rgb: "F0F0F0" } // Light gray background
        };
      }
    }

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
        <div className="flex items-center gap-4">
            {subscriptions.length > 0 && (
                <motion.button
                    onClick={handleExport}
                    className="flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 transition-colors p-2 sm:p-3 rounded-lg font-semibold w-auto"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <FileDownIcon className="w-5 h-5"/>
                    <span className="hidden sm:inline">Export</span>
                </motion.button>
            )}
            <button
                onClick={() => setTableView(v => !v)}
                className="px-3 py-2 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100 transition-colors"
            >
                {tableView ? 'Card View' : 'Table View'}
            </button>
        </div>
      </div>

      {tableView ? (
        <SubscriptionTableView />
      ) : (
        <>
            {subscriptions.length > 0 ? (
                <GlassCard className="!p-2 sm:!p-4">
                    <motion.ul 
                        className="space-y-4"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {subscriptions.map(sub => (
                            <motion.li 
                                key={sub.id} 
                                variants={itemVariants}
                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-6 py-4 px-2 sm:py-6 sm:px-8 bg-white rounded-xl shadow border border-gray-100 w-full"
                            >
                                <div className="flex flex-col gap-2 flex-1">
                                    <span className="font-bold text-lg sm:text-2xl text-indigo-700 break-words">{sub.customers?.name ?? 'Unknown Customer'}</span>
                                    <div className="flex flex-wrap gap-2 sm:gap-4 mt-2">
                                        <span className="bg-gray-100 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base font-medium text-gray-700 shadow-sm">Receipt: <span className="font-bold text-gray-900">{sub.receipt}</span></span>
                                        <span className="bg-cyan-100 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base font-medium text-cyan-800 shadow-sm">Amount: <span className="font-bold">₹{sub.amount.toLocaleString()}</span></span>
                                        <span className="bg-indigo-100 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base font-medium text-indigo-800 shadow-sm">Year: <span className="font-bold">{sub.year}</span></span>
                                        <span className="bg-gray-200 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base font-medium text-gray-700 shadow-sm">Date: <span className="font-bold">{formatDate(sub.date)}</span></span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 self-start sm:self-center">
                                     <motion.button
                                        onClick={() => handleSendWhatsApp(sub)}
                                        className="p-2 sm:p-3 rounded-full hover:bg-green-500/10 transition-colors"
                                        aria-label="Send on WhatsApp"
                                        whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                                    >
                                        <WhatsAppIcon className="w-6 h-6 sm:w-7 sm:h-7 text-green-500" />
                                    </motion.button>
                                    <motion.button
                                        onClick={() => handleDeleteSubscription(sub)}
                                        className="p-2 sm:p-3 rounded-full hover:bg-red-500/10 transition-colors"
                                        aria-label={`Delete subscription for ${sub.customers?.name}`}
                                        whileHover={{ scale: 1.2 }}
                                        whileTap={{ scale: 0.9 }}
                                    >
                                        <Trash2Icon className="w-6 h-6 sm:w-7 sm:h-7 text-red-500" />
                                    </motion.button>
                                </div>
                            </motion.li>
                        ))}
                    </motion.ul>
                </GlassCard>
            ) : (
                !isRefreshing && (
                    <GlassCard>
                        <p className="text-center text-gray-500">No subscriptions recorded yet.</p>
                    </GlassCard>
                )
            )}
        </>
      )}
    </PageWrapper>
  );
};

export default SubscriptionListPage;
