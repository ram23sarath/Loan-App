
import React from 'react';
import { NavLink } from 'react-router-dom';
import { FilePlusIcon, HistoryIcon, LandmarkIcon, UserPlusIcon, UsersIcon, LogOutIcon, BookOpenIcon } from '../constants';
// Database icon for Data section
const DatabaseIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v6c0 1.657 3.582 3 8 3s8-1.343 8-3V6" />
    <path d="M4 12v6c0 1.657 3.582 3 8 3s8-1.343 8-3v-6" />
  </svg>
);
// Hamburger removed — using bottom nav for mobile
import { useData } from '../context/DataContext';

const navItems = [
  { path: '/', label: 'Add Customer', icon: UserPlusIcon },
  { path: '/add-record', label: 'Add Record', icon: FilePlusIcon },
  { path: '/customers', label: 'Customers', icon: UsersIcon },
  { path: '/loans', label: 'Loans', icon: LandmarkIcon },
  { path: '/subscriptions', label: 'Subscriptions', icon: HistoryIcon },
  { path: '/data', label: 'Misc', icon: DatabaseIcon },
  { path: '/summary', label: 'Summary', icon: BookOpenIcon },
];

const Sidebar = () => {
  const { session, signOut, loans = [], installments = [], subscriptions = [] } = useData();

  // --- Summary Calculations (same as SubscriptionListPage) ---
  const totalInterestCollected = loans.reduce((acc, loan) => {
    const loanInstallments = installments.filter(i => i.loan_id === loan.id);
    const totalPaidForLoan = loanInstallments.reduce((sum, inst) => sum + inst.amount, 0);
    if (totalPaidForLoan > loan.original_amount) {
      const interestCollected = Math.min(totalPaidForLoan - loan.original_amount, loan.interest_amount);
      return acc + interestCollected;
    }
    return acc;
  }, 0);
  const totalLateFeeCollected = installments.reduce((acc, inst) => acc + (inst.late_fee || 0), 0);
  const totalSubscriptionCollected = subscriptions.reduce((acc, sub) => acc + (sub.amount || 0), 0);
  const totalAllCollected = totalInterestCollected + totalLateFeeCollected + totalSubscriptionCollected;
  const totalLoansGiven = loans.reduce((acc, loan) => acc + loan.original_amount + loan.interest_amount, 0);
  const activeLinkClass = 'bg-indigo-50 text-indigo-600 font-semibold';
  const inactiveLinkClass = 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Responsive sidebar and bottom nav
  return (
    <>
      {/* Bottom nav for mobile: only icons */}
  <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex justify-around items-center py-2 sm:hidden">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center px-2 ${isActive ? 'text-indigo-600' : 'text-gray-500'}`
            }
            aria-label={item.label}
          >
            <item.icon className="w-6 h-6" />
          </NavLink>
        ))}
      </nav>

      {/* Desktop sidebar (hidden on small screens) */}
      <aside className={`w-64 h-screen p-4 flex-shrink-0 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:block hidden`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Loan Management</h1>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto min-h-0">
            {navItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center p-3 rounded-lg transition-colors duration-200 ${isActive ? activeLinkClass : inactiveLinkClass}`
                }
              >
                <item.icon className="w-6 h-6 mr-3" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="shrink-0">
            <div className="p-4 border-t border-gray-200 space-y-4">
              {session?.user && (
                <div className="text-center">
                  <p className="text-xs text-gray-500 truncate" title={session.user.email}>Logged in as:</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">{session.user.email}</p>
                </div>
              )}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center p-3 rounded-lg transition-colors duration-200 text-red-600 bg-red-50 hover:bg-red-100 font-semibold"
              >
                <LogOutIcon className="w-5 h-5 mr-2" />
                <span>Logout</span>
              </button>
            </div>
            <div className="p-4 border-t border-gray-200 text-center text-xs text-gray-400">
              <p>&copy; {new Date().getFullYear()} Sleek Solutions</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;