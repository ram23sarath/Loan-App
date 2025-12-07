import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../src/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';
import ChangePasswordModal from './modals/ChangePasswordModal';

export interface ProfileHeaderHandle {
  openMenu: () => void;
}

const ProfileHeader = forwardRef<ProfileHeaderHandle>((props, ref) => {
  const { session, signOut, isScopedCustomer, customers, customerMap, scopedCustomerId, updateCustomer } = useData();
  const [showMenu, setShowMenu] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [isEditingStation, setIsEditingStation] = useState(false);
  const [stationName, setStationName] = useState('');
  const [isSavingStation, setIsSavingStation] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Tools modal state
  const [toolsView, setToolsView] = useState<'menu' | 'createUser' | 'changeUserPassword'>('menu');
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsMessage, setToolsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [createUserEmail, setCreateUserEmail] = useState('');
  const [createUserPassword, setCreateUserPassword] = useState('');
  const [createUserName, setCreateUserName] = useState('');
  const [createUserPhone, setCreateUserPhone] = useState('');
  const [createUserIsAdmin, setCreateUserIsAdmin] = useState(false);
  const [changePasswordEmail, setChangePasswordEmail] = useState('');
  const [changePasswordNew, setChangePasswordNew] = useState('');

  // Admin name editing state
  const [isEditingAdminName, setIsEditingAdminName] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [isSavingAdminName, setIsSavingAdminName] = useState(false);

  // Expose openMenu method to parent via ref (must be before early return)
  useImperativeHandle(ref, () => ({
    openMenu: () => setShowMenu(true),
  }));

  if (!session || !session.user) return null;

  const userEmail = session.user.email || 'User';
  // Get admin name from user metadata
  const adminNameFromMeta = session.user.user_metadata?.name || '';
  
  // Get customer details if scoped user
  const customerDetails = isScopedCustomer && scopedCustomerId
    ? customerMap.get(scopedCustomerId)
    : null;

  // Prefer the customer's name for display when scoped; use metadata name for admins; fall back to email
  const displayName = isScopedCustomer && customerDetails?.name 
    ? customerDetails.name 
    : (adminNameFromMeta || userEmail);
  const initials = (displayName && displayName.trim().charAt(0).toUpperCase()) || 'U';

  // Initialize station name when profile panel opens
  React.useEffect(() => {
    if (showProfilePanel && customerDetails?.station_name) {
      setStationName(customerDetails.station_name);
    } else {
      setStationName('');
    }
  }, [showProfilePanel, customerDetails]);

  // Initialize admin name when profile panel opens
  React.useEffect(() => {
    if (showProfilePanel && !isScopedCustomer) {
      setAdminName(adminNameFromMeta);
    }
  }, [showProfilePanel, isScopedCustomer, adminNameFromMeta]);

  // Close menu when clicking outside - DISABLED: Now using backdrop in portal
  // React.useEffect(() => {
  //   const handleClickOutside = (event: MouseEvent) => {
  //     if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
  //       setShowMenu(false);
  //     }
  //   };

  //   if (showMenu) {
  //     document.addEventListener('mousedown', handleClickOutside);
  //   }

  //   return () => {
  //     document.removeEventListener('mousedown', handleClickOutside);
  //   };
  // }, [showMenu]);

  const handleViewProfile = () => {
    console.log('handleViewProfile clicked');
    setShowMenu(false);
    setShowProfilePanel(true);
  };

  const handleChangePassword = () => {
    console.log('handleChangePassword clicked');
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

  const handleSaveAdminName = async () => {
    if (isScopedCustomer) return;

    try {
      setIsSavingAdminName(true);
      const { error } = await supabase.auth.updateUser({
        data: { name: adminName }
      });
      if (error) throw error;
      setIsEditingAdminName(false);
    } catch (error) {
      console.error('Failed to update admin name:', error);
    } finally {
      setIsSavingAdminName(false);
    }
  };

  const handleSignOut = () => {
    console.log('handleSignOut clicked');
    // Open confirmation dialog instead of signing out immediately
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Logout failed', err);
    } finally {
      setShowLogoutConfirm(false);
      setShowMenu(false);
      setShowProfilePanel(false);
    }
  };


  return (
    <>
      <div className="fixed top-2 right-6 md:top-4 md:right-6 z-[100] hidden sm:block landscape:block" ref={menuRef}>
        <motion.button
          onClick={() => setShowMenu(!showMenu)}
          className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center justify-center shadow-lg transition-colors text-lg md:text-xl"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title={displayName}
        >
          {initials}
        </motion.button>
      </div>

      {/* Profile Menu Dropdown (rendered as portal to show on mobile) */}
      {showMenu && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div
          className="fixed inset-0 z-[110] bg-black/20 flex items-center justify-center"
          onClick={() => setShowMenu(false)}
        >
          {/* Menu positioned based on screen size */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute z-[120] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden left-4 right-4 bottom-20 w-auto sm:w-56 sm:left-auto sm:right-6 sm:top-16 sm:bottom-auto landscape:w-56 landscape:left-auto landscape:right-6 landscape:top-16 landscape:bottom-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 md:px-4 py-2 md:py-3 border-b border-gray-100">
              <p className="text-xs text-gray-500">Logged in as</p>
              <div className="flex items-center justify-between gap-1 md:gap-2 mt-1">
                <p className="text-xs md:text-sm font-semibold text-gray-800 truncate">
                  {isScopedCustomer && customerDetails ? customerDetails.name : userEmail}
                </p>
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
                className="w-full px-3 md:px-4 py-1.5 md:py-2 text-left text-xs md:text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium flex items-center gap-2"
              >
                👤 View Profile
              </button>
              {/* Tools - Admin Only */}
              {!isScopedCustomer && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setToolsView('menu');
                    setToolsMessage(null);
                    setShowToolsModal(true);
                  }}
                  className="w-full px-3 md:px-4 py-1.5 md:py-2 text-left text-xs md:text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium flex items-center gap-2"
                >
                  🛠️ Tools
                </button>
              )}
              <button
                onClick={handleChangePassword}
                className="w-full px-3 md:px-4 py-1.5 md:py-2 text-left text-xs md:text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium flex items-center gap-2"
              >
                🔑 Change Password
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={handleSignOut}
                className="w-full px-3 md:px-4 py-1.5 md:py-2 text-left text-xs md:text-sm text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors font-medium flex items-center gap-2"
              >
                🚪 Sign Out
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )
      }

      {/* Change Password Modal */}
      <AnimatePresence>
        {
          showChangePasswordModal && (
            <ChangePasswordModal onClose={() => setShowChangePasswordModal(false)} />
          )
        }
      </AnimatePresence>

      {/* Tools Modal - Admin Only (rendered via portal for proper centering) */}
      {showToolsModal && typeof document !== 'undefined' && ReactDOM.createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4"
            onClick={() => setShowToolsModal(false)}
            onMouseDown={() => setShowToolsModal(false)}
            onTouchStart={() => setShowToolsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl p-4 md:p-6 w-[92%] max-w-md max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Tools Menu */}
              {toolsView === 'menu' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base md:text-lg font-bold text-gray-800">🛠️ Admin Tools</h2>
                    <button
                      onClick={() => setShowToolsModal(false)}
                      className="text-gray-400 hover:text-gray-600 text-2xl transition-colors p-1 -mr-1"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setToolsView('createUser');
                        setToolsMessage(null);
                        setCreateUserEmail('');
                        setCreateUserPassword('');
                        setCreateUserName('');
                        setCreateUserPhone('');
                        setCreateUserIsAdmin(false);
                      }}
                      className="w-full px-4 py-4 md:py-3 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 font-medium rounded-lg transition-colors flex items-center gap-3"
                    >
                      <span className="text-xl">👤</span>
                      <div className="text-left">
                        <div className="font-semibold text-sm md:text-base">Create User</div>
                        <div className="text-xs text-indigo-500">Create a new auth user account</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setToolsView('changeUserPassword');
                        setToolsMessage(null);
                        setChangePasswordEmail('');
                        setChangePasswordNew('');
                      }}
                      className="w-full px-4 py-4 md:py-3 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-700 font-medium rounded-lg transition-colors flex items-center gap-3"
                    >
                      <span className="text-xl">🔑</span>
                      <div className="text-left">
                        <div className="font-semibold text-sm md:text-base">Change Password for User</div>
                        <div className="text-xs text-amber-500">Reset password for any user</div>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {/* Create User Form */}
              {toolsView === 'createUser' && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      onClick={() => setToolsView('menu')}
                      className="text-gray-500 hover:text-gray-700 transition-colors p-1 -ml-1"
                    >
                      <span className="text-xl">←</span>
                    </button>
                    <h2 className="text-base md:text-lg font-bold text-gray-800">Create User</h2>
                  </div>
                  {toolsMessage && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${toolsMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {toolsMessage.text}
                    </div>
                  )}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setToolsLoading(true);
                      setToolsMessage(null);
                      try {
                        // For scoped users: use phone as email and password
                        // For admin users: use provided email and password
                        const email = createUserIsAdmin ? createUserEmail : `${createUserPhone}@gmail.com`;
                        const password = createUserIsAdmin ? createUserPassword : createUserPhone;
                        
                        const response = await fetch('/.netlify/functions/create-auth-user', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            email,
                            password,
                            name: createUserName,
                            phone: createUserIsAdmin ? '' : createUserPhone,
                            isAdmin: createUserIsAdmin,
                          }),
                        });
                        const result = await response.json();
                        if (response.ok && result.success) {
                          const userType = createUserIsAdmin ? 'Admin user' : 'Scoped user';
                          const loginInfo = createUserIsAdmin 
                            ? `Email: ${createUserEmail}` 
                            : `Email: ${createUserPhone}@gmail.com, Password: ${createUserPhone}`;
                          setToolsMessage({ type: 'success', text: `${userType} created successfully!\n${loginInfo}` });
                          setCreateUserEmail('');
                          setCreateUserPassword('');
                          setCreateUserName('');
                          setCreateUserPhone('');
                          setCreateUserIsAdmin(false);
                        } else {
                          setToolsMessage({ type: 'error', text: result.error || 'Failed to create user' });
                        }
                      } catch (err: any) {
                        setToolsMessage({ type: 'error', text: err.message || 'An error occurred' });
                      } finally {
                        setToolsLoading(false);
                      }
                    }}
                    className="space-y-4"
                  >
                    {/* Admin Toggle - Moved to top */}
                    <div className="flex items-center justify-between p-3 md:p-4 bg-gray-50 rounded-lg">
                      <div>
                        <label className="text-sm md:text-base font-medium text-gray-700">Admin User</label>
                        <p className="text-xs md:text-sm text-gray-500">{createUserIsAdmin ? 'Full access to all data' : 'Scoped to their own data'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCreateUserIsAdmin(!createUserIsAdmin)}
                        className={`relative inline-flex h-7 w-12 md:h-6 md:w-11 items-center rounded-full transition-colors ${createUserIsAdmin ? 'bg-purple-600' : 'bg-gray-300'}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 md:h-4 md:w-4 transform rounded-full bg-white transition-transform ${createUserIsAdmin ? 'translate-x-6' : 'translate-x-1'}`}
                        />
                      </button>
                    </div>

                    {/* Name field - shown for both */}
                    <div>
                      <label className="block text-sm md:text-base font-medium text-gray-700 mb-1">Name {!createUserIsAdmin && <span className="text-red-500">*</span>}</label>
                      <input
                        type="text"
                        value={createUserName}
                        onChange={(e) => setCreateUserName(e.target.value)}
                        required={!createUserIsAdmin}
                        placeholder="User's display name"
                        className="w-full px-3 py-2.5 md:py-2 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    {/* Conditional fields based on user type */}
                    {createUserIsAdmin ? (
                      <>
                        {/* Admin: Email and Password */}
                        <div>
                          <label className="block text-sm md:text-base font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                          <input
                            type="email"
                            value={createUserEmail}
                            onChange={(e) => setCreateUserEmail(e.target.value)}
                            required
                            placeholder="admin@example.com"
                            className="w-full px-3 py-2.5 md:py-2 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm md:text-base font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                          <input
                            type="password"
                            value={createUserPassword}
                            onChange={(e) => setCreateUserPassword(e.target.value)}
                            required
                            minLength={6}
                            placeholder="Min 6 characters"
                            className="w-full px-3 py-2.5 md:py-2 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <p className="text-xs text-purple-700">
                            ⚠️ Admin users have full access to all data and can manage all customers, loans, and subscriptions.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Scoped User: Phone Number only */}
                        <div>
                          <label className="block text-sm md:text-base font-medium text-gray-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
                          <input
                            type="tel"
                            value={createUserPhone}
                            onChange={(e) => setCreateUserPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            required
                            maxLength={10}
                            placeholder="10-digit phone number"
                            className="w-full px-3 py-2.5 md:py-2 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                          {createUserPhone && createUserPhone.length !== 10 && (
                            <p className="text-xs text-red-500 mt-1">Phone number must be exactly 10 digits</p>
                          )}
                        </div>
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs text-blue-700">
                            ℹ️ Login credentials will be:<br/>
                            <strong>Email:</strong> {createUserPhone || '(phone)'}@gmail.com<br/>
                            <strong>Password:</strong> {createUserPhone || '(phone number)'}
                          </p>
                        </div>
                      </>
                    )}

                    <button
                      type="submit"
                      disabled={toolsLoading || (!createUserIsAdmin && createUserPhone.length !== 10)}
                      className={`w-full px-4 py-3 md:py-2.5 text-base md:text-sm text-white font-semibold rounded-lg transition-colors ${createUserIsAdmin ? 'bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400' : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400'}`}
                    >
                      {toolsLoading ? 'Creating...' : createUserIsAdmin ? 'Create Admin User' : 'Create Scoped User'}
                    </button>
                  </form>
                </>
              )}

              {/* Change User Password Form */}
              {toolsView === 'changeUserPassword' && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      onClick={() => setToolsView('menu')}
                      className="text-gray-500 hover:text-gray-700 transition-colors p-1 -ml-1"
                    >
                      <span className="text-xl">←</span>
                    </button>
                    <h2 className="text-base md:text-lg font-bold text-gray-800">Change Password for User</h2>
                  </div>
                  {toolsMessage && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${toolsMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {toolsMessage.text}
                    </div>
                  )}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setToolsLoading(true);
                      setToolsMessage(null);
                      try {
                        const response = await fetch('/.netlify/functions/reset-customer-password', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            email: changePasswordEmail,
                            new_password: changePasswordNew,
                          }),
                        });
                        const result = await response.json();
                        if (response.ok && result.success) {
                          setToolsMessage({ type: 'success', text: 'Password changed successfully!' });
                          setChangePasswordEmail('');
                          setChangePasswordNew('');
                        } else {
                          setToolsMessage({ type: 'error', text: result.error || 'Failed to change password' });
                        }
                      } catch (err: any) {
                        setToolsMessage({ type: 'error', text: err.message || 'An error occurred' });
                      } finally {
                        setToolsLoading(false);
                      }
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm md:text-base font-medium text-gray-700 mb-1">User Email</label>
                      <input
                        type="email"
                        value={changePasswordEmail}
                        onChange={(e) => setChangePasswordEmail(e.target.value)}
                        required
                        placeholder="user@example.com"
                        className="w-full px-3 py-2.5 md:py-2 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm md:text-base font-medium text-gray-700 mb-1">New Password</label>
                      <input
                        type="password"
                        value={changePasswordNew}
                        onChange={(e) => setChangePasswordNew(e.target.value)}
                        required
                        minLength={6}
                        placeholder="Min 6 characters"
                        className="w-full px-3 py-2.5 md:py-2 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={toolsLoading}
                      className="w-full px-4 py-3 md:py-2.5 text-base md:text-sm bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-semibold rounded-lg transition-colors"
                    >
                      {toolsLoading ? 'Changing...' : 'Change Password'}
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Logout Confirmation Dialog (rendered into document.body via portal to ensure centering) */}
      {
        showLogoutConfirm && typeof document !== 'undefined' && ReactDOM.createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowLogoutConfirm(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-gray-800 mb-2">Confirm Logout</h2>
              <p className="text-gray-600 mb-6">Are you sure you want to logout?</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 sm:flex-none px-6 py-3 sm:py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[44px] sm:min-h-auto"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLogout}
                  className="flex-1 sm:flex-none px-6 py-3 sm:py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 active:bg-red-800 transition-colors min-h-[44px] sm:min-h-auto"
                >
                  Yes, Logout
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )
      }

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
                  /* Admin Name - Editable */
                  <div className="border-b border-gray-200 pb-3 md:pb-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <label className="text-xs text-gray-500 uppercase tracking-wide">Display Name</label>
                      <button
                        onClick={() => setIsEditingAdminName(!isEditingAdminName)}
                        className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                      >
                        {isEditingAdminName ? 'Cancel' : 'Edit'}
                      </button>
                    </div>
                    {isEditingAdminName ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                          placeholder="Enter your name"
                          className="w-full bg-gray-50 border border-gray-300 rounded px-3 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          onClick={handleSaveAdminName}
                          disabled={isSavingAdminName}
                          className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs md:text-sm font-medium rounded transition-colors"
                        >
                          {isSavingAdminName ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs md:text-sm font-semibold text-gray-800 mt-1">{adminNameFromMeta || '—'}</p>
                    )}
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
    </>
  );
});

ProfileHeader.displayName = 'ProfileHeader';

export default ProfileHeader;
