import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import FYBreakdownModal from '../modals/FYBreakdownModal';
import { useData } from '../../context/DataContext';

const SummaryPage = () => {
  const { loans = [], installments = [], subscriptions = [], dataEntries = [] } = useData();

  // --- Financial Year Selector Setup ---
  const today = new Date();
  // fiscal year starts in April: for a given year N, FY N means Apr 1 N -> Mar 31 N+1
  const getFYStartYearForDate = (d: Date) => {
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12
    return month >= 4 ? year : year - 1;
  };

  const defaultFYStart = getFYStartYearForDate(today);
  const [selectedFYStart, setSelectedFYStart] = useState<number>(defaultFYStart);

  // Build FY options from earliest date in data to latest
  const fyOptions = useMemo(() => {
    const allDates: Date[] = [];
    const pushDate = (s?: string | null) => {
      if (!s) return;
      const d = new Date(s);
      if (!isNaN(d.getTime())) allDates.push(d);
    };
    subscriptions.forEach(s => pushDate(s.date));
    installments.forEach(i => pushDate(i.date));
    dataEntries.forEach(e => pushDate(e.date));

    if (allDates.length === 0) {
      // fallback: provide a small range around current FY, but don't go earlier than 2013
      const fallback = [defaultFYStart + 1, defaultFYStart, defaultFYStart - 1].map(y => Math.max(y, 2013));
      return Array.from(new Set(fallback)).sort((a,b) => b-a);
    }
    const rawMinYear = Math.min(...allDates.map(d => getFYStartYearForDate(d)));
    const minYear = Math.max(2013, rawMinYear);
    const maxYear = Math.max(...allDates.map(d => getFYStartYearForDate(d)));
    const opts: number[] = [];
    for (let y = maxYear; y >= minYear; y--) opts.push(y);
    return opts;
  }, [subscriptions, installments, dataEntries, defaultFYStart]);

  const fyLabel = (startYear: number) => `${startYear}-${String(startYear + 1).slice(-2)}`;

  const fyRange = useMemo(() => {
    const start = new Date(`${selectedFYStart}-04-01T00:00:00`);
    const end = new Date(`${selectedFYStart + 1}-03-31T23:59:59.999`);
    return { start, end };
  }, [selectedFYStart]);

  // --- Data Calculation (overall totals) ---
  const totalInterestCollected = loans.reduce((acc, loan) => {
    const loanInstallments = installments.filter(i => i.loan_id === loan.id);
    const totalPaidForLoan = loanInstallments.reduce((sum, inst) => sum + inst.amount, 0);
    if (totalPaidForLoan > loan.original_amount) {
      const interestCollected = Math.min(totalPaidForLoan - loan.original_amount, loan.interest_amount);
      return acc + interestCollected;
    }
    return acc;
  }, 0);
  const totalLateFeeCollected = installments.reduce((acc, inst) => acc + (inst.late_fee || 0), 0)
    + subscriptions.reduce((acc, sub) => acc + (sub.late_fee || 0), 0);
  const totalSubscriptionCollected = subscriptions.reduce((acc, sub) => acc + (sub.amount || 0), 0);
  // Calculate Subscription Return from dataEntries (expenditure entries with subtype 'Subscription Return')
  const subscriptionReturnTotal = dataEntries.reduce((acc, entry) => {
    if ((entry as any).type === 'expenditure' && entry.subtype === 'Subscription Return') {
      return acc + (entry.amount || 0);
    }
    return acc;
  }, 0);
  // Balance = Subscriptions - Subscription Return
  const subscriptionBalance = totalSubscriptionCollected - subscriptionReturnTotal;
  const totalDataCollected = dataEntries.reduce((acc, entry) => {
    if (entry.type === 'expenditure') {
      return acc - (entry.amount || 0);
    }
    return acc + (entry.amount || 0);
  }, 0);
  // New: calculate Expenses from specific subtypes recorded in New Data Entry
  const expenseSubtypes = ['Subscription Return', 'Retirement Gift', 'Death Fund', 'Misc Expense'];
  const totalExpenses = dataEntries.reduce((acc, entry) => {
    // Consider only entries that are expenditures and match the requested subtypes
    if (entry.type === 'expenditure' && entry.subtype && expenseSubtypes.includes(entry.subtype)) {
      return acc + (entry.amount || 0);
    }
    return acc;
  }, 0);
  // Calculate per-subtype totals so we can show breakdown under Expenses
  const expenseTotalsBySubtype: Record<string, number> = expenseSubtypes.reduce((acc, subtype) => {
    acc[subtype] = 0;
    return acc;
  }, {} as Record<string, number>);
  dataEntries.forEach(entry => {
    if (entry.type === 'expenditure' && entry.subtype && expenseSubtypes.includes(entry.subtype)) {
      expenseTotalsBySubtype[entry.subtype!] = (expenseTotalsBySubtype[entry.subtype!] || 0) + (entry.amount || 0);
    }
  });
  const totalAllCollected = totalInterestCollected + totalLateFeeCollected + totalSubscriptionCollected + totalDataCollected;
  // Show only principal amount disbursed (original_amount) — do not include interest here
  const totalLoansGiven = loans.reduce((acc, loan) => acc + (loan.original_amount || 0), 0);

  // New: calculate total principal recovered (payments applied to principal, excluding interest)
  const totalPrincipalRecovered = loans.reduce((acc, loan) => {
    const loanInstallments = installments.filter(i => i.loan_id === loan.id);
    const totalPaidForLoan = loanInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
    // Payments are applied to principal first; principal recovered is min(totalPaid, original_amount)
    const principalRecovered = Math.min(totalPaidForLoan, loan.original_amount || 0);
    return acc + principalRecovered;
  }, 0);

  // --- Data Calculation (financial year filtered totals) ---
  const { start: fyStart, end: fyEnd } = fyRange;

  const within = (dateStr?: string | null, start = fyStart, end = fyEnd) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    return d >= start && d <= end;
  };

  // Subscriptions in FY
  const fySubscriptions = subscriptions.filter(s => within(s.date));
  const fySubscriptionCollected = fySubscriptions.reduce((acc, s) => acc + (s.amount || 0), 0);

  // Subscription Return in FY from dataEntries
  const fySubscriptionReturn = dataEntries.filter(e => (e.subtype === 'Subscription Return') && within(e.date)).reduce((acc, e) => acc + (e.amount || 0), 0);

  // Late fees in FY (installments + subscriptions)
  const fyLateFees = installments.filter(i => within(i.date)).reduce((acc, i) => acc + (i.late_fee || 0), 0)
    + subscriptions.filter(s => within(s.date)).reduce((acc, s) => acc + (s.late_fee || 0), 0);

  // Loan principal recovered during FY: for each loan, compute principal recovered up to end and before start, difference is in-FY principal
  const fyPrincipalRecovered = loans.reduce((acc, loan) => {
    const instsForLoan = installments.filter(i => i.loan_id === loan.id);
    const paidUntilEnd = instsForLoan.filter(i => new Date(i.date) <= fyEnd).reduce((sum, i) => sum + (i.amount || 0), 0);
    const paidBeforeStart = instsForLoan.filter(i => new Date(i.date) < fyStart).reduce((sum, i) => sum + (i.amount || 0), 0);
    const principalUntilEnd = Math.min(paidUntilEnd, loan.original_amount || 0);
    const principalBeforeStart = Math.min(paidBeforeStart, loan.original_amount || 0);
    return acc + Math.max(0, principalUntilEnd - principalBeforeStart);
  }, 0);

  // Interest collected during FY: for each loan, compute interest collected up to end and before start, take difference
  const fyInterestCollected = loans.reduce((acc, loan) => {
    const instsForLoan = installments.filter(i => i.loan_id === loan.id);
    const paidUntilEnd = instsForLoan.filter(i => new Date(i.date) <= fyEnd).reduce((sum, i) => sum + (i.amount || 0), 0);
    const paidBeforeStart = instsForLoan.filter(i => new Date(i.date) < fyStart).reduce((sum, i) => sum + (i.amount || 0), 0);
    const interestUntilEnd = Math.max(0, Math.min(paidUntilEnd - (loan.original_amount || 0), loan.interest_amount || 0));
    const interestBeforeStart = Math.max(0, Math.min(paidBeforeStart - (loan.original_amount || 0), loan.interest_amount || 0));
    return acc + Math.max(0, interestUntilEnd - interestBeforeStart);
  }, 0);

  // Modal state for breakdown details
  const [breakdownOpen, setBreakdownOpen] = React.useState(false);
  const [breakdownTitle, setBreakdownTitle] = React.useState('');
  const [breakdownItems, setBreakdownItems] = React.useState<any[]>([]);

  const openBreakdown = (type: 'subscriptions' | 'interest' | 'latefees' | 'principal' | 'total') => {
    setBreakdownTitle(() => {
      switch (type) {
        case 'subscriptions': return `Subscriptions — FY ${fyLabel(selectedFYStart)}`;
        case 'interest': return `Interest — FY ${fyLabel(selectedFYStart)}`;
        case 'latefees': return `Late Fees — FY ${fyLabel(selectedFYStart)}`;
        case 'principal': return `Loan Recovery (Principal) — FY ${fyLabel(selectedFYStart)}`;
        case 'total': return `Total (FY ${fyLabel(selectedFYStart)})`;
      }
    });

    // Build items depending on type
    if (type === 'subscriptions') {
      const items = fySubscriptions.map(s => ({ id: s.id, date: s.date, amount: s.amount, receipt: s.receipt, source: 'Subscription', customer: (s as any).customers?.name || '' }));
      setBreakdownItems(items);
    } else if (type === 'latefees') {
      const instLate = installments.filter(i => within(i.date) && (i.late_fee || 0) > 0).map(i => {
        const loan = loans.find(l => l.id === i.loan_id);
        return { id: i.id, date: i.date, amount: i.late_fee || 0, receipt: i.receipt_number, source: 'Installment Late Fee', customer: loan?.customers?.name || '' };
      });
      const subLate = subscriptions.filter(s => within(s.date) && (s.late_fee || 0) > 0).map(s => ({ id: s.id, date: s.date, amount: s.late_fee || 0, receipt: s.receipt, source: 'Subscription Late Fee', customer: (s as any).customers?.name || '' }));
      setBreakdownItems([...instLate, ...subLate]);
    } else if (type === 'interest') {
      // For interest, find installments that include interest portion for the FY
      const items: any[] = [];
      loans.forEach(loan => {
        const insts = installments.filter(i => i.loan_id === loan.id && within(i.date));
        insts.forEach(inst => {
          // approximate: interest portion is amount beyond remaining principal, but we don't have amortization schedule;
          items.push({ id: inst.id, date: inst.date, amount: 0, receipt: inst.receipt_number, source: 'Installment (interest portion)', customer: loan.customers?.name || '' });
        });
      });
      // We'll include a note that amounts are aggregated above; actual per-installment interest split is not exactly stored
      setBreakdownItems(items);
    } else if (type === 'principal') {
      // Principal recovered in FY: list installments with their amounts and attribute to principal up to loan.original_amount
      const items: any[] = [];
      loans.forEach(loan => {
        const insts = installments.filter(i => i.loan_id === loan.id && within(i.date));
        insts.forEach(inst => {
          items.push({ id: inst.id, date: inst.date, amount: inst.amount, receipt: inst.receipt_number, source: `Installment for Loan ${loan.id}`, customer: loan.customers?.name || '' });
        });
      });
      setBreakdownItems(items);
    } else if (type === 'total') {
      // combine all contributions
      const subItems = fySubscriptions.map(s => ({ id: s.id, date: s.date, amount: s.amount, receipt: s.receipt, source: 'Subscription', customer: (s as any).customers?.name || '' }));
      const instItems = installments.filter(i => within(i.date)).map(i => ({ id: i.id, date: i.date, amount: i.amount, receipt: i.receipt_number, source: 'Installment', customer: (loans.find(l => l.id === i.loan_id)?.customers?.name) || '' }));
      const dataItems = dataEntries.filter(e => within(e.date)).map(e => ({ id: e.id, date: e.date, amount: e.amount, receipt: e.receipt_number, notes: e.notes, source: e.subtype || 'Data Entry', customer: '' }));
      setBreakdownItems([...subItems, ...instItems, ...dataItems]);
    }

    setBreakdownOpen(true);
  };

  // Loan Balance = Total Loans Given - Loan Recovery (Principal)
  const loanBalance = totalLoansGiven - totalPrincipalRecovered;

  // No tab state — Loan Recovery will be displayed as its own heading below Total Collected

  const collectedBreakdownCards = [
    { label: 'Interest', value: totalInterestCollected, color: 'green' },
    { label: 'Late Fees', value: totalLateFeeCollected, color: 'orange' },
    { label: 'Subscriptions', value: totalSubscriptionCollected, color: 'cyan' },
  ];

  // Keep all collected breakdown cards in leftCards (no Misc Expenses redundant card)
  const leftCards = collectedBreakdownCards;

  // --- Animation Variants (No changes here) ---
  const mainContainerVariants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 },
    },
  };
  const mainCardVariants = {
    hidden: { y: -30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 100, damping: 12 },
    },
  };
  const breakdownContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.07,
        delayChildren: 0.3,
      },
    },
  };
  const breakdownCardVariants = {
    hidden: { scale: 0.5, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: { type: 'spring', stiffness: 200, damping: 15 },
    },
  };

  return (
    <div className="w-full max-w-7xl mx-auto my-8 printable-summary">
      <div className="bg-white rounded-xl shadow-md flex flex-col gap-8 p-6 border border-gray-200/80">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl font-bold text-indigo-700 uppercase tracking-widest">Summary Dashboard</h2>
            <span className="text-xs text-gray-500">(FY {fyLabel(selectedFYStart)})</span>
            {/* Print-focused label to ensure visibility in printed reports */}
            <span className="text-xs text-gray-700 ml-2 print-only">FY {fyLabel(selectedFYStart)}</span>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button
              onClick={() => window.print()}
              title="Print / Export to PDF"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
            >
              Print
            </button>
          </div>
        </div>

        <motion.div
          className="w-full grid grid-cols-1 lg:grid-cols-5 gap-6"
          variants={mainContainerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Section 1: Income */}
          <motion.div
            className="lg:col-span-3 bg-white/60 border border-indigo-100 rounded-2xl p-5 flex flex-col gap-4 shadow-sm"
            variants={mainCardVariants}
          >
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold">₹</div>
                <div>
                  <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Income</div>
                  <div className="text-xs text-gray-400">Collections & recoveries</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-base font-medium text-indigo-800 uppercase tracking-wider">Total Collected</span>
              <span className="text-4xl font-bold text-indigo-700 mt-1">₹{totalAllCollected.toLocaleString()}</span>
            </div>

            <div className="flex flex-col items-center mt-4">
              <span className="text-sm font-medium text-indigo-800 uppercase tracking-wider">Loan Recovery (Principal)</span>
              <span className="text-lg font-bold text-indigo-700 mt-1">₹{totalPrincipalRecovered.toLocaleString()}</span>
            </div>

            <motion.div
              className="w-full grid grid-cols-2 gap-4"
              variants={breakdownContainerVariants}
            >
              {leftCards.map((card) => (
                <motion.div
                  key={card.label}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl bg-${card.color}-50 border border-${card.color}-200`}
                  variants={breakdownCardVariants}
                >
                  <span className={`text-sm font-medium text-${card.color}-700`}>{card.label}</span>
                  <span className={`text-xl font-bold text-${card.color}-800 mt-1`}>
                    ₹{card.value.toLocaleString()}
                  </span>
                </motion.div>
              ))}
            </motion.div>
            {/* Subscriptions Balance box: shows Subscriptions, Subscription Return and Balance */}
            <div className="w-full mt-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-cyan-50 border border-cyan-200">
                <div>
                  <div className="text-sm font-medium text-cyan-700">Subscriptions Balance</div>
                  <div className="text-xs text-gray-500">Subscriptions - Subscription Return = Balance</div>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between px-3 py-1 rounded-md bg-cyan-25/30">
                  <div className="text-sm text-gray-700">Subscriptions</div>
                  <div className="text-sm font-medium text-cyan-700">₹{totalSubscriptionCollected.toLocaleString()}</div>
                </div>
                <div className="flex items-center justify-between px-3 py-1 rounded-md bg-cyan-25/30">
                  <div className="text-sm text-gray-700">Subscription Return</div>
                  <div className="text-sm font-medium text-cyan-700">₹{subscriptionReturnTotal.toLocaleString()}</div>
                </div>
                <div className="flex items-center justify-between px-3 py-1 rounded-md bg-cyan-25/30">
                  <div className="text-sm font-medium text-cyan-700">Balance</div>
                  <div className={`text-sm font-bold ${subscriptionBalance < 0 ? 'text-red-600' : 'text-cyan-800'}`}>₹{subscriptionBalance.toLocaleString()}</div>
                </div>
              </div>
            </div>
            {/* Loan Balance box: Total Loans Given - Loan Recovery (Principal) = Loan Balance */}
            <div className="w-full mt-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div>
                  <div className="text-sm font-medium text-blue-700">Loan Balance</div>
                  <div className="text-xs text-gray-500">Total Loans Given - Loan Recovery (Principal) = Balance</div>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between px-3 py-1 rounded-md bg-blue-25/30">
                  <div className="text-sm text-gray-700">Total Loans Given</div>
                  <div className="text-sm font-medium text-blue-700">₹{totalLoansGiven.toLocaleString()}</div>
                </div>
                <div className="flex items-center justify-between px-3 py-1 rounded-md bg-blue-25/30">
                  <div className="text-sm text-gray-700">Loan Recovery (Principal)</div>
                  <div className="text-sm font-medium text-blue-700">₹{totalPrincipalRecovered.toLocaleString()}</div>
                </div>
                <div className="flex items-center justify-between px-3 py-1 rounded-md bg-blue-25/30">
                  <div className="text-sm font-medium text-blue-700">Balance</div>
                  <div className={`text-sm font-bold ${loanBalance < 0 ? 'text-red-600' : 'text-blue-800'}`}>₹{loanBalance.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Section 2: Expenses */}
          <motion.div
            className="lg:col-span-2 bg-white/60 border border-red-100 rounded-2xl p-5 flex flex-col items-center justify-center shadow-sm"
            variants={mainCardVariants}
          >
            <div className="w-full flex items-center gap-3 mb-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-700 font-bold">-</div>
              <div className="text-sm">
                <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Expenses</div>
                <div className="text-xs text-gray-400">Outgoing & disbursed principal</div>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-base font-medium text-blue-800 uppercase tracking-wider">Total Loans Given</span>
              <span className="text-4xl font-bold text-blue-700 mt-1">₹{totalLoansGiven.toLocaleString()}</span>
            </div>
            {/* Previously showed a separate 'Misc Expenses' card here; removed because subtype breakdown already covers expenses. */}
            {/* Expenses box (calculated from selected misc entry subtypes) */}
            <div className="w-full mt-4">
              <div className={`flex items-center justify-between p-4 rounded-lg bg-red-50 border border-red-200`}>
                <div>
                  <div className={`text-sm font-medium text-red-700`}>Expenses</div>
                  <div className={`text-lg font-bold text-red-800 mt-1`}>₹{totalExpenses.toLocaleString()}</div>
                </div>
              </div>
              {/* Per-subtype breakdown */}
              <div className="mt-3 space-y-2">
                {Object.entries(expenseTotalsBySubtype).map(([subtype, amt]) => (
                  <div key={subtype} className="flex items-center justify-between px-3 py-1 rounded-md bg-red-25/30">
                    <div className="text-sm text-gray-700">{subtype}</div>
                    <div className="text-sm font-medium text-red-700">₹{(amt || 0).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Financial Year Section - separate visualization for selected FY */}
        <div className="w-full mt-6 bg-gray-50 rounded-lg p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-gray-700 uppercase">Financial Year</div>
              <div className="text-xs text-gray-400">Select a fiscal year (Apr - Mar) to visualize collections</div>
            </div>
            <div className="flex items-center gap-3">
              <select value={selectedFYStart} onChange={(e) => setSelectedFYStart(Number(e.target.value))} className="px-3 py-2 rounded border bg-white">
                {fyOptions.map(y => (
                  <option key={y} value={y}>{fyLabel(y)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 rounded-xl bg-cyan-50 border border-cyan-200 flex flex-col items-start">
              <div className="flex items-center justify-between w-full">
                <div className="text-xs text-gray-600">Subscriptions (FY)</div>
                <button onClick={() => openBreakdown('subscriptions')} className="text-xs text-indigo-600 underline">Details</button>
              </div>
              <div className="text-xl font-bold text-cyan-800 mt-2">₹{fySubscriptionCollected.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-xl bg-green-50 border border-green-200 flex flex-col items-start">
              <div className="flex items-center justify-between w-full">
                <div className="text-xs text-gray-600">Interest (FY)</div>
                <button onClick={() => openBreakdown('interest')} className="text-xs text-indigo-600 underline">Details</button>
              </div>
              <div className="text-xl font-bold text-green-800 mt-2">₹{fyInterestCollected.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 flex flex-col items-start">
              <div className="flex items-center justify-between w-full">
                <div className="text-xs text-gray-600">Late Fees (FY)</div>
                <button onClick={() => openBreakdown('latefees')} className="text-xs text-indigo-600 underline">Details</button>
              </div>
              <div className="text-xl font-bold text-orange-800 mt-2">₹{fyLateFees.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex flex-col items-start">
              <div className="flex items-center justify-between w-full">
                <div className="text-xs text-gray-600">Loan Recovery (Principal) (FY)</div>
                <button onClick={() => openBreakdown('principal')} className="text-xs text-indigo-600 underline">Details</button>
              </div>
              <div className="text-xl font-bold text-blue-800 mt-2">₹{fyPrincipalRecovered.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-col items-start">
              <div className="flex items-center justify-between w-full">
                <div className="text-xs text-gray-600">Total (FY)</div>
                <button onClick={() => openBreakdown('total')} className="text-xs text-indigo-600 underline">Details</button>
              </div>
              <div className="text-xl font-bold text-indigo-800 mt-2">₹{(fySubscriptionCollected + fyInterestCollected + fyLateFees + fyPrincipalRecovered).toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-gray-400 mt-2">
          Updated as of {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>

        <FYBreakdownModal open={breakdownOpen} title={breakdownTitle} items={breakdownItems} onClose={() => setBreakdownOpen(false)} />
      </div>
    </div>
  );
};

export default SummaryPage;