import React from 'react';
import { useData } from '../../context/DataContext';
import { useNavigate } from 'react-router-dom';

type Props = {
  customerId: string;
  customerName?: string;
  open: boolean;
  onClose: () => void;
  defaultStation?: string;
  defaultLoanType?: string;
  defaultDate?: string;
};

const RequestSeniorityModal = ({ customerId, customerName, open, onClose, defaultStation = '', defaultLoanType = 'General', defaultDate = '' }: Props) => {
  const { addToSeniority } = useData();
  const navigate = useNavigate();
  const [stationName, setStationName] = React.useState(defaultStation);
  const [loanType, setLoanType] = React.useState(defaultLoanType);
  const [loanRequestDate, setLoanRequestDate] = React.useState(defaultDate);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setStationName(defaultStation);
    setLoanType(defaultLoanType);
    setLoanRequestDate(defaultDate);
  }, [defaultStation, defaultLoanType, defaultDate, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Request Loan / Subscription</h3>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Station Name</label>
            <input value={stationName} onChange={(e) => setStationName(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Loan Type</label>
            <select value={loanType} onChange={(e) => setLoanType(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2">
              <option value="General">General</option>
              <option value="Medical">Medical</option>
              <option value="Emergency">Emergency</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Requested Date</label>
            <input value={loanRequestDate} onChange={(e) => setLoanRequestDate(e.target.value)} type="date" className="w-full border border-gray-300 rounded px-3 py-2" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded bg-gray-200">Cancel</button>
          <button
            onClick={async () => {
              setIsSaving(true);
              try {
                await addToSeniority(customerId, {
                  station_name: stationName || null,
                  loan_type: loanType || null,
                  loan_request_date: loanRequestDate || null,
                });
                onClose();
                navigate('/loan-seniority');
              } catch (err: any) {
                alert(err?.message || 'Failed to create request');
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
            className="px-3 py-2 rounded bg-yellow-600 text-white disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestSeniorityModal;
