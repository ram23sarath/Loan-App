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

import { useTheme } from '../../context/ThemeContext';

interface SummaryChartProps {
  interest: number;
  lateFee: number;
  subscription: number;
  total: number;
  loansGiven: number;
}

const SummaryChart: React.FC<SummaryChartProps> = ({ interest, lateFee, subscription, total, loansGiven }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const data = {
    labels: ['Interest', 'Late Fee', 'Subscription Return', 'Total Collected', 'Loans Given'],
    datasets: [
      {
        label: 'Amount (₹)',
        data: [interest, lateFee, subscription, total, loansGiven],
        backgroundColor: isDark ? [
          '#34d399', // emerald 400 - full opacity
          '#fb923c', // orange 400
          '#22d3ee', // cyan 400
          '#818cf8', // indigo 400
          '#60a5fa', // blue 400
        ] : [
          'rgba(16, 185, 129, 0.7)', // green
          'rgba(251, 146, 60, 0.7)', // orange
          'rgba(6, 182, 212, 0.7)',  // cyan
          'rgba(99, 102, 241, 0.7)', // indigo
          'rgba(59, 130, 246, 0.7)', // blue
        ],
        borderRadius: 8,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'transparent',
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        callbacks: { label: (ctx: any) => `₹${ctx.parsed.y.toLocaleString()}` },
        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDark ? '#e2e8f0' : '#1e293b',
        bodyColor: isDark ? '#e2e8f0' : '#1e293b',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (v: number) => `₹${v.toLocaleString()}`,
          color: isDark ? '#e2e8f0' : '#64748b',
        },
        grid: { color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(99,102,241,0.08)' },
        border: { display: false },
      },
      x: {
        grid: { display: false },
        ticks: {
          color: isDark ? '#e2e8f0' : '#64748b',
        }
      },
    },
  };

  return (
    <div className={`w-full h-64 p-4 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-white'}`}>
      <Bar data={data} options={options} />
    </div>
  );
};

export default SummaryChart;
