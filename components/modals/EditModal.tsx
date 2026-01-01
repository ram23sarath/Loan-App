import React from "react";
import ReactDOM from "react-dom";
import { motion, Variants } from "framer-motion";
import type {
  Customer,
  LoanWithCustomer,
  SubscriptionWithCustomer,
} from "../../types";

interface EditModalProps {
  type: "customer" | "loan" | "subscription" | "customer_loan" | "installment";
  data: any;
  onSave: (updated: any) => void;
  onClose: () => void;
}

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants: Variants = {
  hidden: { opacity: 0, y: 50, scale: 0.9 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 100 } },
  exit: { opacity: 0, y: 50, scale: 0.9 },
};

const EditModal: React.FC<EditModalProps> = ({
  type,
  data,
  onSave,
  onClose,
}) => {
  const [form, setForm] = React.useState<any>(data);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // For combined customer+loan form
  const handleCombinedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, dataset } = e.target;
    if (dataset.section === "customer") {
      setForm({ ...form, customer: { ...form.customer, [name]: value } });
    } else if (dataset.section === "loan") {
      setForm({ ...form, loan: { ...form.loan, [name]: value } });
    } else if (dataset.section === "subscription") {
      setForm({
        ...form,
        subscription: { ...form.subscription, [name]: value },
      });
    }
  };

  // Handle Escape key to close modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        try {
          e.stopPropagation();
          // stopImmediatePropagation may not exist on all event types in some envs
          if (typeof (e as any).stopImmediatePropagation === 'function') {
            (e as any).stopImmediatePropagation();
          }
        } catch (_) {}
        onClose();
      }
    };
    // Use capture so this listener runs before other bubble-phase listeners
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  return ReactDOM.createPortal(
    <motion.div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      onClick={onClose}
    >
      <motion.div
        className="bg-white dark:bg-slate-800 dark:text-gray-100 rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto relative flex flex-col items-center"
        variants={modalVariants}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-xl text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100"
        >
          ✕
        </button>
        <h2 className="text-lg sm:text-xl font-bold mb-4">
          Edit {type.charAt(0).toUpperCase() + type.slice(1)}
        </h2>
        {type === "customer_loan" && (
          <form
            className="space-y-3 w-full"
            onSubmit={(e) => {
              e.preventDefault();
              onSave(form);
            }}
          >
            {/* Customer Section */}
            <div className="border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900 rounded-lg p-3 shadow-sm">
              <h3 className="text-base font-semibold mb-2 text-center text-blue-700 dark:text-blue-200">
                Customer Details
              </h3>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">Name</label>
                <input
                  name="name"
                  data-section="customer"
                  type="text"
                  value={form.customer?.name || ""}
                  onChange={handleCombinedChange}
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
                />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">Phone</label>
                <input
                  name="phone"
                  data-section="customer"
                  type="tel"
                  value={form.customer?.phone || ""}
                  onChange={handleCombinedChange}
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
                  maxLength={10}
                  pattern="^\d{10}$"
                />
              </div>
            </div>
            {/* Loan Section */}
            <div className="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900 rounded-lg p-3 shadow-sm">
              <h3 className="text-base font-semibold mb-2 text-center text-green-700 dark:text-green-200">
                Loan Details
              </h3>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Original Amount
                </label>
                <input
                  name="original_amount"
                  data-section="loan"
                  type="number"
                  value={form.loan?.original_amount || ""}
                  onChange={handleCombinedChange}
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
                />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                  Interest Amount
                </label>
                <input
                  name="interest_amount"
                  data-section="loan"
                  type="number"
                  value={form.loan?.interest_amount || ""}
                  onChange={handleCombinedChange}
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
                />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                  Check Number
                </label>
                <input
                  name="check_number"
                  data-section="loan"
                  type="text"
                  value={form.loan?.check_number || ""}
                  onChange={handleCombinedChange}
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
                />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">
                  Total Repayable
                </label>
                <input
                  type="number"
                  value={
                    Number(form.loan?.original_amount || 0) +
                    Number(form.loan?.interest_amount || 0)
                  }
                  readOnly
                  className="w-full border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
                />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">
                  Total Installments
                </label>
                <input
                  name="total_instalments"
                  data-section="loan"
                  type="number"
                  value={form.loan?.total_instalments || ""}
                  onChange={handleCombinedChange}
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
                />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">
                  Payment Date
                </label>
                <input
                  name="payment_date"
                  data-section="loan"
                  type="date"
                  value={
                    form.loan?.payment_date
                      ? form.loan.payment_date.slice(0, 10)
                      : ""
                  }
                  onChange={handleCombinedChange}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded px-3 py-2 text-base bg-white dark:bg-slate-700 dark:text-gray-100 block"
                  style={{ minHeight: '42px', WebkitAppearance: 'none' }}
                  min="1980-01-01"
                  max="2050-12-31"
                />
              </div>
            </div>
            {/* Subscription Section */}
            {form.subscription && (
              <div className="border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900 rounded-lg p-3 shadow-sm">
                <h3 className="text-base font-semibold mb-2 text-center text-purple-700 dark:text-purple-200">
                  Subscription Details
                </h3>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Amount
                  </label>
                  <div className="relative">
                    <span
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 select-none font-sans"
                      style={{
                        fontFamily:
                          "Segoe UI Symbol, Arial Unicode MS, sans-serif",
                      }}
                    >
                      &#8377;
                    </span>
                    <input
                      name="amount"
                      data-section="subscription"
                      type="number"
                      value={form.subscription.amount || ""}
                      onChange={handleCombinedChange}
                      className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2 pl-7"
                      style={{ fontFamily: "inherit" }}
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium mb-1 dark:text-gray-200">Date</label>
                  <input
                    name="date"
                    data-section="subscription"
                    type="date"
                    value={
                      form.subscription.date
                        ? form.subscription.date.slice(0, 10)
                        : ""
                    }
                    onChange={handleCombinedChange}
                    className="w-full border border-gray-300 dark:border-gray-700 rounded px-3 py-2 text-base bg-white dark:bg-slate-700 dark:text-gray-100 block"
                    style={{ minHeight: '42px', WebkitAppearance: 'none' }}
                    min="1980-01-01"
                    max="2050-12-31"
                  />
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                    Receipt
                  </label>
                  <input
                    name="receipt"
                    data-section="subscription"
                    type="text"
                    value={form.subscription.receipt || ""}
                    onChange={handleCombinedChange}
                    className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
                  />
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                    Late Fee
                  </label>
                  <input
                    name="late_fee"
                    data-section="subscription"
                    type="number"
                    value={form.subscription.late_fee ?? ""}
                    onChange={handleCombinedChange}
                    className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
                    min="0"
                  />
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700 dark:text-gray-100">Cancel</button>
              <button type="submit" className="px-3 py-2 rounded bg-indigo-600 dark:bg-indigo-500 text-white">Save</button>
            </div>
          </form>
        )}
        {type === "customer" && (
          <form
            className="space-y-3 w-full"
            onSubmit={(e) => {
              e.preventDefault();
              onSave(form);
            }}
          >
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">Name</label>
              <input
                name="name"
                type="text"
                value={form.name || ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">Phone</label>
              <input
                name="phone"
                type="tel"
                value={form.phone || ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
                maxLength={10}
                pattern="^\d{10}$"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700 dark:text-gray-100">Cancel</button>
              <button type="submit" className="px-3 py-2 rounded bg-indigo-600 dark:bg-indigo-500 text-white">Save</button>
            </div>
          </form>
        )}
        {type === "loan" && (
          <form
            className="space-y-3 w-full"
            onSubmit={(e) => {
              e.preventDefault();
              onSave(form);
            }}
          >
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                Original Amount
              </label>
              <input
                name="original_amount"
                type="number"
                value={form.original_amount || ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                Interest Amount
              </label>
              <input
                name="interest_amount"
                type="number"
                value={form.interest_amount || ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                Check Number
              </label>
              <input
                name="check_number"
                type="text"
                value={form.check_number || ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                Total Installments
              </label>
              <input
                name="total_instalments"
                type="number"
                value={form.total_instalments || ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                Payment Date
              </label>
              <input
                name="payment_date"
                type="date"
                value={form.payment_date ? form.payment_date.slice(0, 10) : ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-700 rounded px-3 py-2 text-base bg-white dark:bg-slate-700 dark:text-gray-100 block"
                style={{ minHeight: '42px', WebkitAppearance: 'none' }}
                min="1980-01-01"
                max="2050-12-31"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700 dark:text-gray-100">Cancel</button>
              <button type="submit" className="px-3 py-2 rounded bg-indigo-600 dark:bg-indigo-500 text-white">Save</button>
            </div>
          </form>
        )}
        {type === "subscription" && (
          <form
            className="space-y-3 w-full"
            onSubmit={(e) => {
              e.preventDefault();
              onSave(form);
            }}
          >
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">Amount</label>
              <input
                name="amount"
                type="number"
                value={form.amount || ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">Date</label>
              <input
                name="date"
                type="date"
                value={form.date ? form.date.slice(0, 10) : ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-700 rounded px-3 py-2 text-base bg-white dark:bg-slate-700 dark:text-gray-100 block"
                style={{ minHeight: '42px', WebkitAppearance: 'none' }}
                min="1980-01-01"
                max="2050-12-31"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">Receipt</label>
              <input
                name="receipt"
                type="text"
                value={form.receipt || ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">Late Fee</label>
              <input
                name="late_fee"
                type="number"
                value={form.late_fee ?? ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
                min="0"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700 dark:text-gray-100">Cancel</button>
              <button type="submit" className="px-3 py-2 rounded bg-indigo-600 dark:bg-indigo-500 text-white">Save</button>
            </div>
          </form>
        )}
        {type === "installment" && (
          <form
            className="space-y-3 w-full"
            onSubmit={(e) => {
              e.preventDefault();
              onSave(form);
            }}
          >
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                Installment Number
              </label>
              <input
                name="installment_number"
                type="number"
                value={form.installment_number || ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                Payment Date
              </label>
              <input
                name="date"
                type="date"
                value={form.date ? form.date.slice(0, 10) : ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-700 rounded px-3 py-2 text-base bg-white dark:bg-slate-700 dark:text-gray-100 block"
                style={{ minHeight: '42px', WebkitAppearance: 'none' }}
                min="1980-01-01"
                max="2050-12-31"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                Amount Paid
              </label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 select-none font-sans"
                  style={{
                    fontFamily:
                      "Segoe UI Symbol, Arial Unicode MS, sans-serif",
                  }}
                >
                  &#8377;
                </span>
                <input
                  name="amount"
                  type="number"
                  value={form.amount || ""}
                  onChange={handleChange}
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2 pl-7"
                  style={{ fontFamily: "inherit" }}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                Late Fee
              </label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 select-none font-sans"
                  style={{
                    fontFamily:
                      "Segoe UI Symbol, Arial Unicode MS, sans-serif",
                  }}
                >
                  &#8377;
                </span>
                <input
                  name="late_fee"
                  type="number"
                  value={form.late_fee ?? ""}
                  onChange={handleChange}
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2 pl-7"
                  style={{ fontFamily: "inherit" }}
                  min="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                Receipt Number
              </label>
              <input
                name="receipt_number"
                type="text"
                value={form.receipt_number || ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-slate-700 dark:text-gray-100 rounded px-3 py-2"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700 dark:text-gray-100">Cancel</button>
              <button type="submit" className="px-3 py-2 rounded bg-indigo-600 dark:bg-indigo-500 text-white">Save</button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>,
    // Attach modal to the documentElement instead of `body` so it's
    // positioned relative to the viewport even when `body` is made
    // `position: fixed` by other modals (prevents centering relative
    // to the page content).
    document.documentElement
  );
};

export default EditModal;
