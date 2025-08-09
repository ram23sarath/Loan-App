import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import SummaryChart from './SummaryChart';

const SummaryPage = () => {
  const { loans = [], installments = [], subscriptions = [], dataEntries = [], customers = [] } = useData();
  const [showDataTable, setShowDataTable] = useState(false);

  const totalInterestCollected = loans.reduce((acc, loan) => {
    const loanInstallments = installments.filter(i => i.loan_id === loan.id);
    const totalPaidForLoan = loanInstallments.reduce((sum, inst) => sum + inst.amount, 0);
    if (totalPaidForLoan > loan.original_amount) {
      const interestCollected = Math.min(totalPaidForLoan - loan.original_amount, loan.interest_amount);
      return acc + interestCollected;
    }
    return acc;
  }, 0);
  const totalLateFeeCollected = installments.reduce((acc, inst) => acc + (inst.late_fee || 0), 0);
  const totalSubscriptionCollected = subscriptions.reduce((acc, sub) => acc + (sub.amount || 0), 0);
  const totalDataCollected = dataEntries.reduce((acc, entry) => acc + (entry.amount || 0), 0);
  const totalAllCollected = totalInterestCollected + totalLateFeeCollected + totalSubscriptionCollected + totalDataCollected;
  const totalLoansGiven = loans.reduce((acc, loan) => acc + loan.original_amount + loan.interest_amount, 0);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-200 via-white to-blue-100">
      <div className="w-full max-w-5xl mx-auto p-8 rounded-3xl bg-white/90 border border-indigo-200 shadow-2xl flex flex-col gap-10 items-center justify-center min-h-[80vh]">
        <div className="flex justify-between w-full mb-4">
          <h2 className="uppercase tracking-widest text-3xl font-extrabold text-indigo-700 text-center drop-shadow-lg">Summary Dashboard</h2>
          <button
            className="ml-auto px-4 py-2 rounded-lg bg-indigo-100 text-indigo-700 font-semibold hover:bg-indigo-200 transition"
            onClick={() => setShowDataTable(v => !v)}
          >
            {showDataTable ? 'Show Summary' : 'View Data Entries'}
          </button>
        </div>
        {showDataTable ? (
          <div className="w-full overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-xl shadow">
              <thead>
                <tr className="bg-indigo-50">
                  <th className="px-4 py-2 text-left text-xs font-bold text-indigo-700">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-indigo-700">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-indigo-700">Amount</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-indigo-700">Receipt #</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-indigo-700">Notes</th>
                </tr>
              </thead>
              <tbody>
                {dataEntries.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-gray-400 py-6">No data entries found.</td></tr>
                ) : (
                  dataEntries.map(entry => {
                    const customer = customers.find(c => c.id === entry.customer_id);
                    return (
                      <tr key={entry.id} className="border-b last:border-b-0">
                        <td className="px-4 py-2">{customer ? customer.name : 'Unknown'}</td>
                        <td className="px-4 py-2">{entry.date}</td>
                        <td className="px-4 py-2">₹{entry.amount.toLocaleString()}</td>
                        <td className="px-4 py-2">{entry.receipt_number}</td>
                        <td className="px-4 py-2">{entry.notes || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row gap-10 items-center justify-between w-full">
              <div className="flex-1 grid grid-cols-1 gap-6 w-full">
                <div className="flex items-center justify-between px-6 py-4 rounded-2xl bg-green-50 border border-green-100 shadow">
                  <span className="text-base font-medium text-green-700">Interest Collected</span>
                  <span className="text-2xl font-bold text-green-700">₹{totalInterestCollected.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between px-6 py-4 rounded-2xl bg-orange-50 border border-orange-100 shadow">
                  <span className="text-base font-medium text-orange-700">Late Fee Collected</span>
                  <span className="text-2xl font-bold text-orange-700">₹{totalLateFeeCollected.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between px-6 py-4 rounded-2xl bg-cyan-50 border border-cyan-100 shadow">
                  <span className="text-base font-medium text-cyan-700">Subscription Collected</span>
                  <span className="text-2xl font-bold text-cyan-700">₹{totalSubscriptionCollected.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between px-6 py-4 rounded-2xl bg-pink-50 border border-pink-100 shadow">
                  <span className="text-base font-medium text-pink-700">Data Collected</span>
                  <span className="text-2xl font-bold text-pink-700">₹{totalDataCollected.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between px-6 py-4 rounded-2xl bg-indigo-50 border border-indigo-100 shadow mt-2">
                  <span className="text-base font-medium text-indigo-700">Total Collected</span>
                  <span className="text-2xl font-bold text-indigo-700">₹{totalAllCollected.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between px-6 py-4 rounded-2xl bg-blue-50 border border-blue-100 shadow mt-2">
                  <span className="text-base font-medium text-blue-700">Total Loans Given</span>
                  <span className="text-2xl font-bold text-blue-700">₹{totalLoansGiven.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex-1 w-full max-w-lg">
                <SummaryChart
                  interest={totalInterestCollected}
                  lateFee={totalLateFeeCollected}
                  subscription={totalSubscriptionCollected}
                  total={totalAllCollected}
                  loansGiven={totalLoansGiven}
                />
              </div>
            </div>
            <div className="text-center text-xs text-gray-400 mt-4">Updated as of {new Date().toLocaleDateString()}</div>
          </>
        )}
      </div>
    </div>
  );
};

export default SummaryPage;
