import React from 'react';
import { useData } from '../../context/DataContext';
import GlassCard from '../ui/GlassCard';
import { formatDate } from '../../utils/dateFormatter';
import { WhatsAppIcon } from '../../constants';

const SubscriptionTableView: React.FC = () => {
  const { subscriptions } = useData();
  const [filter, setFilter] = React.useState('');

  const filteredSubscriptions = subscriptions.filter(sub => {
    const customerName = sub.customers?.name?.toLowerCase() || '';
    const receipt = (sub.receipt || '').toLowerCase();
    return (
      customerName.includes(filter.toLowerCase()) ||
      receipt.includes(filter.toLowerCase())
    );
  });

  if (subscriptions.length === 0) {
    return (
      <GlassCard>
        <p className="text-center text-gray-500">No subscriptions recorded yet.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="overflow-x-auto">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
        <input
          type="text"
          placeholder="Filter by customer or receipt..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full sm:w-64"
        />
      </div>
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-4 py-2 border-b text-left">Customer</th>
            <th className="px-4 py-2 border-b text-left">Amount</th>
            <th className="px-4 py-2 border-b text-left">Year</th>
            <th className="px-4 py-2 border-b text-left">Date</th>
            <th className="px-4 py-2 border-b text-left">Receipt</th>
            <th className="px-4 py-2 border-b text-left">Send</th>
          </tr>
        </thead>
        <tbody>
          {filteredSubscriptions.map(sub => {
            const customer = sub.customers;
            let message = '';
            let whatsappUrl = '#';
            let isValidPhone = false;
            if (customer && customer.phone && /^\d{10,15}$/.test(customer.phone)) {
              isValidPhone = true;
              message = `Hi ${customer.name}, your subscription payment of ₹${sub.amount} for the year ${sub.year} was received on ${formatDate(sub.date, 'whatsapp')}. Receipt: ${sub.receipt || '-'} Thank you.`;
              whatsappUrl = `https://wa.me/${customer.phone}?text=${encodeURIComponent(message)}`;
            }
            return (
              <tr key={sub.id} className="even:bg-gray-50">
                <td className="px-4 py-2 border-b">{customer?.name ?? 'Unknown'}</td>
                <td className="px-4 py-2 border-b">₹{sub.amount.toLocaleString()}</td>
                <td className="px-4 py-2 border-b">{sub.year}</td>
                <td className="px-4 py-2 border-b">{sub.date ? formatDate(sub.date) : '-'}</td>
                <td className="px-4 py-2 border-b">{sub.receipt || '-'}</td>
                <td className="px-4 py-2 border-b">
                  <button
                    onClick={() => isValidPhone && window.open(whatsappUrl, '_blank')}
                    className="p-1 rounded-full hover:bg-green-500/10 transition-colors"
                    aria-label={`Send subscription for ${customer?.name} on WhatsApp`}
                    disabled={!isValidPhone}
                  >
                    <WhatsAppIcon className="w-5 h-5 text-green-500" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </GlassCard>
  );
};

export default SubscriptionTableView;
