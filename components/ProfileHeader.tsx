import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { motion, AnimatePresence } from 'framer-motion';
import ChangePasswordModal from './modals/ChangePasswordModal';

const ProfileHeader = () => {
  const { session, signOut, isScopedCustomer } = useData();
  const [showMenu, setShowMenu] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  if (!session || !session.user) return null;

  const userEmail = session.user.email || 'User';
  const initials = userEmail.substring(0, 2).toUpperCase();

  const handleViewProfile = () => {
    setShowMenu(false);
    // Navigate to profile page or show profile modal
    // For now, we'll just show a simple view of user info
    alert(`Profile: ${userEmail}\nAccount Type: ${isScopedCustomer ? 'Customer' : 'Admin'}`);
  };

  const handleChangePassword = () => {
    setShowChangePasswordModal(true);
    setShowMenu(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setShowMenu(false);
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <motion.button
        onClick={() => setShowMenu(!showMenu)}
        className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center justify-center shadow-lg transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title={userEmail}
      >
        {initials}
      </motion.button>

      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-14 right-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-56"
          >
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs text-gray-500">Logged in as</p>
              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-sm font-semibold text-gray-800 truncate">{userEmail}</p>
                {isScopedCustomer && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full whitespace-nowrap">
                    Customer
                  </span>
                )}
              </div>
            </div>
            
            <div className="py-1">
              <button
                onClick={handleViewProfile}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
              >
                👤 View Profile
              </button>
              <button
                onClick={handleChangePassword}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
              >
                🔑 Change Password
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors font-medium flex items-center gap-2"
              >
                🚪 Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <ChangePasswordModal onClose={() => setShowChangePasswordModal(false)} />
      )}
    </div>
  );
};

export default ProfileHeader;
