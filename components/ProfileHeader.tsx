import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { motion, AnimatePresence } from 'framer-motion';
import ChangePasswordModal from './modals/ChangePasswordModal';

const ProfileHeader = () => {
  const { session, signOut, isScopedCustomer, customers, scopedCustomerId, updateCustomer } = useData();
  const [showMenu, setShowMenu] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [isEditingStation, setIsEditingStation] = useState(false);
  const [stationName, setStationName] = useState('');
  const [isSavingStation, setIsSavingStation] = useState(false);

  if (!session || !session.user) return null;

  const userEmail = session.user.email || 'User';
  const initials = userEmail.substring(0, 2).toUpperCase();

  // Get customer details if scoped user
  const customerDetails = isScopedCustomer && scopedCustomerId 
    ? customers.find(c => c.id === scopedCustomerId)
    : null;

  // Initialize station name when profile panel opens
  React.useEffect(() => {
    if (showProfilePanel && customerDetails?.station_name) {
      setStationName(customerDetails.station_name);
    } else {
      setStationName('');
    }
  }, [showProfilePanel, customerDetails]);

  const handleViewProfile = () => {
    setShowMenu(false);
    setShowProfilePanel(true);
  };

  const handleChangePassword = () => {
    setShowChangePasswordModal(true);
    setShowMenu(false);
  };

  const handleSaveStation = async () => {
    if (!isScopedCustomer || !scopedCustomerId || !customerDetails) return;
    
    try {
      setIsSavingStation(true);
      await updateCustomer(scopedCustomerId, { station_name: stationName });
      setIsEditingStation(false);
    } catch (error) {
      console.error('Failed to update station name:', error);
    } finally {
      setIsSavingStation(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setShowMenu(false);
  };

  return (
    <div className="fixed top-2 right-2 md:top-4 md:right-4 z-[100]">
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
            className="absolute top-14 right-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-48 md:min-w-56 z-[101]"
          >
            <div className="px-3 md:px-4 py-2 md:py-3 border-b border-gray-100">
              <p className="text-xs text-gray-500">Logged in as</p>
              <div className="flex items-center justify-between gap-1 md:gap-2 mt-1">
                <p className="text-xs md:text-sm font-semibold text-gray-800 truncate">{userEmail}</p>
                {isScopedCustomer && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full whitespace-nowrap">
                    Customer
                  </span>
                )}
                {!isScopedCustomer && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full whitespace-nowrap">
                    Admin
                  </span>
                )}
              </div>
            </div>
            
            <div className="py-1">
              <button
                onClick={handleViewProfile}
                className="w-full px-3 md:px-4 py-2 text-left text-xs md:text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
              >
                👤 View Profile
              </button>
              <button
                onClick={handleChangePassword}
                className="w-full px-3 md:px-4 py-2 text-left text-xs md:text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
              >
                🔑 Change Password
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={handleSignOut}
                className="w-full px-3 md:px-4 py-2 text-left text-xs md:text-sm text-red-600 hover:bg-red-50 transition-colors font-medium flex items-center gap-2"
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

      {/* Profile Panel */}
      <AnimatePresence>
        {showProfilePanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-[99] flex items-center justify-center p-3 md:p-4"
            onClick={() => setShowProfilePanel(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-lg shadow-xl p-4 md:p-6 w-full max-w-sm md:max-w-md max-h-[90vh] overflow-y-auto z-[100]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg md:text-2xl font-bold text-gray-800">Profile</h2>
                <button
                  onClick={() => setShowProfilePanel(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl md:text-2xl transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 md:space-y-4">
                {/* Account Type */}
                <div className="border-b border-gray-200 pb-3 md:pb-4">
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Account Type</label>
                  <p className="text-xs md:text-sm font-semibold text-gray-800 mt-1">
                    {isScopedCustomer ? 'Customer' : 'Admin'}
                  </p>
                </div>

                {/* Email */}
                <div className="border-b border-gray-200 pb-3 md:pb-4">
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Email</label>
                  <p className="text-xs md:text-sm font-semibold text-gray-800 mt-1 break-all">{userEmail}</p>
                </div>

                {/* Customer Details (if scoped user) */}
                {isScopedCustomer && customerDetails ? (
                  <>
                    <div className="border-b border-gray-200 pb-3 md:pb-4">
                      <label className="text-xs text-gray-500 uppercase tracking-wide">Customer Name</label>
                      <p className="text-xs md:text-sm font-semibold text-gray-800 mt-1">{customerDetails.name || '—'}</p>
                    </div>

                    <div className="border-b border-gray-200 pb-3 md:pb-4">
                      <label className="text-xs text-gray-500 uppercase tracking-wide">Phone Number</label>
                      <p className="text-xs md:text-sm font-semibold text-gray-800 mt-1">{customerDetails.phone || '—'}</p>
                    </div>

                    {customerDetails.address && (
                      <div className="border-b border-gray-200 pb-3 md:pb-4">
                        <label className="text-xs text-gray-500 uppercase tracking-wide">Address</label>
                        <p className="text-xs md:text-sm font-semibold text-gray-800 mt-1 break-words">{customerDetails.address}</p>
                      </div>
                    )}

                    {/* Station Name - Editable */}
                    <div className="border-b border-gray-200 pb-3 md:pb-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <label className="text-xs text-gray-500 uppercase tracking-wide">Station Name</label>
                        <button
                          onClick={() => setIsEditingStation(!isEditingStation)}
                          className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                        >
                          {isEditingStation ? 'Cancel' : 'Edit'}
                        </button>
                      </div>
                      {isEditingStation ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={stationName}
                            onChange={(e) => setStationName(e.target.value)}
                            placeholder="Enter station name"
                            className="w-full bg-gray-50 border border-gray-300 rounded px-3 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            onClick={handleSaveStation}
                            disabled={isSavingStation}
                            className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs md:text-sm font-medium rounded transition-colors"
                          >
                            {isSavingStation ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs md:text-sm font-semibold text-gray-800 mt-1">{stationName || '—'}</p>
                      )}
                    </div>
                  </>
                ) : isScopedCustomer ? (
                  <div className="text-center py-4">
                    <p className="text-xs md:text-sm text-gray-500">Customer details not found</p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs md:text-sm text-gray-500">Admin accounts do not have customer details</p>
                  </div>
                )}
              </div>

              <div className="mt-4 md:mt-6 flex gap-2">
                <button
                  onClick={() => setShowProfilePanel(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm md:text-base font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfileHeader;
