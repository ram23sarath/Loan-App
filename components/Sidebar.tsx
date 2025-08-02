
import React from 'react';
import { NavLink } from 'react-router-dom';
import { FilePlusIcon, HistoryIcon, LandmarkIcon, UserPlusIcon, UsersIcon, LogOutIcon } from '../constants';
import HamburgerIcon from './ui/HamburgerIcon';
import { useData } from '../context/DataContext';

const navItems = [
  { path: '/', label: 'Add Customer', icon: UserPlusIcon },
  { path: '/add-record', label: 'Add Record', icon: FilePlusIcon },
  { path: '/customers', label: 'Customers', icon: UsersIcon },
  { path: '/loans', label: 'Loans', icon: LandmarkIcon },
  { path: '/subscriptions', label: 'Subscriptions', icon: HistoryIcon },
];

const Sidebar = () => {
  const { session, signOut } = useData();
  const [open, setOpen] = React.useState(false);
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
      {/* Hamburger for mobile */}
      <button
        className="fixed top-4 left-4 z-40 bg-white rounded-full shadow-lg p-2 sm:hidden border border-gray-200"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <HamburgerIcon className="w-7 h-7 text-gray-700" />
      </button>

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

      {/* Overlay drawer for mobile (full menu) */}
      <div
        className={`fixed inset-0 z-50 transition-all duration-300 sm:static sm:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'} sm:relative sm:w-64`}
        style={{ pointerEvents: open ? 'auto' : 'none' }}
      >
        {/* Backdrop for mobile */}
        {open && (
          <div className="fixed inset-0 bg-black bg-opacity-30 z-40" onClick={() => setOpen(false)} />
        )}
        <aside className={`w-64 h-screen p-4 flex-shrink-0 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col z-50 relative ${open ? '' : 'sm:block hidden'}`}
          style={{ pointerEvents: 'auto' }}
        >
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">Loan Management</h1>
            {/* Close button for mobile */}
            <button className="sm:hidden p-1 ml-2" onClick={() => setOpen(false)} aria-label="Close menu">
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center p-3 rounded-lg transition-colors duration-200 ${isActive ? activeLinkClass : inactiveLinkClass}`
                }
                onClick={() => setOpen(false)}
              >
                <item.icon className="w-6 h-6 mr-3" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
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
        </aside>
      </div>
    </>
  );
};

export default Sidebar;