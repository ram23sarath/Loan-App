import React from "react";
import { XIcon } from "../../constants";
import { formatCurrencyIN } from "../../utils/numberFormatter";
import { formatDate } from "../../utils/dateFormatter";

type Item = {
  id?: string;
  date?: string;
  amount: number;
  receipt?: string;
  notes?: string;
  source?: string;
  extra?: Record<string, any>;
};

interface SummaryLine {
  label: string;
  value: number;
}

interface Props {
  open: boolean;
  title: string;
  items: Item[];
  onClose: () => void;
  summary?: SummaryLine[];
}

const FYBreakdownModal: React.FC<Props> = ({
  open,
  title,
  items,
  onClose,
  summary = [],
}) => {
  if (!open) return null;

  const hasSource = items.some((it) => !!it.source);
  const hasRemaining = items.some((it) => (it as any).remaining !== undefined);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto dark:text-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <XIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {items.length === 0 && summary.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            No records for this category in the selected financial year.
          </p>
        ) : (
          <div className="space-y-2">
            {summary.length > 0 && (
              <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded">
                {summary.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="text-gray-700 dark:text-gray-300">{s.label}</div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrencyIN(s.value)}
                    </div>
                  </div>
                ))}
                <div className="mt-2 border-t pt-2" />
              </div>
            )}
            <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700 p-2 rounded">
              <div className="col-span-3">Date</div>
              <div className="col-span-3">Customer</div>
              {hasSource && <div className="col-span-2">Source</div>}
              {hasRemaining && (
                <div className="col-span-2 text-right">Remaining</div>
              )}
              <div
                className={`${hasSource || hasRemaining ? "col-span-2" : "col-span-4"
                  } text-right`}
              >
                Amount
              </div>
              <div
                className={`${hasSource || hasRemaining ? "col-span-2" : "col-span-2"
                  }`}
              >
                Notes / Receipt
              </div>
            </div>
            {items.map((it, idx) => (
              <div
                key={it.id || idx}
                className="grid grid-cols-12 gap-4 px-2 py-3 items-start border-b dark:border-gray-700 last:border-b-0"
              >
                <div className="col-span-3 text-sm text-gray-700 dark:text-gray-300">
                  {it.date ? formatDate(it.date) : "-"}
                </div>
                <div className="col-span-3 text-sm text-gray-700 dark:text-gray-300">
                  {(it as any).customer || "-"}
                </div>
                {hasSource && (
                  <div className="col-span-2 text-sm text-gray-700 dark:text-gray-300">
                    {it.source || "-"}
                  </div>
                )}
                {hasRemaining && (
                  <div className="col-span-2 text-sm text-right text-gray-700">
                    {formatCurrencyIN((it as any).remaining ?? 0)}
                  </div>
                )}
                <div
                  className={`${hasSource || hasRemaining ? "col-span-2" : "col-span-4"
                    } text-sm font-medium text-right text-gray-800 dark:text-gray-200`}
                >
                  {formatCurrencyIN(it.amount)}
                </div>
                <div
                  className={`${hasSource || hasRemaining ? "col-span-2" : "col-span-2"
                    } text-sm text-gray-600 dark:text-gray-400`}
                >
                  {it.receipt || it.notes || "-"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FYBreakdownModal;
