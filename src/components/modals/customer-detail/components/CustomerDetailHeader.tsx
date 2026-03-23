import React from "react";
import { motion } from "framer-motion";
import type { Customer } from "../../../../types";
import GlassCard from "../../../ui/GlassCard";
import { FileDownIcon, XIcon } from "../../../../constants";
import type { SummaryTotals } from "../utils/calculations";
import { formatCurrency } from "../utils/calculations";

interface CustomerDetailHeaderProps {
  customer: Customer;
  summaryTotals: SummaryTotals;
  interestCharged: number;
  isExporting: boolean;
  onExport: () => void;
  avatarImageUrl?: string | null;
  onClose: () => void;
}

const CustomerDetailHeader: React.FC<CustomerDetailHeaderProps> = ({
  customer,
  summaryTotals,
  interestCharged,
  isExporting,
  onExport,
  avatarImageUrl,
  onClose,
}) => {
  const [avatarLoadFailed, setAvatarLoadFailed] = React.useState(false);

  React.useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarImageUrl]);

  const shouldShowAvatar = Boolean(avatarImageUrl && !avatarLoadFailed);

  return (
    <GlassCard
      className="!p-0 w-full flex-shrink-0 dark:bg-dark-card dark:border-dark-border"
      disable3D
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 sm:p-5 md:p-6 border-b border-gray-200 dark:border-dark-border gap-4 md:gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 sm:gap-4">
            {shouldShowAvatar && (
              <img
                src={avatarImageUrl || undefined}
                alt={`${customer.name} avatar`}
                className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full object-cover ring-2 ring-indigo-200 dark:ring-indigo-900/60 flex-shrink-0"
                onError={() => setAvatarLoadFailed(true)}
                loading="lazy"
              />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-2xl md:text-3xl font-bold dark:text-dark-text truncate">
                {customer.name}
              </h2>
              <p className="text-xs sm:text-sm md:text-base text-gray-500 dark:text-dark-muted mb-4">
                {customer.phone}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 sm:gap-2 text-xs">
            <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-900/20">
              <span className="text-gray-600 dark:text-dark-muted text-xs block mb-0.5">
                Loan:
              </span>
              <p className="font-bold text-green-600 dark:text-green-400 text-xs sm:text-sm">
                {formatCurrency(summaryTotals.totalLoan)}
              </p>
            </div>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <span className="text-gray-600 dark:text-dark-muted text-xs block mb-0.5">
                Loan Interest:
              </span>
              <p className="font-bold text-amber-600 dark:text-amber-400 text-xs sm:text-sm">
                {formatCurrency(summaryTotals.totalLoanInterest)}
              </p>
            </div>
            <div className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-900/20">
              <span className="text-gray-600 dark:text-dark-muted text-xs block mb-0.5">
                Subscription:
              </span>
              <p className="font-bold text-cyan-600 dark:text-cyan-400 text-xs sm:text-sm">
                {formatCurrency(summaryTotals.totalSubscription)}
              </p>
            </div>

            <div className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20">
              <span className="text-gray-600 dark:text-dark-muted text-xs block mb-0.5">
                Subscription Interest:
              </span>
              <p className="font-bold text-orange-600 dark:text-orange-400 text-xs sm:text-sm">
                {formatCurrency(interestCharged)}
              </p>
            </div>

            <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20">
              <span className="text-gray-600 dark:text-dark-muted text-xs block mb-0.5">
                Late Fees:
              </span>
              <p className="font-bold text-red-600 dark:text-red-400 text-xs sm:text-sm">
                {formatCurrency(summaryTotals.totalLateFees)}
              </p>
            </div>

            <div className="p-1.5 rounded-lg bg-pink-50 dark:bg-pink-900/20">
              <span className="text-gray-600 dark:text-dark-muted text-xs block mb-0.5">
                Expenditure:
              </span>
              <p className="font-bold text-pink-600 dark:text-pink-400 text-xs sm:text-sm">
                {formatCurrency(summaryTotals.totalMiscEntries)}
              </p>
            </div>

            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
              <span className="text-gray-600 dark:text-dark-muted text-xs block mb-0.5">
                Net:
              </span>
              <p
                className={`font-bold text-xs sm:text-sm ${summaryTotals.netTotal >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-red-600 dark:text-red-400"}`}
              >
                {formatCurrency(summaryTotals.netTotal)}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 md:self-start">
          <motion.button
            onClick={onExport}
            disabled={isExporting}
            aria-label={
              isExporting ? "Exporting customer details" : "Export customer details"
            }
            aria-busy={isExporting}
            className={`flex items-center justify-center gap-2 px-4 h-10 text-xs sm:text-sm font-semibold transition-colors bg-gray-100 rounded-lg dark:bg-slate-700 dark:text-dark-text whitespace-nowrap leading-none disabled:opacity-60 disabled:cursor-not-allowed ${isExporting ? "hover:bg-gray-100 dark:hover:bg-slate-700" : "hover:bg-gray-200 dark:hover:bg-slate-600"}`}
            whileHover={{ scale: isExporting ? 1 : 1.05 }}
            whileTap={{ scale: isExporting ? 1 : 0.95 }}
          >
            {isExporting ? (
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            ) : (
              <FileDownIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            )}
            <span className="hidden sm:inline">
              {isExporting ? "Exporting..." : "Export Details"}
            </span>
            <span className="sm:hidden">{isExporting ? "Exporting" : "Export"}</span>
          </motion.button>
          <motion.button
            onClick={onClose}
            aria-label="Close customer details"
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-dark-text flex-shrink-0 transition-colors leading-none"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <XIcon className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </GlassCard>
  );
};

export default CustomerDetailHeader;
