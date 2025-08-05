import React from 'react';
import LoanTableView from './LoanTableView';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import { useData } from '../../context/DataContext';
import GlassCard from '../ui/GlassCard';
import PageWrapper from '../ui/PageWrapper';
import { LandmarkIcon, Trash2Icon, FileDownIcon, WhatsAppIcon, SpinnerIcon } from '../../constants';
import type { LoanWithCustomer, Installment } from '../../types';
import { formatDate } from '../../utils/dateFormatter';

const LoanListPage = () => {
    const { customers, loans, installments, deleteLoan, deleteInstallment, deleteCustomer, isRefreshing } = useData();
    const [tableView, setTableView] = React.useState(true); // Table view is default

    // State for managing delete confirmation modals
    const [deleteTarget, setDeleteTarget] = React.useState<LoanWithCustomer | null>(null);
    const [deleteInstallmentTarget, setDeleteInstallmentTarget] = React.useState<{id: string, number: number} | null>(null);
    const [deleteCustomerTarget, setDeleteCustomerTarget] = React.useState<{id: string, name: string} | null>(null);

    // FIX: State for expanded cards is moved to the top level to follow the Rules of Hooks.
    const [expandedLoans, setExpandedLoans] = React.useState<Record<string, boolean>>({});

    const toggleLoanExpansion = (loanId: string) => {
        setExpandedLoans(prev => ({
            ...prev,
            [loanId]: !prev[loanId], // Toggle the boolean value for the specific loanId
        }));
    };

    // --- Data Calculations ---
    const totalInterestCollected = loans.reduce((acc, loan) => {
        const loanInstallments = installments.filter(i => i.loan_id === loan.id);
        const totalPaidForLoan = loanInstallments.reduce((sum, inst) => sum + inst.amount, 0);
        if (totalPaidForLoan > loan.original_amount) {
            const interestCollected = Math.min(
                totalPaidForLoan - loan.original_amount,
                loan.interest_amount
            );
            return acc + interestCollected;
        }
        return acc;
    }, 0);

    const totalLateFeeCollected = installments.reduce((acc, inst) => acc + (inst.late_fee || 0), 0);

    // --- Delete Handlers ---
    const handleDeleteLoan = (loan: LoanWithCustomer) => setDeleteTarget(loan);
    const cancelDeleteLoan = () => setDeleteTarget(null);
    const confirmDeleteLoan = async () => {
        if (deleteTarget) {
            try {
                await deleteLoan(deleteTarget.id);
                setDeleteTarget(null);
            } catch (error: any) {
                alert(error.message);
            }
        }
    };

    const handleDeleteInstallment = (installmentId: string, installmentNumber: number) => {
        setDeleteInstallmentTarget({ id: installmentId, number: installmentNumber });
    };
    const cancelDeleteInstallment = () => setDeleteInstallmentTarget(null);
    const confirmDeleteInstallment = async () => {
        if (deleteInstallmentTarget) {
            try {
                await deleteInstallment(deleteInstallmentTarget.id);
                setDeleteInstallmentTarget(null);
            } catch (error: any) {
                alert(error.message);
            }
        }
    };

    const handleDeleteCustomer = (customerId: string, customerName: string) => {
        setDeleteCustomerTarget({ id: customerId, name: customerName });
    };
    const cancelDeleteCustomer = () => setDeleteCustomerTarget(null);
    const confirmDeleteCustomer = async () => {
        if (deleteCustomerTarget) {
            try {
                await deleteCustomer(deleteCustomerTarget.id);
                setDeleteCustomerTarget(null);
            } catch (error: any) {
                alert(error.message);
            }
        }
    };

    // --- Action Handlers ---
    const handleSendWhatsApp = (loan: LoanWithCustomer, latestInstallment: Installment | null) => {
        const customer = customers.find(c => c.id === loan.customer_id);
        if (!customer) {
            alert("Could not find customer information.");
            return;
        }

        let message = '';
        if (latestInstallment) {
            let paymentMessage = `your installment payment of ₹${latestInstallment.amount}`;
            if (latestInstallment.late_fee && latestInstallment.late_fee > 0) {
                paymentMessage += ` (including a ₹${latestInstallment.late_fee} late fee)`;
            }
            message = `Hi ${customer.name}, ${paymentMessage} (Installment #${latestInstallment.installment_number}) was received on ${formatDate(latestInstallment.date, 'whatsapp')}. Thank you.`;
        } else {
            const totalRepayable = loan.original_amount + loan.interest_amount;
            message = `Hi ${customer.name}, this is a confirmation of your loan of ₹${loan.original_amount} taken on ${formatDate(loan.payment_date, 'whatsapp')}. Total repayable is ₹${totalRepayable}. Thank you.`;
        }

        const whatsappUrl = `https://wa.me/${customer.phone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    const handleExport = () => {
        const dataToExport = loans.map(loan => {
            const loanInstallments = installments.filter(i => i.loan_id === loan.id);
            const amountPaid = loanInstallments.reduce((acc, inst) => acc + inst.amount, 0);
            const lateFeesPaid = loanInstallments.reduce((acc, inst) => acc + (inst.late_fee || 0), 0);
            const totalRepayable = loan.original_amount + loan.interest_amount;
            const isPaidOff = amountPaid >= totalRepayable;

            return {
                'Customer Name': loan.customers?.name ?? 'N/A',
                'Original Amount': loan.original_amount,
                'Interest Amount': loan.interest_amount,
                'Total Repayable': totalRepayable,
                'Amount Paid': amountPaid,
                'Late Fees Paid': lateFeesPaid,
                'Balance': totalRepayable - amountPaid,
                'Loan Date': formatDate(loan.payment_date),
                'Installments': `${loanInstallments.length} / ${loan.total_instalments}`,
                'Status': isPaidOff ? 'Paid Off' : 'In Progress',
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Loans');
        XLSX.writeFile(workbook, 'Loan_List.xlsx');
    };

    return (
        <PageWrapper>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4 sm:gap-0 px-2 sm:px-0">
                <h2 className="text-2xl sm:text-4xl font-bold flex items-center gap-3 sm:gap-4">
                    <LandmarkIcon className="w-8 h-8 sm:w-10 sm:h-10"/>
                    <span>Loan Details</span>
                    {isRefreshing && <SpinnerIcon className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-indigo-500" />}
                </h2>
                {loans.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
                        <GlassCard className="!p-3 sm:!p-4 w-full sm:w-auto">
                            <p className="text-xs sm:text-sm text-gray-500">Total Interest Collected</p>
                            <p className="text-xl sm:text-2xl font-bold text-green-600">₹{totalInterestCollected.toLocaleString()}</p>
                        </GlassCard>
                        <GlassCard className="!p-3 sm:!p-4 w-full sm:w-auto">
                            <p className="text-xs sm:text-sm text-gray-500">Total Late Fee Collected</p>
                            <p className="text-xl sm:text-2xl font-bold text-orange-600">₹{totalLateFeeCollected.toLocaleString()}</p>
                        </GlassCard>
                        <motion.button
                            onClick={handleExport}
                            className="flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 transition-colors p-2 sm:p-3 rounded-lg font-semibold w-full sm:w-auto"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <FileDownIcon className="w-5 h-5"/>
                            <span className="hidden sm:inline">Export</span>
                        </motion.button>
                        <button
                            onClick={() => setTableView(v => !v)}
                            className="ml-0 sm:ml-2 px-3 py-2 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100 transition-colors"
                        >
                            {tableView ? 'Card View' : 'Table View'}
                        </button>
                    </div>
                )}
            </div>

            {/* FIX: Content rendering logic is restructured for clarity and correctness */}
            {tableView ? (
                <LoanTableView />
            ) : (
                <>
                    {loans.length > 0 ? (
                        <GlassCard className="!p-2 sm:!p-4">
                            <ul className="space-y-4">
                                {loans.map(loan => {
                                    const loanInstallments = installments.filter(i => i.loan_id === loan.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                    const latestInstallment = loanInstallments.length > 0 ? loanInstallments[0] : null;
                                    const amountPaid = loanInstallments.reduce((acc, inst) => acc + inst.amount, 0);
                                    const totalRepayable = loan.original_amount + loan.interest_amount;
                                    const progressPercentage = totalRepayable > 0 ? (amountPaid / totalRepayable) * 100 : 0;
                                    const isPaidOff = amountPaid >= totalRepayable;
                                    // FIX: 'expanded' state is now derived from the component-level state
                                    const expanded = !!expandedLoans[loan.id];
                                    
                                    return (
                                        <li key={loan.id} className="py-4 px-2 sm:py-6 sm:px-8 bg-white rounded-xl shadow border border-gray-100 w-full">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
                                                <div className="flex flex-col gap-2 flex-1">
                                                    <button
                                                        className="font-bold text-lg sm:text-2xl text-indigo-700 break-words text-left hover:underline focus:outline-none"
                                                        // FIX: Use the new handler to toggle expansion state
                                                        onClick={() => toggleLoanExpansion(loan.id)}
                                                        aria-expanded={expanded}
                                                    >
                                                        {loan.customers?.name ?? 'Unknown Customer'}
                                                    </button>
                                                    <div className="flex flex-wrap gap-2 sm:gap-4 mt-2">
                                                        <span className="bg-gray-100 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base font-medium text-gray-700 shadow-sm">Loan: <span className="font-bold text-gray-900">₹{loan.original_amount.toLocaleString()}</span></span>
                                                        <span className="bg-yellow-100 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base font-medium text-yellow-800 shadow-sm">Interest: <span className="font-bold">₹{loan.interest_amount.toLocaleString()}</span></span>
                                                        <span className="bg-green-100 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base font-medium text-green-800 shadow-sm">Paid: <span className="font-bold">₹{amountPaid.toLocaleString()}</span></span>
                                                        <span className="bg-indigo-100 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base font-medium text-indigo-800 shadow-sm">Total: <span className="font-bold">₹{totalRepayable.toLocaleString()}</span></span>
                                                        <span className="bg-gray-200 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base font-medium text-gray-700 shadow-sm">Installments: <span className="font-bold">{loanInstallments.length} / {loan.total_instalments}</span></span>
                                                    </div>
                                                    {/* Collapsible Installments */}
                                                    {expanded && loanInstallments.length > 0 && (
                                                        <div className="mt-4 border rounded-lg bg-gray-50 p-3">
                                                            <h4 className="font-semibold text-gray-700 mb-2">Installments Paid</h4>
                                                            <ul className="space-y-2">
                                                                {loanInstallments.map(inst => (
                                                                    <li key={inst.id} className="flex flex-row justify-between items-center bg-white rounded px-3 py-2 border border-gray-200">
                                                                        <div>
                                                                            <span className="font-medium">#{inst.installment_number}</span>
                                                                            <span className="ml-2 text-gray-600">{formatDate(inst.date)}</span>
                                                                            <span className="ml-2 text-green-700 font-semibold">₹{inst.amount.toLocaleString()}</span>
                                                                            {inst.late_fee > 0 && <span className="ml-2 text-orange-500 text-xs">(+₹{inst.late_fee} late)</span>}
                                                                            <span className="ml-2 text-gray-500 text-xs">Receipt: {inst.receipt_number}</span>
                                                                        </div>
                                                                        <motion.button
                                                                            onClick={() => handleDeleteInstallment(inst.id, inst.installment_number)}
                                                                            className="p-1 rounded-full hover:bg-red-500/10 transition-colors"
                                                                            aria-label={`Delete installment #${inst.installment_number}`}
                                                                            whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                                                                        >
                                                                            <Trash2Icon className="w-4 h-4 text-red-500" />
                                                                        </motion.button>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-row sm:flex-col gap-2 sm:gap-4 items-end sm:items-end justify-end">
                                                    <motion.button
                                                        onClick={() => handleSendWhatsApp(loan, latestInstallment)}
                                                        className="p-2 sm:p-3 rounded-full hover:bg-green-500/10 transition-colors"
                                                        aria-label="Send on WhatsApp"
                                                        whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                                                    >
                                                        <WhatsAppIcon className="w-6 h-6 sm:w-7 sm:h-7 text-green-500" />
                                                    </motion.button>
                                                    <motion.button
                                                        onClick={() => handleDeleteLoan(loan)}
                                                        className="p-2 sm:p-3 rounded-full hover:bg-red-500/10 transition-colors"
                                                        aria-label={`Delete loan for ${loan.customers?.name}`}
                                                        whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                                                    >
                                                        <Trash2Icon className="w-6 h-6 sm:w-7 sm:h-7 text-red-500" />
                                                    </motion.button>
                                                </div>
                                            </div>
                                            {/* Progress Bar */}
                                            <div className="mt-4 pt-4 border-t border-gray-200">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-base sm:text-lg mb-2 gap-1 sm:gap-0">
                                                    <span className="text-gray-600">Progress</span>
                                                    <span className={`font-semibold ${isPaidOff ? 'text-green-600' : 'text-gray-800'}`}>{loanInstallments.length} of {loan.total_instalments} Paid</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2.5 sm:h-3">
                                                    <motion.div 
                                                        className={`h-2.5 sm:h-3 rounded-full ${isPaidOff ? 'bg-green-500' : 'bg-indigo-500'}`} 
                                                        initial={{width: 0}}
                                                        animate={{width: `${progressPercentage}%`}}
                                                        transition={{duration: 0.5}}
                                                    />
                                                </div>
                                                <div className="flex justify-between items-center text-xs sm:text-base mt-2 text-gray-500">
                                                    <span>₹{amountPaid.toLocaleString()}</span>
                                                    <span>₹{totalRepayable.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </GlassCard>
                    ) : (
                        !isRefreshing && (
                            <GlassCard>
                                <p className="text-center text-gray-500">No loans recorded yet.</p>
                            </GlassCard>
                        )
                    )}
                </>
            )}

            {/* Modals for Deletion Confirmation (No changes needed here) */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-2">
                    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-xs sm:max-w-sm">
                        <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">Delete Loan</h3>
                        <p className="mb-4 sm:mb-6 text-sm sm:text-base">Are you sure you want to delete this loan for <span className="font-semibold">{deleteTarget.customers?.name ?? 'Unknown Customer'}</span>? This will also delete all associated installments.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={cancelDeleteLoan} className="px-3 py-2 rounded text-xs sm:text-base bg-gray-200 hover:bg-gray-300">Cancel</button>
                            <button onClick={confirmDeleteLoan} className="px-3 py-2 rounded text-xs sm:text-base bg-red-600 text-white hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}
            {deleteInstallmentTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-2">
                    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-xs sm:max-w-sm">
                        <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">Delete Installment</h3>
                        <p className="mb-4 sm:mb-6 text-sm sm:text-base">Are you sure you want to delete installment #{deleteInstallmentTarget.number}?</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={cancelDeleteInstallment} className="px-3 py-2 rounded text-xs sm:text-base bg-gray-200 hover:bg-gray-300">Cancel</button>
                            <button onClick={confirmDeleteInstallment} className="px-3 py-2 rounded text-xs sm:text-base bg-red-600 text-white hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}
            {deleteCustomerTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-2">
                    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-xs sm:max-w-sm">
                        <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">Delete Customer</h3>
                        <p className="mb-4 sm:mb-6 text-sm sm:text-base">Are you sure you want to delete <span className="font-semibold">{deleteCustomerTarget.name}</span>? This will also delete all associated loans, subscriptions, and installments.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={cancelDeleteCustomer} className="px-3 py-2 rounded text-xs sm:text-base bg-gray-200 hover:bg-gray-300">Cancel</button>
                            <button onClick={confirmDeleteCustomer} className="px-3 py-2 rounded text-xs sm:text-base bg-red-600 text-white hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </PageWrapper>
    );
};

export default LoanListPage;