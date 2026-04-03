import React from "react";
import { motion } from "framer-motion";
import GlassCard from "../../../ui/GlassCard";

interface CustomerDetailMobileActionsProps {
  onRecordLoan: () => void;
  onRecordSubscription: () => void;
  onRecordDataEntry: () => void;
}

const CustomerDetailMobileActions: React.FC<CustomerDetailMobileActionsProps> = ({
  onRecordLoan,
  onRecordSubscription,
  onRecordDataEntry,
}) => {
  return (
    <div className="md:hidden absolute inset-x-2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40">
      <p id="mobile-touch-guidance" className="sr-only">
        Mobile actions use minimum 48 by 48 pixel touch targets per Material
        Design and WCAG 2.5.5 Target Size guidance.
      </p>
      <GlassCard
        className="!p-2 shadow-2xl dark:bg-dark-card dark:border-dark-border"
        disable3D
      >
        <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Quick actions
        </div>
        <div className="grid grid-cols-3 gap-2">
          <motion.button
            onClick={onRecordLoan}
            aria-label="Record loan"
            aria-describedby="mobile-touch-guidance"
            className="min-h-12 rounded-lg bg-indigo-600 px-2 py-2 text-[10px] font-semibold leading-tight text-white"
            whileTap={{ scale: 0.98 }}
          >
            Record Loan
          </motion.button>
          <motion.button
            onClick={onRecordSubscription}
            aria-label="Record subscription"
            aria-describedby="mobile-touch-guidance"
            className="min-h-12 rounded-lg bg-cyan-600 px-2 py-2 text-[10px] font-semibold leading-tight text-white"
            whileTap={{ scale: 0.98 }}
          >
            Record Sub
          </motion.button>
          <motion.button
            onClick={onRecordDataEntry}
            aria-label="Record data entry"
            aria-describedby="mobile-touch-guidance"
            className="min-h-12 rounded-lg bg-pink-600 px-2 py-2 text-[10px] font-semibold leading-tight text-white"
            whileTap={{ scale: 0.98 }}
          >
            Record Entry
          </motion.button>
        </div>
      </GlassCard>
    </div>
  );
};

export default CustomerDetailMobileActions;
