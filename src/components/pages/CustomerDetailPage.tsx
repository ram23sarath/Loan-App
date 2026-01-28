import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext";
import CustomerDetailModal from "../modals/CustomerDetailModal";
import EditModal from "../modals/EditModal";
import PageWrapper from "../ui/PageWrapper";
import GlassCard from "../ui/GlassCard";
import type { Loan, Subscription, Installment } from "../../types";

const CustomerDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    customers,
    loans,
    subscriptions,
    installments,
    dataEntries,
    loading,
    updateLoan,
    updateSubscription,
    updateInstallment,
    deleteLoan,
    deleteSubscription,
    deleteInstallment,
    deleteDataEntry,
  } = useData();
  const [editModal, setEditModal] = useState<
    | { type: "loan"; data: Loan }
    | { type: "subscription"; data: Subscription }
    | { type: "installment"; data: Installment }
    | null
  >(null);

  if (loading) {
    return (
      <PageWrapper>
        <GlassCard>
          <p className="dark:text-dark-text">Loading...</p>
        </GlassCard>
      </PageWrapper>
    );
  }

  const customer = customers.find((c) => c.id === id);

  if (!customer) {
    return (
      <PageWrapper>
        <GlassCard>
          <div className="text-center">
            <p className="dark:text-dark-muted mb-4">Customer not found.</p>
            <button
              onClick={() => navigate("/customers")}
              className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Back to Customers
            </button>
          </div>
        </GlassCard>
      </PageWrapper>
    );
  }

  const customerLoans = loans.filter((l) => l.customer_id === id);
  const customerSubscriptions = subscriptions.filter(
    (s) => s.customer_id === id,
  );
  const customerDataEntries = dataEntries.filter((d) => d.customer_id === id);

  return (
    <PageWrapper>
      {/* Render the modal content as a full page */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg">
        <CustomerDetailModal
          customer={customer}
          loans={customerLoans}
          subscriptions={customerSubscriptions}
          installments={installments}
          dataEntries={customerDataEntries}
          onClose={() => navigate("/customers")}
          deleteLoan={deleteLoan}
          deleteSubscription={deleteSubscription}
          deleteInstallment={deleteInstallment}
          deleteDataEntry={deleteDataEntry}
          onEditLoan={(loan) => setEditModal({ type: "loan", data: loan })}
          onEditSubscription={(sub) =>
            setEditModal({ type: "subscription", data: sub })
          }
          onEditInstallment={(installment) =>
            setEditModal({ type: "installment", data: installment })
          }
        />
      </div>

      {editModal && (
        <EditModal
          type={editModal.type}
          data={editModal.data}
          onSave={async (updated) => {
            try {
              if (editModal.type === "loan") {
                await updateLoan(updated.id, {
                  original_amount: updated.original_amount,
                  interest_amount: updated.interest_amount,
                  payment_date: updated.payment_date,
                  total_instalments: updated.total_instalments,
                });
              } else if (editModal.type === "subscription") {
                await updateSubscription(updated.id, {
                  amount: updated.amount,
                  year: updated.year,
                  date: updated.date,
                  receipt: updated.receipt,
                });
              } else if (editModal.type === "installment") {
                await updateInstallment(updated.id, {
                  amount: updated.amount,
                  late_fee: updated.late_fee ?? 0,
                  date: updated.date,
                  receipt_number: updated.receipt_number,
                });
              }
              setEditModal(null);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              alert(message || "Failed to update record");
            }
          }}
          onClose={() => setEditModal(null)}
        />
      )}
    </PageWrapper>
  );
};

export default CustomerDetailPage;
