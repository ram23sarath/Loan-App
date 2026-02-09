import React, { useEffect } from "react";
import SubscriptionTableView from "./SubscriptionTableView";
import { useRouteReady } from "../RouteReadySignal";
import { useData } from "../../context/DataContext";
import PageWrapper from "../ui/PageWrapper";
import { HistoryIcon, SpinnerIcon } from "../../constants";
import type { SubscriptionWithCustomer } from "../../types";
import { formatDate } from "../../utils/dateFormatter";
import DeleteConfirmationModal from "../modals/DeleteConfirmationModal";

const SubscriptionListPage = () => {
  const signalRouteReady = useRouteReady();
  const { subscriptions, deleteSubscription, isRefreshing, isScopedCustomer } =
    useData();

  const [pendingDelete, setPendingDelete] =
    React.useState<SubscriptionWithCustomer | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  useEffect(() => {
    signalRouteReady();
  }, [signalRouteReady]);

  const handleDeleteSubscription = (sub: SubscriptionWithCustomer) => {
    setPendingDelete(sub);
  };

  // Track the ID being deleted for background animation
  const [animatingDeleteId, setAnimatingDeleteId] = React.useState<
    string | null
  >(null);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const deleteId = pendingDelete.id;

    setDeleting(true);
    // Start the background animation immediately
    setAnimatingDeleteId(deleteId);

    try {
      await deleteSubscription(deleteId);
      // Close modal after successful delete
      setPendingDelete(null);
    } catch (error: any) {
      // On error, stop the animation and show error
      setAnimatingDeleteId(null);
      alert(error.message);
    } finally {
      setDeleting(false);
      setAnimatingDeleteId(null);
    }
  };

  return (
    <PageWrapper>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4 sm:gap-0 px-2 sm:px-0">
        <h2 className="text-2xl sm:text-4xl font-bold flex items-center gap-3 sm:gap-4 text-gray-800 dark:text-dark-text">
          <HistoryIcon className="w-8 h-8 sm:w-10 sm:h-10" />
          <span>Subscription Details</span>
          {isRefreshing && (
            <SpinnerIcon className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-indigo-500" />
          )}
        </h2>
      </div>

      <SubscriptionTableView
        onDelete={handleDeleteSubscription}
        deletingId={animatingDeleteId}
      />

      <DeleteConfirmationModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Move to Trash?"
        message={
          <>
            Are you sure you want to move the subscription for{" "}
            <span className="font-semibold">
              {pendingDelete?.customers?.name}
            </span>{" "}
            from {pendingDelete ? formatDate(pendingDelete.date) : ""} to trash?
          </>
        }
        isDeleting={deleting}
        confirmText="Delete"
      />
    </PageWrapper>
  );
};

export default SubscriptionListPage;
