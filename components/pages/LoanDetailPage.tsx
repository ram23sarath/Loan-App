import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import GlassCard from '../ui/GlassCard';
import { formatDate } from '../../utils/dateFormatter';
import { motion } from 'framer-motion';


const LoanDetailPage: React.FC = () => {
  const { id } = useParams();
  const { loans, installments, loading } = useData();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  if (loading) {
    return <GlassCard><p>Loading...</p></GlassCard>;
  }

  const loan = loans.find(l => l.id === id);
  const loanInstallments = installments.filter(inst => inst.loan_id === id);

  if (!loan) {
    return <GlassCard><p>Loan not found.</p></GlassCard>;
  }

  return (
    <GlassCard className="max-w-2xl mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-4">Loan Details</h2>
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-lg p-3">
          <div className="text-sm text-gray-500">Customer</div>
          <div className="font-semibold text-indigo-700">{loan.customers?.name ?? 'Unknown'}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-3">
          <div className="text-sm text-gray-500">Payment Date</div>
          <div className="font-semibold">{loan.payment_date ? formatDate(loan.payment_date) : '-'}</div>
        </div>

        <div className="bg-white border border-gray-100 rounded-lg p-3">
          <div className="text-sm text-gray-500">Original Amount</div>
          <div className="font-semibold text-green-700">₹{loan.original_amount.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-3">
          <div className="text-sm text-gray-500">Interest Amount</div>
          <div className="font-semibold text-green-700">₹{loan.interest_amount.toLocaleString()}</div>
        </div>

        <div className="bg-white border border-gray-100 rounded-lg p-3">
          <div className="text-sm text-gray-500">Total Repayable</div>
          <div className="font-semibold text-indigo-800">₹{(loan.original_amount + loan.interest_amount).toLocaleString()}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-3">
          <div className="text-sm text-gray-500">Check Number</div>
          <div className="font-semibold">{loan.check_number || '-'}</div>
        </div>
      </div>
      <h3 className="text-lg font-semibold mb-3">Installments Paid</h3>
      {loanInstallments.length > 0 ? (
        <>
          {(() => {
            const totalPages = Math.ceil(loanInstallments.length / itemsPerPage);
            const start = (currentPage - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            const paginatedInstallments = loanInstallments.slice(start, end);
            return (
              <>
                <div className="overflow-x-auto border border-gray-100 rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-4 bg-indigo-50 text-xs font-semibold text-indigo-700 p-3">
                    <div>#</div>
                    <div className="hidden md:block">Date</div>
                    <div className="text-right md:text-right">Amount</div>
                    <div className="hidden md:block md:text-right">Late Fee</div>
                    <div className="hidden md:block">Receipt</div>
                    <div className="hidden md:block md:text-right">Notes</div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {paginatedInstallments.map(inst => (
                      <div key={inst.id} className="grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-4 items-center p-3 bg-white">
                        <div className="text-sm text-gray-700">#{inst.installment_number}</div>
                        <div className="hidden md:block text-sm text-gray-600">{formatDate(inst.date)}</div>
                        <div className="text-sm font-semibold text-green-700 text-right">₹{inst.amount.toLocaleString()}</div>
                        <div className="hidden md:block text-sm text-gray-700 md:text-right">{inst.late_fee ? `₹${inst.late_fee}` : '-'}</div>
                        <div className="hidden md:block text-sm text-gray-600">{inst.receipt_number || '-'}</div>
                        <div className="hidden md:block text-sm text-gray-500 md:text-right">{inst.notes || '-'}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <motion.div
                    className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-200"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="text-sm text-gray-600">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(currentPage * itemsPerPage, loanInstallments.length)} of{" "}
                      {loanInstallments.length} installments
                    </div>
                    <div className="flex gap-2 flex-wrap justify-center">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        First
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      
                      {/* Page numbers */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        if (
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1
                        ) {
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-1 rounded border ${
                                currentPage === page
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              {page}
                            </button>
                          );
                        }
                        if (page === 2 && currentPage > 3) {
                          return <span key="dots-start" className="px-2">...</span>;
                        }
                        if (page === totalPages - 1 && currentPage < totalPages - 2) {
                          return <span key="dots-end" className="px-2">...</span>;
                        }
                        return null;
                      })}
                      
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Last
                      </button>
                    </div>
                  </motion.div>
                )}
              </>
            );
          })()}
        </>
      ) : (
        <p className="text-gray-500">No installments have been paid for this loan yet.</p>
      )}
    </GlassCard>
  );
};

export default LoanDetailPage;