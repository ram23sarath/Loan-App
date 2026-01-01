import React, { useMemo, useState, useEffect } from "react";

import { motion, useSpring, useTransform, AnimatePresence } from "framer-motion";

import * as XLSX from "xlsx";

import FYBreakdownModal from "../modals/FYBreakdownModal";
import PageWrapper from "../ui/PageWrapper";
import { useTheme } from "../../context/ThemeContext";
import { MoonIcon, SunIcon } from "../../constants";

import { useData } from "../../context/DataContext";

import { formatCurrencyIN } from "../../utils/numberFormatter";

import { formatDate } from "../../utils/dateFormatter";

import { calculateSummaryData, expenseSubtypes } from "../../utils/summaryCalculations";

import { supabase } from "../../src/lib/supabase";

import { FileDownIcon } from "../../constants";

import type { LoanWithCustomer, SubscriptionWithCustomer, Installment, DataEntry, Customer } from "../../types";



const getButtonCenter = (button: HTMLElement) => {
  const rect = button.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
};

const AnimatedNumber = ({ value }: { value: number }) => {
  const spring = useSpring(0, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) => formatCurrencyIN(Math.round(current)));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
};

const SummaryPage = () => {
  const { theme, toggleTheme } = useTheme();

  const {

    loans: contextLoans = [],

    installments: contextInstallments = [],

    subscriptions: contextSubscriptions = [],

    dataEntries: contextDataEntries = [],

    customers: contextCustomers = [],

    seniorityList = [],

    isScopedCustomer = false,

    installmentsByLoanId: contextInstallmentsByLoanId,

  } = useData();



  // Export menu state

  const [exportMenuOpen, setExportMenuOpen] = useState(false);



  // For scoped customers, fetch unfiltered data for summary calculations

  const [loansForSummary, setLoansForSummary] = useState<LoanWithCustomer[]>([]);

  const [installmentsForSummary, setInstallmentsForSummary] = useState<Installment[]>([]);

  const [subscriptionsForSummary, setSubscriptionsForSummary] = useState<SubscriptionWithCustomer[]>([]);

  const [dataEntriesForSummary, setDataEntriesForSummary] = useState<DataEntry[]>([]);



  useEffect(() => {

    const fetchUnfilteredData = async () => {
      if (isScopedCustomer) {
        try {
          const fetchAll = async (table: string, queryModifier?: (q: any) => any) => {
            let allData: any[] = [];
            let from = 0;
            const batchSize = 1000;
            let hasMore = true;
            while (hasMore) {
              let query = supabase.from(table as any).select(table === 'loans' || table === 'subscriptions' ? '*, customers(name, phone)' : '*');
              if (queryModifier) query = queryModifier(query);

              const { data, error } = await query.range(from, from + batchSize - 1);
              if (error) throw error;

              if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += batchSize;
                hasMore = data.length === batchSize;
              } else {
                hasMore = false;
              }
            }
            return allData;
          };

          const [loansData, subsData, entriesData, installmentsData] = await Promise.all([
            fetchAll('loans'),
            fetchAll('subscriptions'),
            fetchAll('data_entries'),
            fetchAll('installments')
          ]);

          setLoansForSummary(loansData as LoanWithCustomer[]);
          setSubscriptionsForSummary(subsData as SubscriptionWithCustomer[]);
          setDataEntriesForSummary(entriesData as DataEntry[]);
          setInstallmentsForSummary(installmentsData as Installment[]);

        } catch (error) {
          console.error('Error fetching unfiltered data for summary:', error);
        }
      }
    };



    fetchUnfilteredData();

  }, [isScopedCustomer]);



  // Use unfiltered data for scoped customers, context data for admins

  const loans = isScopedCustomer ? loansForSummary : contextLoans;

  const installments = isScopedCustomer ? installmentsForSummary : contextInstallments;

  const subscriptions = isScopedCustomer ? subscriptionsForSummary : contextSubscriptions;

  const dataEntries = isScopedCustomer ? dataEntriesForSummary : contextDataEntries;


  // Lookup map for O(1) installment access by loan_id
  const localInstallmentsByLoanId = useMemo(() => {
    const map = new Map<string, Installment[]>();
    installments.forEach(inst => {
      const existing = map.get(inst.loan_id) || [];
      existing.push(inst);
      map.set(inst.loan_id, existing);
    });
    return map;
  }, [installments]);



  // --- Financial Year Selector Setup ---

  const today = new Date();

  // fiscal year starts in April: for a given year N, FY N means Apr 1 N -> Mar 31 N+1

  const getFYStartYearForDate = (d: Date) => {

    const year = d.getFullYear();

    const month = d.getMonth() + 1; // 1-12

    return month >= 4 ? year : year - 1;

  };



  const defaultFYStart = getFYStartYearForDate(today);

  const [selectedFYStart, setSelectedFYStart] =

    useState<number>(defaultFYStart);

  const [showAllFYOptions, setShowAllFYOptions] = useState(false);
  const [fyDropdownOpen, setFyDropdownOpen] = useState(false);
  const fyDropdownRef = React.useRef<HTMLDivElement>(null);



  // Build FY options from earliest date in data to latest

  const fyOptions = useMemo(() => {

    const allDates: Date[] = [];

    const pushDate = (s?: string | null) => {

      if (!s) return;

      const d = new Date(s);

      if (!isNaN(d.getTime())) allDates.push(d);

    };

    subscriptions.forEach((s) => pushDate(s.date));

    installments.forEach((i) => pushDate(i.date));

    dataEntries.forEach((e) => pushDate(e.date));



    if (allDates.length === 0) {

      // fallback: provide a small range around current FY, but don't go earlier than 2013

      const fallback = [

        defaultFYStart + 1,

        defaultFYStart,

        defaultFYStart - 1,

      ].map((y) => Math.max(y, 2013));

      return Array.from(new Set(fallback)).sort((a, b) => b - a);

    }

    const rawMinYear = Math.min(

      ...allDates.map((d) => getFYStartYearForDate(d))

    );

    const minYear = Math.max(2013, rawMinYear);

    // Ensure the current FY (based on today's date) is always available even if no data exists yet

    const maxYear = Math.max(

      ...allDates.map((d) => getFYStartYearForDate(d)),

      defaultFYStart

    );

    const opts: number[] = [];

    for (let y = maxYear; y >= minYear; y--) opts.push(y);

    return opts;

  }, [subscriptions, installments, dataEntries, defaultFYStart]);

  // Handle FY dropdown click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fyDropdownRef.current && !fyDropdownRef.current.contains(event.target as Node)) {
        setFyDropdownOpen(false);
        setShowAllFYOptions(false);
      }
    };
    if (fyDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [fyDropdownOpen]);

  const fyLabel = (startYear: number) =>

    `${startYear}-${String(startYear + 1).slice(-2)}`;



  const fyRange = useMemo(() => {

    const start = new Date(`${selectedFYStart}-04-01T00:00:00`);

    const end = new Date(`${selectedFYStart + 1}-03-31T23:59:59.999`);

    return { start, end };

  }, [selectedFYStart]);



  // --- Data Calculation (overall totals) using shared utility ---

  const summaryData = useMemo(

    () => calculateSummaryData(loans, installments, subscriptions, dataEntries),

    [loans, installments, subscriptions, dataEntries]

  );



  const {

    totalInterestCollected,

    totalLateFeeCollected,

    totalSubscriptionCollected,

    subscriptionReturnTotal,

    subscriptionBalance,

    totalDataCollected,

    totalExpenses,

    expenseTotalsBySubtype,

    totalAllCollected,

    totalLoansGiven,

    totalPrincipalRecovered,

    loanBalance,

  } = summaryData;



  // --- Data Calculation (financial year filtered totals) ---

  const { start: fyStart, end: fyEnd } = fyRange;



  const within = (dateStr?: string | null, start = fyStart, end = fyEnd) => {

    if (!dateStr) return false;

    const d = new Date(dateStr);

    if (isNaN(d.getTime())) return false;

    return d >= start && d <= end;

  };



  // Subscriptions in FY

  const fySubscriptions = subscriptions.filter((s) => within(s.date));

  const fySubscriptionCollected = fySubscriptions.reduce(

    (acc, s) => acc + (s.amount || 0),

    0

  );



  // Subscription Return in FY from dataEntries

  const fySubscriptionReturn = dataEntries

    .filter((e) => e.subtype === "Subscription Return" && within(e.date))

    .reduce((acc, e) => acc + (e.amount || 0), 0);



  // FY expense subtotals by subtype

  const fyExpenseSubtypes = [

    "Subscription Return",

    "Retirement Gift",

    "Death Fund",

    "Misc Expense",

  ];

  const fyExpensesBySubtype: Record<string, number> = fyExpenseSubtypes.reduce(

    (acc, s) => ({ ...acc, [s]: 0 }),

    {} as Record<string, number>

  );

  dataEntries.forEach((e) => {

    if (

      e.type === "expenditure" &&

      e.subtype &&

      within(e.date) &&

      fyExpenseSubtypes.includes(e.subtype)

    ) {

      fyExpensesBySubtype[e.subtype!] =

        (fyExpensesBySubtype[e.subtype!] || 0) + (e.amount || 0);

    }

  });

  const fyExpensesTotal = Object.values(fyExpensesBySubtype).reduce(

    (a, b) => a + b,

    0

  );



  // Late fees in FY (installments + subscriptions)

  const fyLateFees =

    installments

      .filter((i) => within(i.date))

      .reduce((acc, i) => acc + (i.late_fee || 0), 0) +

    subscriptions

      .filter((s) => within(s.date))

      .reduce((acc, s) => acc + (s.late_fee || 0), 0);



  // Loan principal recovered during FY: for each loan, compute principal recovered up to end and before start, difference is in-FY principal

  const fyPrincipalRecovered = loans.reduce((acc, loan) => {

    const instsForLoan = localInstallmentsByLoanId.get(loan.id) || [];

    const paidUntilEnd = instsForLoan

      .filter((i) => new Date(i.date) <= fyEnd)

      .reduce((sum, i) => sum + (i.amount || 0), 0);

    const paidBeforeStart = instsForLoan

      .filter((i) => new Date(i.date) < fyStart)

      .reduce((sum, i) => sum + (i.amount || 0), 0);

    const principalUntilEnd = Math.min(paidUntilEnd, loan.original_amount || 0);

    const principalBeforeStart = Math.min(

      paidBeforeStart,

      loan.original_amount || 0

    );

    return acc + Math.max(0, principalUntilEnd - principalBeforeStart);

  }, 0);



  // FY Loans Given: sum of original_amount for loans disbursed (payment_date) within the selected FY

  const fyLoansGiven = loans

    .filter((l) => within(l.payment_date))

    .reduce((acc, l) => acc + (l.original_amount || 0), 0);



  const fyLoanBalance = fyLoansGiven - fyPrincipalRecovered;



  // Interest collected during FY: for each loan, compute interest collected up to end and before start, take difference

  const fyInterestCollected = loans.reduce((acc, loan) => {

    const instsForLoan = localInstallmentsByLoanId.get(loan.id) || [];

    const paidUntilEnd = instsForLoan

      .filter((i) => new Date(i.date) <= fyEnd)

      .reduce((sum, i) => sum + (i.amount || 0), 0);

    const paidBeforeStart = instsForLoan

      .filter((i) => new Date(i.date) < fyStart)

      .reduce((sum, i) => sum + (i.amount || 0), 0);

    const interestUntilEnd = Math.max(

      0,

      Math.min(

        paidUntilEnd - (loan.original_amount || 0),

        loan.interest_amount || 0

      )

    );

    const interestBeforeStart = Math.max(

      0,

      Math.min(

        paidBeforeStart - (loan.original_amount || 0),

        loan.interest_amount || 0

      )

    );

    return acc + Math.max(0, interestUntilEnd - interestBeforeStart);

  }, 0);



  // Modal state for breakdown details

  const [breakdownOpen, setBreakdownOpen] = React.useState(false);

  const [breakdownTitle, setBreakdownTitle] = React.useState("");

  const [breakdownItems, setBreakdownItems] = React.useState<any[]>([]);

  const [breakdownSummary, setBreakdownSummary] = React.useState<

    { label: string; value: number }[]

  >([]);



  const openBreakdown = (

    type: "subscriptions" | "interest" | "latefees" | "principal" | "total"

  ) => {

    setBreakdownTitle(() => {

      switch (type) {

        case "subscriptions":

          return `Subscriptions — FY ${fyLabel(selectedFYStart)}`;

        case "interest":

          return `Interest — FY ${fyLabel(selectedFYStart)}`;

        case "latefees":

          return `Late Fees — FY ${fyLabel(selectedFYStart)}`;

        case "principal":

          return `Loan Recovery (Principal) — FY ${fyLabel(selectedFYStart)}`;

        case "total":

          return `Total (FY ${fyLabel(selectedFYStart)})`;

      }

    });



    // Build items depending on type

    if (type === "subscriptions") {

      const items = fySubscriptions.map((s) => ({

        id: s.id,

        date: s.date,

        amount: s.amount,

        receipt: s.receipt,

        source: "Subscription",

        customer: (s as any).customers?.name || "",

      }));

      setBreakdownItems(items);

    } else if (type === "latefees") {

      const instLate = installments

        .filter((i) => within(i.date) && (i.late_fee || 0) > 0)

        .map((i) => {

          const loan = loans.find((l) => l.id === i.loan_id);

          return {

            id: i.id,

            date: i.date,

            amount: i.late_fee || 0,

            receipt: i.receipt_number,

            source: "Installment Late Fee",

            customer: loan?.customers?.name || "",

          };

        });

      const subLate = subscriptions

        .filter((s) => within(s.date) && (s.late_fee || 0) > 0)

        .map((s) => ({

          id: s.id,

          date: s.date,

          amount: s.late_fee || 0,

          receipt: s.receipt,

          source: "Subscription Late Fee",

          customer: (s as any).customers?.name || "",

        }));

      setBreakdownItems([...instLate, ...subLate]);

    } else if (type === "interest") {

      // For interest, find installments that include interest portion for the FY

      const items: any[] = [];

      loans.forEach((loan) => {

        const insts = (localInstallmentsByLoanId.get(loan.id) || []).filter(

          (i) => within(i.date)

        );

        insts.forEach((inst) => {
          // approximate: interest portion is amount beyond remaining principal, but we don't have amortization schedule;
          items.push({
            id: inst.id,
            date: inst.date,
            amount: inst.amount || 0,
            receipt: inst.receipt_number,
            source: "Installment (interest portion)",
            customer: loan.customers?.name || "",
          });
        });
      });

      // We'll include a note that amounts are aggregated above; actual per-installment interest split is not exactly stored

      setBreakdownItems(items);

    } else if (type === "principal") {

      // Show per-loan rows (customer + loan details) instead of individual installments.

      // For each loan, compute principal recovered during FY and include it as a note.

      const items = loans

        .map((loan) => {

          const insts = localInstallmentsByLoanId.get(loan.id) || [];

          const instsInFY = insts.filter((i) => within(i.date));

          const paidUntilEnd = insts

            .filter((i) => new Date(i.date) <= fyEnd)

            .reduce((sum, i) => sum + (i.amount || 0), 0);

          const paidBeforeStart = insts

            .filter((i) => new Date(i.date) < fyStart)

            .reduce((sum, i) => sum + (i.amount || 0), 0);

          const principalUntilEnd = Math.min(

            paidUntilEnd,

            loan.original_amount || 0

          );

          const principalBeforeStart = Math.min(

            paidBeforeStart,

            loan.original_amount || 0

          );

          const principalDuringFY = Math.max(

            0,

            principalUntilEnd - principalBeforeStart

          );



          const remainingAfterFY = Math.max(

            0,

            (loan.original_amount || 0) - principalUntilEnd

          );



          // Representative date: latest installment date within FY if present, otherwise null

          const latestInFY = instsInFY.length

            ? instsInFY.reduce((a, b) =>

              new Date(a.date) > new Date(b.date) ? a : b

            ).date

            : null;



          return {

            id: loan.id,

            date: latestInFY, // ensure date shown relates to FY

            amount: loan.original_amount || 0,

            receipt: loan.receipt || null,

            customer: loan.customers?.name || "",

            notes: `Principal recovered (FY): ${formatCurrencyIN(

              principalDuringFY

            )}`,

            remaining: remainingAfterFY,

            _principalDuringFY: principalDuringFY,

          };

        })

        .filter((it) => (it as any)._principalDuringFY > 0);



      setBreakdownItems(items);

      // compute FY Total Loans Given: loans disbursed within the FY (payment_date in range)

      const fyLoansGiven = loans

        .filter((l) => within(l.payment_date))

        .reduce((acc, l) => acc + (l.original_amount || 0), 0);

      const fyPrincipal = fyPrincipalRecovered; // already computed for FY

      const fyBalance = fyLoansGiven - fyPrincipal;

      setBreakdownSummary([

        { label: "Total Loans Given", value: fyLoansGiven },

        { label: "Loan Recovery (Principal)", value: fyPrincipal },

        { label: "Balance", value: fyBalance },

      ]);

    } else if (type === "total") {

      // combine all contributions

      const subItems = fySubscriptions.map((s) => ({

        id: s.id,

        date: s.date,

        amount: s.amount,

        receipt: s.receipt,

        source: "Subscription",

        customer: (s as any).customers?.name || "",

      }));

      const instItems = installments

        .filter((i) => within(i.date))

        .map((i) => ({

          id: i.id,

          date: i.date,

          amount: i.amount,

          receipt: i.receipt_number,

          source: "Installment",

          customer:

            loans.find((l) => l.id === i.loan_id)?.customers?.name || "",

        }));

      const dataItems = dataEntries

        .filter((e) => within(e.date))

        .map((e) => ({

          id: e.id,

          date: e.date,

          amount: e.amount,

          receipt: e.receipt_number,

          notes: e.notes,

          source: e.subtype || "Data Entry",

          customer: "",

        }));

      setBreakdownItems([...subItems, ...instItems, ...dataItems]);

    }



    setBreakdownOpen(true);

  };



  // No tab state — Loan Recovery will be displayed as its own heading below Total Collected



  const collectedBreakdownCards = [

    {

      label: "Subscriptions",

      value: totalSubscriptionCollected,

      color: "cyan",

    },

    { label: "Interest", value: totalInterestCollected, color: "green" },

    { label: "Late Fees", value: totalLateFeeCollected, color: "orange" },

  ];



  // Keep all collected breakdown cards in leftCards (no Misc Expenses redundant card)

  const leftCards = collectedBreakdownCards;



  // --- Export Functions ---

  const handleExportSubscriptions = () => {

    const subsForExport = subscriptions.map((sub) => ({

      "Customer Name": sub.customers?.name ?? "Unknown",

      "Customer Phone": sub.customers?.phone ?? "N/A",

      Amount: sub.amount,

      Receipt: sub.receipt,

      Date: formatDate(sub.date),

    }));

    const ws = XLSX.utils.json_to_sheet(subsForExport);

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Subscriptions");

    XLSX.writeFile(wb, "Subscriptions_Data.xlsx");

    setExportMenuOpen(false);

  };



  const handleExportComprehensive = () => {

    const customerSummaryData = contextCustomers.map(customer => {

      const customerLoans = loans.filter(l => l.customer_id === customer.id);

      const customerSubscriptions = subscriptions.filter(s => s.customer_id === customer.id);

      const originalAmount = customerLoans.reduce((acc, loan) => acc + loan.original_amount, 0);

      const interestAmount = customerLoans.reduce((acc, loan) => acc + loan.interest_amount, 0);

      const totalAmount = originalAmount + interestAmount;

      const subscriptionAmount = customerSubscriptions.reduce((acc, sub) => acc + sub.amount, 0);

      return {

        'Name': customer.name,

        'Phone Number': customer.phone,

        'Original Amount': originalAmount,

        'Interest Amount': interestAmount,

        'Total Amount': totalAmount,

        'Subscription Amount': subscriptionAmount,

      };

    });



    const allLoansData = loans.map(loan => {

      const loanInstallments = (localInstallmentsByLoanId.get(loan.id) || [])

        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());



      let amountPaid = 0;

      let principalPaid = 0;

      let interestCollected = 0;



      for (const inst of loanInstallments) {

        amountPaid += inst.amount;

        if (principalPaid < loan.original_amount) {

          const principalPortion = Math.min(inst.amount, loan.original_amount - principalPaid);

          principalPaid += principalPortion;

          const interestPortion = inst.amount - principalPortion;

          interestCollected += interestPortion;

        } else {

          interestCollected += inst.amount;

        }

      }



      const totalRepayable = loan.original_amount + loan.interest_amount;

      const isPaidOff = amountPaid >= totalRepayable;



      return {

        'Loan ID': loan.id,

        'Customer Name': loan.customers?.name ?? 'N/A',

        'Original Amount': loan.original_amount,

        'Interest Amount': loan.interest_amount,

        'Total Repayable': totalRepayable,

        'Amount Paid': amountPaid,

        'Principal Paid': principalPaid,

        'Interest Collected': interestCollected,

        'Balance': totalRepayable - amountPaid,

        'Loan Date': loan.payment_date,

        'Installments': `${loanInstallments.length} / ${loan.total_instalments}`,

        'Status': isPaidOff ? 'Paid Off' : 'In Progress',

      };

    });



    const allSubscriptionsData = subscriptions.map(sub => ({

      'Subscription ID': sub.id,

      'Customer Name': sub.customers?.name ?? 'N/A',

      'Amount': sub.amount,

      'Date': sub.date,

      'Receipt': sub.receipt,

    }));



    const allInstallmentsData = installments.map(inst => {

      const parentLoan = loans.find(l => l.id === inst.loan_id);

      return {

        'Installment ID': inst.id,

        'Loan ID': inst.loan_id,

        'Customer Name': parentLoan?.customers?.name ?? 'N/A',

        'Installment Number': inst.installment_number,

        'Amount Paid': inst.amount,

        'Payment Date': inst.date,

        'Receipt Number': inst.receipt_number,

      };

    });



    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customerSummaryData), 'Customer Summary');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allLoansData), 'All Loans');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allSubscriptionsData), 'All Subscriptions');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allInstallmentsData), 'All Installments');

    XLSX.writeFile(wb, 'Comprehensive_Data_Report.xlsx');

    setExportMenuOpen(false);

  };



  const handleExportLoans = () => {

    const loansData = loans.map(loan => {

      const loanInstallments = (localInstallmentsByLoanId.get(loan.id) || [])

        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());



      let amountPaid = 0;

      let principalPaid = 0;

      let interestCollected = 0;



      for (const inst of loanInstallments) {

        amountPaid += inst.amount;

        if (principalPaid < loan.original_amount) {

          const principalPortion = Math.min(inst.amount, loan.original_amount - principalPaid);

          principalPaid += principalPortion;

          const interestPortion = inst.amount - principalPortion;

          interestCollected += interestPortion;

        } else {

          interestCollected += inst.amount;

        }

      }



      const totalRepayable = loan.original_amount + loan.interest_amount;

      const isPaidOff = amountPaid >= totalRepayable;



      return {

        'Customer Name': loan.customers?.name ?? 'N/A',

        'Customer Phone': loan.customers?.phone ?? 'N/A',

        'Original Amount': loan.original_amount,

        'Interest Amount': loan.interest_amount,

        'Total Repayable': totalRepayable,

        'Amount Paid': amountPaid,

        'Principal Paid': principalPaid,

        'Interest Collected': interestCollected,

        'Balance': totalRepayable - amountPaid,

        'Loan Date': formatDate(loan.payment_date),

        'Installments': `${loanInstallments.length} / ${loan.total_instalments}`,

        'Status': isPaidOff ? 'Paid Off' : 'In Progress',

      };

    });

    const ws = XLSX.utils.json_to_sheet(loansData);

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Loans");

    XLSX.writeFile(wb, "Loans_Data.xlsx");

    setExportMenuOpen(false);

  };



  const handleExportSeniority = () => {

    const seniorityData = seniorityList.map((item, index) => ({

      'Position': index + 1,

      'Customer Name': item.customers?.name ?? 'N/A',

      'Customer Phone': item.customers?.phone ?? 'N/A',

      'Station Name': item.station_name ?? 'N/A',

      'Loan Type': item.loan_type ?? 'N/A',

      'Request Date': item.loan_request_date ? formatDate(item.loan_request_date) : 'N/A',

      'Added Date': formatDate(item.created_at),

    }));

    const ws = XLSX.utils.json_to_sheet(seniorityData);

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Seniority List");

    XLSX.writeFile(wb, "Seniority_List.xlsx");

    setExportMenuOpen(false);

  };



  // --- Animation Variants (No changes here) ---

  const mainContainerVariants = {

    hidden: { opacity: 1 },

    visible: {

      opacity: 1,

      transition: { staggerChildren: 0.2 },

    },

  };

  const mainCardVariants = {
    hidden: { y: 20, opacity: 0, scale: 0.95 },
    visible: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: { type: "spring", stiffness: 100, damping: 15 },
    },
    hover: {
      y: -5,
      transition: { type: "spring", stiffness: 400, damping: 10 }
    }
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

      transition: { type: "spring", stiffness: 200, damping: 15 },

    },

  };



  return (
    <PageWrapper>
      <div className="w-full max-w-7xl mx-auto my-8 printable-summary">

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md flex flex-col gap-8 p-6 border border-gray-200/80 dark:border-gray-700">

          <div className="flex justify-between items-center mb-2">

            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-bold text-indigo-700 uppercase tracking-widest">
                Summary Dashboard
              </h2>
            </div>

            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <motion.button
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  const coords = getButtonCenter(e.currentTarget);
                  toggleTheme(coords);
                }}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-yellow-400 flex items-center justify-center shadow-md transition-colors border border-gray-200 dark:border-slate-600 no-print"
                whileHover={{ scale: 1.05, rotate: 15 }}
                whileTap={{ scale: 0.95 }}
                title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {theme === "dark" ? (
                  <SunIcon className="w-5 h-5" />
                ) : (
                  <MoonIcon className="w-5 h-5" />
                )}
              </motion.button>

              {!isScopedCustomer && (

                <div className="relative">

                  <motion.button

                    onClick={() => setExportMenuOpen(!exportMenuOpen)}

                    className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors p-2 sm:p-3 rounded-lg font-semibold text-sm dark:text-gray-200"

                    whileHover={{ scale: 1.02 }}

                    whileTap={{ scale: 0.98 }}

                  >

                    <FileDownIcon className="w-5 h-5" />

                    <span className="hidden sm:inline">Export</span>

                    <svg className={`w-4 h-4 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />

                    </svg>

                  </motion.button>

                  {exportMenuOpen && (

                    <>

                      <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />

                      <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 py-2">

                        <button

                          onClick={handleExportLoans}

                          className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2"

                        >

                          <FileDownIcon className="w-4 h-4 text-blue-600" />

                          Export Loans

                        </button>

                        <button

                          onClick={handleExportSubscriptions}

                          className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2"

                        >

                          <FileDownIcon className="w-4 h-4 text-cyan-600" />

                          Export Subscriptions

                        </button>

                        <button

                          onClick={handleExportSeniority}

                          className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2"

                        >

                          <FileDownIcon className="w-4 h-4 text-purple-600" />

                          Export Loan Seniority

                        </button>

                        <div className="border-t border-gray-100 my-1" />

                        <button

                          onClick={handleExportComprehensive}

                          className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2"

                        >

                          <FileDownIcon className="w-4 h-4 text-indigo-600" />

                          Export Comprehensive Report

                        </button>

                      </div>

                    </>

                  )}

                </div>

              )}
            </div>
          </div>



          <motion.div

            className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch"

            variants={mainContainerVariants}

            initial="hidden"

            animate="visible"

          >

            {/* Section 1: Income */}

            <motion.div
              className="lg:col-span-1 bg-white/60 dark:bg-slate-800/60 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-5 flex flex-col gap-4 shadow-sm h-full"
              variants={mainCardVariants}
              whileHover="hover"
            >

              <div className="w-full flex items-center justify-between">

                <div className="flex items-center gap-3">

                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold">

                    ₹

                  </div>

                  <div>

                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">

                      Income

                    </div>

                    <div className="text-xs text-gray-400">

                      Collections & recoveries

                    </div>

                  </div>

                </div>

              </div>



              <div className="flex flex-col items-center">

                <span className="text-base font-medium text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">

                  Total Collected

                </span>

                <span className="text-4xl font-bold text-indigo-700 dark:text-indigo-400 mt-1">

                  <AnimatedNumber value={totalAllCollected} />
                </span>

              </div>



              {/* Quick summary: Loan Balance (keep clearly inside Income column) */}

              <div className="w-full mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">

                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 flex flex-col items-start">

                  <div className="text-xs text-gray-600 dark:text-blue-300">Loan Balance</div>

                  <div className="text-lg font-bold text-blue-800 dark:text-blue-200 mt-1"><AnimatedNumber value={loanBalance} /></div>

                </div>

                <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-100 dark:border-cyan-800 flex flex-col items-start">

                  <div className="text-xs text-gray-600 dark:text-cyan-300">Subscription Balance</div>

                  <div className="text-lg font-bold text-cyan-800 dark:text-cyan-200 mt-1"><AnimatedNumber value={subscriptionBalance} /></div>

                </div>

              </div>







              {/* Income breakdown as list items */}

              <div className="w-full mt-4">

                <div className="space-y-3">

                  {/* Loan Recovery (Principal) */}

                  <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">

                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">

                      Loan Recovery (Principal)

                    </span>

                    <span className="text-lg font-bold text-blue-800 dark:text-blue-200">

                      <AnimatedNumber value={totalPrincipalRecovered} />
                    </span>

                  </div>

                  {/* Subscriptions, Interest, Late Fees */}

                  {leftCards.map((card) => (

                    <div

                      key={card.label}

                      className={`flex items-center justify-between px-4 py-3 rounded-lg bg-${card.color}-50 dark:bg-${card.color}-900/20 border border-${card.color}-200 dark:border-${card.color}-800`}

                    >

                      <span className={`text-sm font-medium text-${card.color}-700 dark:text-${card.color}-300`}>

                        {card.label}

                      </span>

                      <span className={`text-lg font-bold text-${card.color}-800 dark:text-${card.color}-200`}>

                        <AnimatedNumber value={card.value} />
                      </span>

                    </div>

                  ))}

                </div>

              </div>

              {/* Subscriptions Balance box: shows Subscriptions, Subscription Return and Balance */}

              <div className="w-full mt-4">

                <div className="flex items-center justify-between p-4 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">

                  <div>

                    <div className="text-sm font-medium text-cyan-700 dark:text-cyan-300">

                      Subscriptions Balance

                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400">

                      Subscriptions - Subscription Return = Balance

                    </div>

                  </div>

                </div>

                <div className="mt-3 space-y-2">

                  <div className="flex items-center justify-between px-3 py-1 rounded-md bg-cyan-25/30 dark:bg-cyan-900/30">

                    <div className="text-sm text-gray-700 dark:text-gray-300">Subscriptions</div>

                    <div className="text-sm font-medium text-cyan-700 dark:text-cyan-300">

                      <AnimatedNumber value={totalSubscriptionCollected} />
                    </div>

                  </div>

                  <div className="flex items-center justify-between px-3 py-1 rounded-md bg-cyan-25/30 dark:bg-cyan-900/30">

                    <div className="text-sm text-gray-700 dark:text-gray-300">

                      Subscription Return

                    </div>

                    <div className="text-sm font-medium text-cyan-700 dark:text-cyan-300">

                      <AnimatedNumber value={subscriptionReturnTotal} />
                    </div>

                  </div>

                  <div className="flex items-center justify-between px-3 py-1 rounded-md bg-cyan-25/30 dark:bg-cyan-900/30">

                    <div className="text-sm font-medium text-cyan-700 dark:text-cyan-300">

                      Balance

                    </div>

                    <div

                      className={`text-sm font-bold ${subscriptionBalance < 0 ? "text-red-600 dark:text-red-400" : "text-cyan-800 dark:text-cyan-200"

                        }`}

                    >

                      <AnimatedNumber value={subscriptionBalance} />
                    </div>

                  </div>

                </div>

              </div>

              {/* Loan Balance box: Total Loans Given - Loan Recovery (Principal) = Loan Balance */}

              <div className="w-full mt-4">

                <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">

                  <div>

                    <div className="text-sm font-medium text-blue-700 dark:text-blue-300">

                      Loans Summary

                    </div>

                  </div>

                </div>

                <div className="mt-3 space-y-2">

                  <div className="flex items-center justify-between px-3 py-1 rounded-md bg-blue-25/30 dark:bg-blue-900/30">

                    <div className="text-sm text-gray-700 dark:text-gray-300">Total Loans Given</div>

                    <div className="text-sm font-medium text-blue-700 dark:text-blue-300">

                      <AnimatedNumber value={totalLoansGiven} />
                    </div>

                  </div>

                  <div className="flex items-center justify-between px-3 py-1 rounded-md bg-blue-25/30 dark:bg-blue-900/30">

                    <div className="text-sm text-gray-700 dark:text-gray-300">

                      Loan Recovery (Principal)

                    </div>

                    <div className="text-sm font-medium text-blue-700 dark:text-blue-300">

                      <AnimatedNumber value={totalPrincipalRecovered} />
                    </div>

                  </div>

                  <div className="flex items-center justify-between px-3 py-1 rounded-md bg-blue-25/30 dark:bg-blue-900/30 border-t border-blue-100 dark:border-blue-800">

                    <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Balance</div>

                    <div className={`text-sm font-bold ${loanBalance < 0 ? "text-red-600 dark:text-red-400" : "text-blue-800 dark:text-blue-200"}`}>

                      <AnimatedNumber value={loanBalance} />
                    </div>

                  </div>

                  {/* Balance now shown in Loans Summary section */}

                </div>

              </div>

            </motion.div>



            {/* Section 2: Expenses */}

            <motion.div
              className="lg:col-span-1 bg-white/60 dark:bg-slate-800/60 border border-red-100 dark:border-red-800 rounded-2xl p-5 flex flex-col gap-4 shadow-sm h-full"
              variants={mainCardVariants}
              whileHover="hover"
            >

              <div className="w-full flex items-center gap-3 mb-3">

                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-bold">

                  -

                </div>

                <div className="text-sm">

                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">

                    Expenses

                  </div>

                  <div className="text-xs text-gray-400">

                    Outgoing & disbursed principal

                  </div>

                </div>

              </div>



              <div className="flex flex-col items-center">

                <span className="text-base font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wider">

                  Total Loans Given

                </span>

                <span className="text-4xl font-bold text-blue-700 dark:text-blue-400 mt-1">

                  <AnimatedNumber value={totalLoansGiven} />
                </span>

              </div>

              {/* Previously showed a separate 'Misc Expenses' card here; removed because subtype breakdown already covers expenses. */}

              {/* Expenses box (calculated from selected misc entry subtypes) */}

              <div className="w-full mt-4">

                <div

                  className={`flex items-center justify-between p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800`}

                >

                  <div>

                    <div className={`text-sm font-medium text-red-700 dark:text-red-300`}>

                      Expenses

                    </div>

                    <div className={`text-lg font-bold text-red-800 dark:text-red-200 mt-1`}>

                      <AnimatedNumber value={totalExpenses} />
                    </div>

                  </div>

                </div>

                {/* Per-subtype breakdown */}

                <div className="mt-3 space-y-2">

                  {Object.entries(expenseTotalsBySubtype).map(

                    ([subtype, amt]) => (

                      <div

                        key={subtype}

                        className="flex items-center justify-between px-3 py-1 rounded-md bg-red-25/30 dark:bg-red-900/30"

                      >

                        <div className="text-sm text-gray-700 dark:text-gray-300">{subtype}</div>

                        <div className="text-sm font-medium text-red-700 dark:text-red-300">

                          <AnimatedNumber value={(amt as number) || 0} />
                        </div>

                      </div>

                    )

                  )}

                </div>

              </div>

            </motion.div>

          </motion.div>



          {/* Financial Year Section - separate visualization for selected FY */}
          {/* Hidden for scoped users */}
          {!isScopedCustomer && (
            <div className="w-full mt-6 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-gray-700 rounded-lg p-4">

              <div className="flex items-center justify-between mb-3">

                <div>

                  <div className="text-2xl font-bold text-gray-700 dark:text-gray-200 uppercase">

                    Financial Year Summary — FY {fyLabel(selectedFYStart)}

                  </div>

                  <div className="text-xs text-gray-400">

                    Select a fiscal year (Apr - Mar) to visualize collections

                  </div>

                </div>

                <div className="flex items-center gap-3 no-print">
                  <div className="relative" ref={fyDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setFyDropdownOpen(!fyDropdownOpen)}
                      className="bg-white dark:bg-dark-bg border border-gray-300 dark:border-dark-border rounded-lg py-2 px-4 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 flex justify-between items-center text-gray-800 dark:text-dark-text"
                      style={{ minWidth: 150 }}
                    >
                      <span>{fyLabel(selectedFYStart)}</span>
                      <svg
                        className={`w-4 h-4 ml-2 transition-transform ${fyDropdownOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {fyDropdownOpen && (
                      <div className="absolute z-10 mt-1 w-full bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded-lg shadow-lg max-h-60 overflow-auto animate-fadeIn">
                        <ul>
                          {(showAllFYOptions ? fyOptions : fyOptions.slice(0, 5)).map((y) => (
                            <li
                              key={y}
                              onClick={() => {
                                setSelectedFYStart(y);
                                setFyDropdownOpen(false);
                                setShowAllFYOptions(false);
                              }}
                              className={`px-4 py-2 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-gray-800 dark:text-dark-text ${
                                selectedFYStart === y ? 'bg-indigo-50 dark:bg-indigo-900/50 font-bold' : ''
                              }`}
                            >
                              {fyLabel(y)}
                            </li>
                          ))}
                          {!showAllFYOptions && fyOptions.length > 5 && (
                            <li
                              key="view-more"
                              onClick={() => setShowAllFYOptions(true)}
                              className="px-4 py-2 cursor-pointer text-gray-500 dark:text-gray-400 italic hover:bg-gray-100 dark:hover:bg-gray-700 border-t border-gray-200 dark:border-dark-border"
                            >
                              -- View More --
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>

                </div>

              </div>



              <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

                <motion.div
                  whileHover={{ y: -5 }}
                  className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 flex flex-col items-start transition-shadow hover:shadow-md"
                >

                  <div className="flex items-center justify-between w-full">

                    <div className="text-xs text-gray-600 dark:text-gray-200">Subscriptions (FY)</div>

                    <button

                      onClick={() => openBreakdown("subscriptions")}

                      className="text-xs text-indigo-600 underline"

                    >

                      Details

                    </button>

                  </div>

                  <div className="text-xl font-bold text-cyan-800 dark:text-cyan-200 mt-2">

                    <AnimatedNumber value={fySubscriptionCollected} />
                  </div>

                </motion.div>
                <motion.div
                  whileHover={{ y: -5 }}
                  className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex flex-col items-start transition-shadow hover:shadow-md"
                >

                  <div className="flex items-center justify-between w-full">

                    <div className="text-xs text-gray-600 dark:text-gray-200">Interest (FY)</div>

                    <button

                      onClick={() => openBreakdown("interest")}

                      className="text-xs text-indigo-600 underline"

                    >

                      Details

                    </button>

                  </div>

                  <div className="text-xl font-bold text-green-800 dark:text-green-200 mt-2">

                    <AnimatedNumber value={fyInterestCollected} />
                  </div>

                </motion.div>
                <motion.div
                  whileHover={{ y: -5 }}
                  className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 flex flex-col items-start transition-shadow hover:shadow-md"
                >

                  <div className="flex items-center justify-between w-full">

                    <div className="text-xs text-gray-600 dark:text-gray-200">Late Fees (FY)</div>

                    <button

                      onClick={() => openBreakdown("latefees")}

                      className="text-xs text-indigo-600 underline"

                    >

                      Details

                    </button>

                  </div>

                  <div className="text-xl font-bold text-orange-800 dark:text-orange-200 mt-2">

                    <AnimatedNumber value={fyLateFees} />
                  </div>

                </motion.div>
                <motion.div
                  whileHover={{ y: -5 }}
                  className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex flex-col items-start transition-shadow hover:shadow-md"
                >

                  <div className="flex items-center justify-between w-full">

                    <div className="text-xs text-gray-600 dark:text-gray-200">

                      Loan Recovery (Principal) (FY)

                    </div>

                    <button

                      onClick={() => openBreakdown("principal")}

                      className="text-xs text-indigo-600 underline"

                    >

                      Details

                    </button>

                  </div>

                  <div className="text-xl font-bold text-blue-800 dark:text-blue-200 mt-2">

                    <AnimatedNumber value={fyPrincipalRecovered} />
                  </div>

                </motion.div>

                {/* FY Loans Given vs Recovery Balance */}
                <motion.div
                  whileHover={{ y: -5 }}
                  className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex flex-col items-start transition-shadow hover:shadow-md"
                >

                  <div className="flex items-center justify-between w-full">

                    <div className="text-xs text-gray-600 dark:text-gray-200">Loans Given (FY)</div>

                    <div className="text-xs text-gray-600 dark:text-gray-200">Balance (FY)</div>

                  </div>

                  <div className="mt-2 w-full">

                    <div className="flex items-center justify-between">

                      <div className="text-sm text-gray-700 dark:text-gray-200">Total Loans Given</div>

                      <div className="text-sm font-medium text-blue-700 dark:text-blue-300">

                        <AnimatedNumber value={fyLoansGiven} />
                      </div>

                    </div>

                    <div className="flex items-center justify-between mt-1">

                      <div className="text-sm text-gray-700 dark:text-gray-200">

                        Loan Recovery (Principal)

                      </div>

                      <div className="text-sm font-medium text-blue-700 dark:text-blue-300">

                        <AnimatedNumber value={fyPrincipalRecovered} />
                      </div>

                    </div>

                    <div className="flex items-center justify-between mt-2">

                      <div className="text-sm font-medium text-blue-700 dark:text-blue-300">

                        Balance

                      </div>

                      <div

                        className={`text-sm font-bold ${fyLoanBalance < 0 ? "text-red-600 dark:text-red-400" : "text-blue-800 dark:text-blue-200"

                          }`}

                      >

                        <AnimatedNumber value={fyLoanBalance} />
                      </div>

                    </div>

                  </div>

                </motion.div>

                <motion.div
                  whileHover={{ y: -5 }}
                  className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 flex flex-col items-start transition-shadow hover:shadow-md"
                >

                  <div className="flex items-center justify-between w-full">

                    <div className="text-xs text-gray-600 dark:text-gray-200">Total (FY)</div>

                    <button

                      onClick={() => openBreakdown("total")}

                      className="text-xs text-indigo-600 underline"

                    >

                      Details

                    </button>

                  </div>

                  <div className="text-xl font-bold text-indigo-800 dark:text-indigo-200 mt-2">

                    <AnimatedNumber value={fySubscriptionCollected + fyInterestCollected + fyLateFees + fyPrincipalRecovered} />
                  </div>

                </motion.div>

                {/* FY Expenses card (deductible) */}
                <motion.div
                  whileHover={{ y: -5 }}
                  className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex flex-col items-start transition-shadow hover:shadow-md"
                >

                  <div className="flex items-center justify-between w-full">

                    <div className="text-xs text-gray-600 dark:text-gray-200">

                      FY Expenses (selected subtypes)

                    </div>

                  </div>

                  <div className="text-xl font-bold text-red-800 dark:text-red-200 mt-2">

                    <AnimatedNumber value={fyExpensesTotal} />
                  </div>

                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">Breakdown:</div>

                  <div className="mt-2 space-y-1 w-full">

                    {fyExpenseSubtypes.map((s) => (

                      <div

                        key={s}

                        className="flex items-center justify-between text-sm"

                      >

                        <div className="text-gray-700 dark:text-gray-200">{s}</div>

                        <div className="font-medium text-red-700 dark:text-red-300">

                          <AnimatedNumber value={fyExpensesBySubtype[s] || 0} />
                        </div>

                      </div>

                    ))}

                  </div>

                </motion.div>

                {/* Net FY Total (collections - expenses) */}
                <motion.div
                  whileHover={{ y: -5 }}
                  className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex flex-col items-start transition-shadow hover:shadow-md"
                >

                  <div className="flex items-center justify-between w-full">

                    <div className="text-xs text-gray-600 dark:text-emerald-200">Net Total (FY)</div>

                  </div>

                  <div className="text-xl font-bold text-emerald-800 dark:text-emerald-200 mt-2">

                    <AnimatedNumber value={fySubscriptionCollected + fyInterestCollected + fyLateFees + fyPrincipalRecovered - fyExpensesTotal} />
                  </div>

                </motion.div>

              </div>

            </div>
          )}




          <div className="text-center text-xs text-gray-400 mt-2">

            Updated as of {formatDate(new Date().toISOString().slice(0, 10))}

          </div>



          <FYBreakdownModal

            open={breakdownOpen}

            title={breakdownTitle}

            items={breakdownItems}

            summary={breakdownSummary}

            onClose={() => setBreakdownOpen(false)}

          />

        </div>

      </div>
    </PageWrapper >
  );
};



export default SummaryPage;