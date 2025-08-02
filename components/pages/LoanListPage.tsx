import React from 'react';
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

    // State for managing delete confirmation modals
    const [deleteTarget, setDeleteTarget] = React.useState<LoanWithCustomer | null>(null);
    const [deleteInstallmentTarget, setDeleteInstallmentTarget] = React.useState<{id: string, number: number} | null>(null);
    const [deleteCustomerTarget, setDeleteCustomerTarget] = React.useState<{id: string, name: string} | null>(null);

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
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-4xl font-bold flex items-center gap-4">
                    <LandmarkIcon className="w-10 h-10"/>
                    <span>Loan Details</span>
                    {isRefreshing && <SpinnerIcon className="w-8 h-8 animate-spin text-indigo-500" />}
                </h2>
                {loans.length > 0 && (
                    <div className="flex items-center gap-4">
                        <GlassCard className="!p-4">
                            <p className="text-sm text-gray-500">Total Interest Collected</p>
                            <p className="text-2xl font-bold text-green-600">₹{totalInterestCollected.toLocaleString()}</p>
                        </GlassCard>
                        <GlassCard className="!p-4">
                            <p className="text-sm text-gray-500">Total Late Fee Collected</p>
                            <p className="text-2xl font-bold text-orange-600">₹{totalLateFeeCollected.toLocaleString()}</p>
                        </GlassCard>
                        <motion.button
                            onClick={handleExport}
                            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 transition-colors p-3 rounded-lg font-semibold h-full"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <FileDownIcon className="w-5 h-5"/>
                            Export
                        </motion.button>
                    </div>
                )}
            </div>

            {/* Content */}
            {loans.length === 0 && !isRefreshing ? (
                <GlassCard>
                    <p className="text-center text-gray-500">No loans recorded yet.</p>
                </GlassCard>
            ) : (
                <GlassCard className="!p-2">
                    <ul className="space-y-4">
                        {loans.map(loan => {
                            const loanInstallments = installments.filter(i => i.loan_id === loan.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                            const latestInstallment = loanInstallments.length > 0 ? loanInstallments[0] : null;
                            const amountPaid = loanInstallments.reduce((acc, inst) => acc + inst.amount, 0);
                            const totalRepayable = loan.original_amount + loan.interest_amount;
                            const progressPercentage = totalRepayable > 0 ? (amountPaid / totalRepayable) * 100 : 0;
                            const isPaidOff = amountPaid >= totalRepayable;

                            return (
                                <li key={loan.id} className="py-6 px-8 bg-white rounded-xl shadow border border-gray-100 w-full">
                                    <div className="flex flex-row items-center justify-between gap-6">
                                        <div className="flex flex-col gap-2 flex-1">
                                            <span className="font-bold text-2xl text-indigo-700">{loan.customers?.name ?? 'Unknown Customer'}</span>
                                            <div className="flex flex-wrap gap-4 mt-2">
                                                <span className="bg-gray-100 rounded-lg px-4 py-2 text-base font-medium text-gray-700 shadow-sm">Loan: <span className="font-bold text-gray-900">₹{loan.original_amount.toLocaleString()}</span></span>
                                                <span className="bg-yellow-100 rounded-lg px-4 py-2 text-base font-medium text-yellow-800 shadow-sm">Interest: <span className="font-bold">₹{loan.interest_amount.toLocaleString()}</span></span>
                                                <span className="bg-green-100 rounded-lg px-4 py-2 text-base font-medium text-green-800 shadow-sm">Paid: <span className="font-bold">₹{amountPaid.toLocaleString()}</span></span>
                                                <span className="bg-indigo-100 rounded-lg px-4 py-2 text-base font-medium text-indigo-800 shadow-sm">Total: <span className="font-bold">₹{totalRepayable.toLocaleString()}</span></span>
                                                <span className="bg-gray-200 rounded-lg px-4 py-2 text-base font-medium text-gray-700 shadow-sm">Installments: <span className="font-bold">{loanInstallments.length} / {loan.total_instalments}</span></span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-4 items-end">
                                            <motion.button
                                                onClick={() => handleSendWhatsApp(loan, latestInstallment)}
                                                className="p-3 rounded-full hover:bg-green-500/10 transition-colors"
                                                aria-label="Send on WhatsApp"
                                                whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                                            >
                                                <WhatsAppIcon className="w-7 h-7 text-green-500" />
                                            </motion.button>
                                            <motion.button
                                                onClick={() => handleDeleteLoan(loan)}
                                                className="p-3 rounded-full hover:bg-red-500/10 transition-colors"
                                                aria-label={`Delete loan for ${loan.customers?.name}`}
                                                whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                                            >
                                                <Trash2Icon className="w-7 h-7 text-red-500" />
                                            </motion.button>
                                        </div>
                                    </div>
                                    
                                    {/* Progress Bar */}
                                    <div className="mt-4 pt-4 border-t border-gray-200">
                                        <div className="flex justify-between items-center text-lg mb-2">
                                            <span className="text-gray-600">Progress</span>
                                            <span className={`font-semibold ${isPaidOff ? 'text-green-600' : 'text-gray-800'}`}>{loanInstallments.length} of {loan.total_instalments} Paid</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-3">
                                            <motion.div 
                                                className={`h-3 rounded-full ${isPaidOff ? 'bg-green-500' : 'bg-indigo-500'}`} 
                                                initial={{width: 0}}
                                                animate={{width: `${progressPercentage}%`}}
                                                transition={{duration: 0.5}}
                                            />
                                        </div>
                                        <div className="flex justify-between items-center text-base mt-2 text-gray-500">
                                            <span>₹{amountPaid.toLocaleString()}</span>
                                            <span>₹{totalRepayable.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* Installment List */}
                                    {loanInstallments.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                                            <h4 className="text-lg font-semibold text-gray-600 mb-1">Recorded Installments:</h4>
                                            {loanInstallments.map(installment => (
                                                <div key={installment.id} className="flex justify-between items-center bg-gray-100 p-3 rounded-md">
                                                    <div>
                                                        <p className="font-medium text-base">Installment #{installment.installment_number}</p>
                                                        <p className="text-sm text-gray-500">Date: {formatDate(installment.date)} | Receipt: {installment.receipt_number}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <p className="font-semibold text-green-600 text-lg">
                                                            ₹{installment.amount.toLocaleString()}
                                                            {installment.late_fee > 0 && (
                                                                <span className="text-sm text-orange-500 ml-1">(+₹{installment.late_fee} late)</span>
                                                            )}
                                                        </p>
                                                        <motion.button
                                                            onClick={() => handleDeleteInstallment(installment.id, installment.installment_number)}
                                                            className="p-1 rounded-full hover:bg-red-500/10 transition-colors"
                                                            aria-label={`Delete installment #${installment.installment_number}`}
                                                            whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                                                        >
                                                            <Trash2Icon className="w-4 h-4 text-red-500" />
                                                        </motion.button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </GlassCard>
            )}

            {/* Modals for Deletion Confirmation */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
                        <h3 className="text-lg font-bold mb-4">Delete Loan</h3>
                        <p className="mb-6">Are you sure you want to delete this loan for <span className="font-semibold">{deleteTarget.customers?.name ?? 'Unknown Customer'}</span>? This will also delete all associated installments.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={cancelDeleteLoan} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">Cancel</button>
                            <button onClick={confirmDeleteLoan} className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}
            {deleteInstallmentTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
                        <h3 className="text-lg font-bold mb-4">Delete Installment</h3>
                        <p className="mb-6">Are you sure you want to delete installment #{deleteInstallmentTarget.number}?</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={cancelDeleteInstallment} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">Cancel</button>
                            <button onClick={confirmDeleteInstallment} className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}
            {deleteCustomerTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
                        <h3 className="text-lg font-bold mb-4">Delete Customer</h3>
                        <p className="mb-6">Are you sure you want to delete <span className="font-semibold">{deleteCustomerTarget.name}</span>? This will also delete all associated loans, subscriptions, and installments.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={cancelDeleteCustomer} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">Cancel</button>
                            <button onClick={confirmDeleteCustomer} className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </PageWrapper>
    );
};

export default LoanListPage;