import { useState } from "react";
import type {
  Customer,
  DataEntry,
  Installment,
  LoanWithCustomer,
  SubscriptionWithCustomer,
} from "../../../../types";
import { formatDate } from "../../../../utils/dateFormatter";
import {
  calculateLoanMetrics,
  isLoanOngoing,
} from "../utils/calculations";

interface UseCustomerDetailActionsParams {
  customer: Customer;
  loans: LoanWithCustomer[];
  subscriptions: SubscriptionWithCustomer[];
  installments: Installment[];
  deleteLoan: (loanId: string) => Promise<void>;
  deleteSubscription: (subscriptionId: string) => Promise<void>;
  deleteInstallment: (installmentId: string) => Promise<void>;
  deleteDataEntry?: (dataEntryId: string) => Promise<void>;
  installmentsByLoanId: Map<string, Installment[]>;
}

export const useCustomerDetailActions = ({
  customer,
  loans,
  subscriptions,
  installments,
  deleteLoan,
  deleteSubscription,
  deleteInstallment,
  deleteDataEntry,
  installmentsByLoanId,
}: UseCustomerDetailActionsParams) => {
  const [deleteLoanTarget, setDeleteLoanTarget] =
    useState<LoanWithCustomer | null>(null);
  const [deleteSubTarget, setDeleteSubTarget] =
    useState<SubscriptionWithCustomer | null>(null);
  const [deleteInstTarget, setDeleteInstTarget] = useState<Installment | null>(
    null,
  );
  const [deleteDataEntryTarget, setDeleteDataEntryTarget] =
    useState<DataEntry | null>(null);

  const [showRecordLoan, setShowRecordLoan] = useState<boolean>(false);
  const [showRecordSubscription, setShowRecordSubscription] =
    useState<boolean>(false);
  const [showRecordDataEntry, setShowRecordDataEntry] =
    useState<boolean>(false);
  const [editingDataEntry, setEditingDataEntry] = useState<DataEntry | null>(
    null,
  );

  const [isDeletingDataEntry, setIsDeletingDataEntry] = useState(false);
  const [isDeletingLoan, setIsDeletingLoan] = useState(false);
  const [isDeletingSubscription, setIsDeletingSubscription] = useState(false);
  const [isDeletingInstallment, setIsDeletingInstallment] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const anyInternalModalOpen =
    !!deleteLoanTarget ||
    !!deleteSubTarget ||
    !!deleteInstTarget ||
    !!deleteDataEntryTarget ||
    showRecordLoan ||
    showRecordSubscription ||
    showRecordDataEntry ||
    !!editingDataEntry;

  const closeTopInternalModal = () => {
    if (editingDataEntry) {
      setEditingDataEntry(null);
      return;
    }
    if (showRecordDataEntry) {
      setShowRecordDataEntry(false);
      return;
    }
    if (showRecordSubscription) {
      setShowRecordSubscription(false);
      return;
    }
    if (showRecordLoan) {
      setShowRecordLoan(false);
      return;
    }
    if (deleteDataEntryTarget) {
      setDeleteDataEntryTarget(null);
      return;
    }
    if (deleteInstTarget) {
      setDeleteInstTarget(null);
      return;
    }
    if (deleteSubTarget) {
      setDeleteSubTarget(null);
      return;
    }
    if (deleteLoanTarget) {
      setDeleteLoanTarget(null);
    }
  };

  const confirmDeleteLoan = async () => {
    if (!deleteLoanTarget) return;

    setDeleteError(null);
    setIsDeletingLoan(true);

    try {
      await deleteLoan(deleteLoanTarget.id);
      setDeleteLoanTarget(null);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setDeleteError(msg);
    } finally {
      setIsDeletingLoan(false);
    }
  };

  const confirmDeleteSubscription = async () => {
    if (!deleteSubTarget) return;

    setDeleteError(null);
    setIsDeletingSubscription(true);

    try {
      await deleteSubscription(deleteSubTarget.id);
      setDeleteSubTarget(null);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setDeleteError(msg);
    } finally {
      setIsDeletingSubscription(false);
    }
  };

  const confirmDeleteInstallment = async () => {
    if (!deleteInstTarget) return;

    setDeleteError(null);
    setIsDeletingInstallment(true);

    try {
      await deleteInstallment(deleteInstTarget.id);
      setDeleteInstTarget(null);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setDeleteError(msg);
    } finally {
      setIsDeletingInstallment(false);
    }
  };

  const confirmDeleteDataEntry = async () => {
    if (!deleteDataEntryTarget || !deleteDataEntry) return;

    setDeleteError(null);
    setIsDeletingDataEntry(true);

    try {
      await deleteDataEntry(deleteDataEntryTarget.id);
      setDeleteDataEntryTarget(null);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setDeleteError(msg);
    } finally {
      setIsDeletingDataEntry(false);
    }
  };

  const handleIndividualExport = async () => {
    setExportError(null);
    setExportSuccess(null);
    setIsExporting(true);

    try {
      const XLSX = await import("xlsx");

      const customerLoansData = loans.map((loan) => {
        const metrics = calculateLoanMetrics(loan, installmentsByLoanId);
        const loanInstallments = installmentsByLoanId.get(loan.id) || [];
        const lateFeesPaid = loanInstallments.reduce(
          (acc, inst) => acc + (inst.late_fee || 0),
          0,
        );

        return {
          "Loan ID": loan.id,
          "Original Amount": loan.original_amount,
          "Interest Amount": loan.interest_amount,
          "Total Repayable": metrics.totalRepayable,
          "Amount Paid": metrics.amountPaid,
          "Late Fees Paid": lateFeesPaid,
          Balance: metrics.balance,
          "Loan Date": formatDate(loan.payment_date),
          Status: isLoanOngoing(loan, installmentsByLoanId)
            ? "In Progress"
            : "Paid Off",
        };
      });

      const customerSubscriptionsData = subscriptions.map((sub) => ({
        "Subscription ID": sub.id,
        Amount: sub.amount,
        Date: formatDate(sub.date),
        Receipt: sub.receipt,
      }));

      const customerInstallmentsData = installments
        .filter((inst) => loans.some((loan) => loan.id === inst.loan_id))
        .map((inst) => ({
          "Installment ID": inst.id,
          "Loan ID": inst.loan_id,
          "Installment Number": inst.installment_number,
          "Amount Paid": inst.amount,
          "Late Fee Paid": inst.late_fee || 0,
          "Payment Date": formatDate(inst.date),
          "Receipt Number": inst.receipt_number,
        }));

      const hasExportData =
        customerLoansData.length > 0 ||
        customerSubscriptionsData.length > 0 ||
        customerInstallmentsData.length > 0;

      if (!hasExportData) {
        setExportError("Export failed: No customer data available to export.");
        return;
      }

      const wb = XLSX.utils.book_new();

      if (customerLoansData.length > 0) {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(customerLoansData),
          "Loans",
        );
      }

      if (customerSubscriptionsData.length > 0) {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(customerSubscriptionsData),
          "Subscriptions",
        );
      }

      if (customerInstallmentsData.length > 0) {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(customerInstallmentsData),
          "Installments",
        );
      }

      const sanitizedName = customer.name.replace(/[/\\?%*:|"<>]/g, "_");
      XLSX.writeFile(wb, `${sanitizedName}_Details.xlsx`);

      setExportSuccess(`Data exported successfully: ${sanitizedName}_Details.xlsx`);
    } catch (error: unknown) {
      console.error("Export failed:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setExportError(`Export failed: ${errorMsg}`);
    } finally {
      setIsExporting(false);
    }
  };

  return {
    deleteLoanTarget,
    setDeleteLoanTarget,
    deleteSubTarget,
    setDeleteSubTarget,
    deleteInstTarget,
    setDeleteInstTarget,
    deleteDataEntryTarget,
    setDeleteDataEntryTarget,
    showRecordLoan,
    setShowRecordLoan,
    showRecordSubscription,
    setShowRecordSubscription,
    showRecordDataEntry,
    setShowRecordDataEntry,
    editingDataEntry,
    setEditingDataEntry,
    isDeletingDataEntry,
    isDeletingLoan,
    isDeletingSubscription,
    isDeletingInstallment,
    deleteError,
    setDeleteError,
    isExporting,
    exportError,
    setExportError,
    exportSuccess,
    setExportSuccess,
    anyInternalModalOpen,
    closeTopInternalModal,
    confirmDeleteLoan,
    confirmDeleteSubscription,
    confirmDeleteInstallment,
    confirmDeleteDataEntry,
    handleIndividualExport,
  };
};
