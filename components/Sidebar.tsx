
import React from 'react';
import { NavLink } from 'react-router-dom';
import { FilePlusIcon, HistoryIcon, LandmarkIcon, UserPlusIcon, UsersIcon, LogOutIcon } from '../constants';
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
  const activeLinkClass = 'bg-indigo-50 text-indigo-600 font-semibold';
  const inactiveLinkClass = 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <aside className="w-64 h-screen p-4 flex-shrink-0">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm h-full flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-center text-gray-800">Loan Management</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
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
    </aside>
  );
};

export default Sidebar;