import React from "react";
import { AnimatePresence, motion } from "framer-motion";

interface CustomerDetailBannersProps {
  deleteError: string | null;
  exportError: string | null;
  exportSuccess: string | null;
  onClearDeleteError: () => void;
  onClearExportError: () => void;
  onClearExportSuccess: () => void;
}

const CustomerDetailBanners: React.FC<CustomerDetailBannersProps> = ({
  deleteError,
  exportError,
  exportSuccess,
  onClearDeleteError,
  onClearExportError,
  onClearExportSuccess,
}) => {
  const ERROR_BANNER_PROPS = {
    containerClass:
      "max-w-sm p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg shadow-lg",
    iconClass: "flex-shrink-0 text-red-600 dark:text-red-400",
    titleClass: "text-sm font-medium text-red-800 dark:text-red-200",
    messageClass: "text-sm text-red-700 dark:text-red-300 mt-1",
    closeClass:
      "flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300",
    closeLabel: "Close error banner",
    iconPath:
      "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z",
  } as const;

  const bannerItems = [
    {
      key: "delete-error",
      message: deleteError,
      title: "Error deleting record",
      onClose: onClearDeleteError,
      ...ERROR_BANNER_PROPS,
    },
    {
      key: "export-error",
      message: exportError,
      title: "Export failed",
      onClose: onClearExportError,
      ...ERROR_BANNER_PROPS,
    },
    {
      key: "export-success",
      message: exportSuccess,
      title: "Export successful",
      containerClass:
        "max-w-sm p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg shadow-lg",
      iconClass: "flex-shrink-0 text-green-600 dark:text-green-400",
      titleClass: "text-sm font-medium text-green-800 dark:text-green-200",
      messageClass: "text-sm text-green-700 dark:text-green-300 mt-1",
      closeClass:
        "flex-shrink-0 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300",
      closeLabel: "Close success banner",
      onClose: onClearExportSuccess,
      iconPath:
        "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
    },
  ] as const;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
      <AnimatePresence>
        {bannerItems
          .filter((banner) => !!banner.message)
          .map((banner) => (
          <motion.div
            key={banner.key}
            role="alert"
            className={banner.containerClass}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="flex items-start gap-3">
              <div className={banner.iconClass}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d={banner.iconPath}
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className={banner.titleClass}>{banner.title}</p>
                <p className={banner.messageClass}>{banner.message}</p>
              </div>
              <motion.button
                onClick={banner.onClose}
                aria-label={banner.closeLabel}
                className={banner.closeClass}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </motion.button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default CustomerDetailBanners;
