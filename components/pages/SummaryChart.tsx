import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface SummaryChartProps {
  interest: number;
  lateFee: number;
  subscription: number;
  total: number;
  loansGiven: number;
}

const SummaryChart: React.FC<SummaryChartProps> = ({ interest, lateFee, subscription, total, loansGiven }) => {
  const data = {
    labels: ['Interest', 'Late Fee', 'Subscription', 'Total Collected', 'Loans Given'],
    datasets: [
      {
        label: 'Amount (₹)',
        data: [interest, lateFee, subscription, total, loansGiven],
        backgroundColor: [
          'rgba(16, 185, 129, 0.7)', // green
          'rgba(251, 146, 60, 0.7)', // orange
          'rgba(6, 182, 212, 0.7)',  // cyan
          'rgba(99, 102, 241, 0.7)', // indigo
          'rgba(59, 130, 246, 0.7)', // blue
        ],
        borderRadius: 8,
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: { callbacks: { label: (ctx: any) => `₹${ctx.parsed.y.toLocaleString()}` } },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (v: number) => `₹${v.toLocaleString()}` },
        grid: { color: 'rgba(99,102,241,0.08)' },
      },
      x: {
        grid: { display: false },
      },
    },
  };

  return (
    <div className="w-full h-64">
      <Bar data={data} options={options} />
    </div>
  );
};

export default SummaryChart;
