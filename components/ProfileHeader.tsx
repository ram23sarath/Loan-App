import React, { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { MoonIcon, SunIcon } from '../constants';
import { supabase } from '../src/lib/supabase';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import ReactDOM from 'react-dom';
import ChangePasswordModal from './modals/ChangePasswordModal';
import { SquigglyProgress } from './SquigglyProgress';

// Animation variants
const menuBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const menuDropdownVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: -10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -5,
    transition: { duration: 0.15 },
  },
};

const menuItemVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const modalContentVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 350,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: { duration: 0.15 },
  },
};

const buttonVariants: Variants = {
  idle: { scale: 1 },
  hover: {
    scale: 1.02,
    transition: { type: 'spring', stiffness: 400, damping: 20 },
  },
  tap: { scale: 0.98 },
};

const toolButtonVariants: Variants = {
  idle: { scale: 1, x: 0 },
  hover: {
    scale: 1.02,
    x: 4,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    transition: { type: 'spring', stiffness: 400, damping: 20 },
  },
  tap: { scale: 0.98 },
};

const avatarVariants: Variants = {
  idle: { scale: 1 },
  hover: {
    scale: 1.08,
    boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
    transition: { type: 'spring', stiffness: 400, damping: 20 },
  },
  tap: { scale: 0.95 },
};

export interface ProfileHeaderHandle {
  openMenu: () => void;
}

const getButtonCenter = (button: HTMLElement) => {
  const rect = button.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
};

const ProfileHeader = forwardRef<ProfileHeaderHandle>((props, ref) => {
  const { session, signOut, isScopedCustomer, customers, customerMap, scopedCustomerId, updateCustomer } = useData();
  const { theme, toggleTheme } = useTheme();
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
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupStartTs, setBackupStartTs] = useState<number | null>(null);
  const [backupElapsed, setBackupElapsed] = useState('00:00');
  const backupTimerRef = React.useRef<number | null>(null);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupCurrentStep, setBackupCurrentStep] = useState('');
  const [backupRunId, setBackupRunId] = useState<number | null>(null);
  const [backupCancelling, setBackupCancelling] = useState(false);
  const [backupGitHubUrl, setBackupGitHubUrl] = useState<string | null>(null);
  const [backupArtifacts, setBackupArtifacts] = useState<Array<{ id: number; name: string }>>([]);
  const [backupDownloading, setBackupDownloading] = useState(false);
  const backupPollRef = React.useRef<number | null>(null);
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

  // Handle Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Close modals in priority order (most specific first)
        if (showLogoutConfirm) {
          setShowLogoutConfirm(false);
        } else if (showChangePasswordModal) {
          setShowChangePasswordModal(false);
        } else if (showToolsModal) {
          setShowToolsModal(false);
        } else if (showProfilePanel) {
          setShowProfilePanel(false);
        } else if (showMenu) {
          setShowMenu(false);
        } else if (backupRunning && (backupProgress >= 100 || backupCurrentStep.startsWith('❌'))) {
          // Only allow closing backup overlay when complete or error
          if (backupPollRef.current) {
            clearInterval(backupPollRef.current);
            backupPollRef.current = null;
          }
          if (backupTimerRef.current) {
            clearInterval(backupTimerRef.current);
            backupTimerRef.current = null;
          }
          setBackupRunning(false);
          setBackupStartTs(null);
          setBackupElapsed('00:00');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showMenu, showChangePasswordModal, showToolsModal, showProfilePanel, showLogoutConfirm, backupRunning, backupProgress, backupCurrentStep]);

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
      <div className="fixed top-4 right-6 z-[100] hidden sm:flex items-center gap-2" ref={menuRef}>
        {/* Profile Avatar Button with Pulse Ring */}
        <motion.button
          onClick={() => setShowMenu(!showMenu)}
          className="relative w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold flex items-center justify-center shadow-lg transition-colors text-lg md:text-xl"
          variants={avatarVariants}
          initial="idle"
          whileHover="hover"
          whileTap="tap"
          title={displayName}
        >
          {/* Animated pulse ring */}
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-indigo-400/50"
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          {initials}
        </motion.button>
      </div>

      {/* Profile Menu Dropdown (rendered as portal to show on mobile) */}
      {typeof document !== 'undefined' && ReactDOM.createPortal(
        <AnimatePresence>
          {showMenu && (
            <motion.div
              key="profile-menu-backdrop"
              className="fixed inset-0 z-[110] bg-black/20 flex items-center justify-center"
              variants={menuBackdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setShowMenu(false)}
            >
              {/* Menu positioned based on screen size */}
              <motion.div
                variants={menuDropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute z-[120] bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden left-4 right-4 bottom-20 w-auto sm:w-60 sm:left-auto sm:right-6 sm:top-16 sm:bottom-auto landscape:w-60 landscape:left-auto landscape:right-6 landscape:top-16 landscape:bottom-auto dark:bg-dark-card dark:border-dark-border"
                onClick={(e) => e.stopPropagation()}
              >
                <motion.div
                  className="px-3 md:px-4 py-2 md:py-3 border-b border-gray-100 dark:border-dark-border bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <p className="text-xs text-gray-500 dark:text-dark-muted">Logged in as</p>
                  <div className="flex items-center justify-between gap-1 md:gap-2 mt-1">
                    <p className="text-xs md:text-sm font-semibold text-gray-800 truncate dark:text-dark-text">
                      {isScopedCustomer && customerDetails ? customerDetails.name : userEmail}
                    </p>
                    {isScopedCustomer && (
                      <motion.span
                        className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full whitespace-nowrap dark:bg-blue-900/30 dark:text-blue-400"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}
                      >
                        Customer
                      </motion.span>
                    )}
                    {!isScopedCustomer && (
                      <motion.span
                        className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full whitespace-nowrap dark:bg-purple-900/30 dark:text-purple-400"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}
                      >
                        Admin
                      </motion.span>
                    )}
                  </div>
                </motion.div>

                <div className="py-1">
                  <motion.button
                    variants={menuItemVariants}
                    onClick={handleViewProfile}
                    className="w-full px-3 md:px-4 py-1.5 md:py-2 text-left text-xs md:text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium flex items-center gap-2 dark:text-dark-text dark:hover:bg-slate-700 dark:active:bg-slate-600"
                    whileHover={{ x: 4, backgroundColor: 'rgba(99, 102, 241, 0.05)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    👤 View Profile
                  </motion.button>

                  <motion.button
                    variants={menuItemVariants}
                    onClick={() => {
                      window.location.reload();
                    }}
                    className="w-full px-3 md:px-4 py-1.5 md:py-2 text-left text-xs md:text-sm text-green-600 hover:bg-green-50 active:bg-green-100 transition-colors font-medium flex items-center gap-2 dark:text-green-400 dark:hover:bg-green-900/20 dark:active:bg-green-900/30"
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    🔄 Refresh App
                  </motion.button>

                  {/* Tools - Admin Only */}
                  {!isScopedCustomer && (
                    <motion.button
                      variants={menuItemVariants}
                      onClick={() => {
                        setShowMenu(false);
                        setToolsView('menu');
                        setToolsMessage(null);
                        setShowToolsModal(true);
                      }}
                      className="w-full px-3 md:px-4 py-1.5 md:py-2 text-left text-xs md:text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium flex items-center gap-2 dark:text-dark-text dark:hover:bg-slate-700 dark:active:bg-slate-600"
                      whileHover={{ x: 4, backgroundColor: 'rgba(99, 102, 241, 0.05)' }}
                      whileTap={{ scale: 0.98 }}
                    >
                      🛠️ Tools
                    </motion.button>
                  )}
                  <motion.button
                    variants={menuItemVariants}
                    onClick={handleChangePassword}
                    className="w-full px-3 md:px-4 py-1.5 md:py-2 text-left text-xs md:text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium flex items-center gap-2 dark:text-dark-text dark:hover:bg-slate-700 dark:active:bg-slate-600"
                    whileHover={{ x: 4, backgroundColor: 'rgba(99, 102, 241, 0.05)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    🔑 Change Password
                  </motion.button>
                  <div className="border-t border-gray-100 my-1 dark:border-dark-border" />
                  <motion.button
                    variants={menuItemVariants}
                    onClick={handleSignOut}
                    className="w-full px-3 md:px-4 py-1.5 md:py-2 text-left text-xs md:text-sm text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors font-medium flex items-center gap-2 dark:text-red-400 dark:hover:bg-red-900/20 dark:active:bg-red-900/30"
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    🚪 Sign Out
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

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
              className="bg-white rounded-2xl shadow-2xl p-4 md:p-6 w-[92%] max-w-md max-h-[85vh] overflow-y-auto dark:bg-dark-card dark:border dark:border-dark-border"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Tools Menu */}
              {toolsView === 'menu' && (
                <>
                  <motion.div
                    className="flex items-center justify-between mb-4"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  >
                    <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-dark-text">🛠️ Admin Tools</h2>
                    <motion.button
                      onClick={() => setShowToolsModal(false)}
                      className="text-gray-400 hover:text-gray-600 text-2xl transition-colors p-1 -mr-1 dark:text-dark-muted dark:hover:text-dark-text"
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      ✕
                    </motion.button>
                  </motion.div>
                  <div className="space-y-3">
                    <motion.button
                      onClick={() => {
                        setToolsView('createUser');
                        setToolsMessage(null);
                        setCreateUserEmail('');
                        setCreateUserPassword('');
                        setCreateUserName('');
                        setCreateUserPhone('');
                        setCreateUserIsAdmin(false);
                      }}
                      className="w-full px-4 py-4 md:py-3 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 font-medium rounded-lg transition-colors flex items-center gap-3 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.1 }}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span className="text-xl">👤</span>
                      <div className="text-left">
                        <div className="font-semibold text-sm md:text-base">Create User</div>
                        <div className="text-xs text-indigo-500 dark:text-indigo-400/70">Create a new auth user account</div>
                      </div>
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        setToolsView('changeUserPassword');
                        setToolsMessage(null);
                        setChangePasswordEmail('');
                        setChangePasswordNew('');
                      }}
                      className="w-full px-4 py-4 md:py-3 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-700 font-medium rounded-lg transition-colors flex items-center gap-3 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.15 }}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span className="text-xl">🔑</span>
                      <div className="text-left">
                        <div className="font-semibold text-sm md:text-base">Change Password for User</div>
                        <div className="text-xs text-amber-500 dark:text-amber-400/70">Reset password for any user</div>
                      </div>
                    </motion.button>
                    <button
                      onClick={async () => {
                        // Close tools modal and show full-screen backup overlay
                        setShowToolsModal(false);
                        setToolsMessage(null);
                        setBackupRunning(true);
                        setBackupProgress(0);
                        setBackupCurrentStep('Starting backup...');
                        setBackupRunId(null);
                        setBackupCancelling(false);
                        setBackupGitHubUrl(null);
                        setBackupArtifacts([]);
                        setBackupDownloading(false);
                        const startTime = Date.now();
                        setBackupStartTs(startTime);
                        setBackupElapsed('00:00');

                        // Start elapsed timer
                        backupTimerRef.current = window.setInterval(() => {
                          const diff = Date.now() - startTime;
                          const s = Math.floor(diff / 1000);
                          const hh = Math.floor(s / 3600);
                          const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
                          const ss = (s % 60).toString().padStart(2, '0');
                          setBackupElapsed(hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`);
                        }, 1000) as unknown as number;

                        try {
                          // Trigger the workflow
                          const res = await fetch('/.netlify/functions/trigger-backup', { method: 'POST' });
                          if (!res.ok) {
                            const txt = await res.text();
                            throw new Error(txt || 'Failed to start backup');
                          }

                          setBackupCurrentStep('Workflow dispatched, waiting for run to start...');

                          // Poll for status
                          const pollStatus = async () => {
                            try {
                              const statusRes = await fetch('/.netlify/functions/backup-status');
                              if (statusRes.ok) {
                                const data = await statusRes.json();
                                if (data.found) {
                                  setBackupRunId(data.id);
                                  setBackupProgress(data.progress || 0);
                                  setBackupCurrentStep(data.currentStep || `Status: ${data.status}`);
                                  if (data.html_url) {
                                    setBackupGitHubUrl(data.html_url);
                                  }

                                  if (data.status === 'completed') {
                                    // Stop polling
                                    if (backupPollRef.current) {
                                      clearInterval(backupPollRef.current);
                                      backupPollRef.current = null;
                                    }
                                    if (backupTimerRef.current) {
                                      clearInterval(backupTimerRef.current);
                                      backupTimerRef.current = null;
                                    }
                                    setBackupProgress(100);
                                    if (data.conclusion === 'success') {
                                      setBackupCurrentStep('✅ Backup completed successfully!');
                                      // Store artifacts for download
                                      if (data.artifacts && data.artifacts.length > 0) {
                                        setBackupArtifacts(data.artifacts);
                                      }
                                    } else if (data.conclusion === 'cancelled') {
                                      setBackupCurrentStep('❌ Backup was cancelled');
                                    } else {
                                      setBackupCurrentStep(`⚠️ Backup finished: ${data.conclusion}`);
                                    }
                                  }
                                }
                              }
                            } catch (e) {
                              console.error('Status poll error:', e);
                            }
                          };

                          // Initial delay before first poll (give workflow time to start)
                          await new Promise(r => setTimeout(r, 3000));
                          await pollStatus();

                          // Continue polling every 5 seconds
                          backupPollRef.current = window.setInterval(pollStatus, 5000) as unknown as number;

                        } catch (err: any) {
                          setBackupCurrentStep(`❌ Error: ${err.message || 'Backup failed'}`);
                          setBackupProgress(0);
                          // Stop timers
                          if (backupTimerRef.current) {
                            clearInterval(backupTimerRef.current);
                            backupTimerRef.current = null;
                          }
                        }
                      }}
                      className="w-full px-4 py-4 md:py-3 bg-green-50 hover:bg-green-100 active:bg-green-200 text-green-700 font-medium rounded-lg transition-colors flex items-center gap-3 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400"
                      disabled={toolsLoading || backupRunning}
                    >
                      <motion.span
                        className="text-xl"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}
                      >💾</motion.span>
                      <div className="text-left">
                        <div className="font-semibold text-sm md:text-base">Backup Database</div>
                        <div className="text-xs text-green-500 dark:text-green-400/70">
                          Trigger a DB backup to Google Drive
                        </div>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {/* Create User Form */}
              {toolsView === 'createUser' && (
                <>
                  <motion.div
                    className="flex items-center gap-3 mb-4"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  >
                    <motion.button
                      onClick={() => setToolsView('menu')}
                      className="text-gray-500 hover:text-gray-700 transition-colors p-1 -ml-1 dark:text-dark-muted dark:hover:text-dark-text"
                      whileHover={{ scale: 1.2, x: -3 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <span className="text-xl">←</span>
                    </motion.button>
                    <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-dark-text">Create User</h2>
                  </motion.div>
                  <AnimatePresence>
                    {toolsMessage && (
                      <motion.div
                        className={`mb-4 p-3 rounded-lg text-sm ${toolsMessage.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                      >
                        {toolsMessage.text}
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                    <motion.div
                      className="flex items-center justify-between p-3 md:p-4 bg-gray-50 rounded-lg dark:bg-slate-700"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 24 }}
                    >
                      <div>
                        <label className="text-sm md:text-base font-medium text-gray-700 dark:text-dark-text">Admin User</label>
                        <p className="text-xs md:text-sm text-gray-500 dark:text-dark-muted">{createUserIsAdmin ? 'Full access to all data' : 'Scoped to their own data'}</p>
                      </div>
                      <motion.button
                        type="button"
                        onClick={() => setCreateUserIsAdmin(!createUserIsAdmin)}
                        className={`relative inline-flex h-7 w-12 md:h-6 md:w-11 items-center rounded-full transition-colors ${createUserIsAdmin ? 'bg-purple-600' : 'bg-gray-300'}`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <motion.span
                          className="inline-block h-5 w-5 md:h-4 md:w-4 rounded-full bg-white"
                          animate={{ x: createUserIsAdmin ? 24 : 4 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </motion.button>
                    </motion.div>

                    {/* Name field - shown for both */}
                    <div>
                      <label className="block text-sm md:text-base font-medium text-gray-700 mb-1 dark:text-dark-text">Name {!createUserIsAdmin && <span className="text-red-500">*</span>}</label>
                      <input
                        type="text"
                        value={createUserName}
                        onChange={(e) => setCreateUserName(e.target.value)}
                        required={!createUserIsAdmin}
                        placeholder="User's display name"
                        className="w-full px-3 py-2.5 md:py-2 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted"
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
                          <label className="block text-sm md:text-base font-medium text-gray-700 mb-1 dark:text-dark-text">Phone Number <span className="text-red-500">*</span></label>
                          <input
                            type="tel"
                            value={createUserPhone}
                            onChange={(e) => setCreateUserPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            required
                            maxLength={10}
                            placeholder="10-digit phone number"
                            className="w-full px-3 py-2.5 md:py-2 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted"
                          />
                          {createUserPhone && createUserPhone.length !== 10 && (
                            <p className="text-xs text-red-500 mt-1">Phone number must be exactly 10 digits</p>
                          )}
                        </div>
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
                          <p className="text-xs text-blue-700 dark:text-blue-400">
                            ℹ️ Login credentials will be:<br />
                            <strong>Email:</strong> {createUserPhone || '(phone)'}@gmail.com<br />
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
                  <motion.div
                    className="flex items-center gap-3 mb-4"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  >
                    <motion.button
                      onClick={() => setToolsView('menu')}
                      className="text-gray-500 hover:text-gray-700 transition-colors p-1 -ml-1 dark:text-dark-muted dark:hover:text-dark-text"
                      whileHover={{ scale: 1.2, x: -3 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <span className="text-xl">←</span>
                    </motion.button>
                    <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-dark-text">Change Password for User</h2>
                  </motion.div>
                  <AnimatePresence>
                    {toolsMessage && (
                      <motion.div
                        className={`mb-4 p-3 rounded-lg text-sm ${toolsMessage.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                      >
                        {toolsMessage.text}
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 24 }}
                    >
                      <label className="block text-sm md:text-base font-medium text-gray-700 mb-1 dark:text-dark-text">User Email</label>
                      <input
                        type="email"
                        value={changePasswordEmail}
                        onChange={(e) => setChangePasswordEmail(e.target.value)}
                        required
                        placeholder="user@example.com"
                        className="w-full px-3 py-2.5 md:py-2 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted"
                      />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 24 }}
                    >
                      <label className="block text-sm md:text-base font-medium text-gray-700 mb-1 dark:text-dark-text">New Password</label>
                      <input
                        type="password"
                        value={changePasswordNew}
                        onChange={(e) => setChangePasswordNew(e.target.value)}
                        required
                        minLength={6}
                        placeholder="Min 6 characters"
                        className="w-full px-3 py-2.5 md:py-2 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted"
                      />
                    </motion.div>
                    <motion.button
                      type="submit"
                      disabled={toolsLoading}
                      className="w-full px-4 py-3 md:py-2.5 text-base md:text-sm bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-semibold rounded-lg transition-colors"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 24 }}
                      whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)' }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {toolsLoading ? 'Changing...' : 'Change Password'}
                    </motion.button>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Logout Confirmation Dialog (rendered into document.body via portal to ensure centering) */}
      {typeof document !== 'undefined' && ReactDOM.createPortal(
        <AnimatePresence>
          {showLogoutConfirm && (
            <motion.div
              key="logout-backdrop"
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
              onClick={() => setShowLogoutConfirm(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm dark:bg-dark-card dark:border dark:border-dark-border"
                onClick={(e) => e.stopPropagation()}
              >
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 24 }}
                >
                  <h2 className="text-lg font-bold text-gray-800 mb-2 dark:text-dark-text">Confirm Logout</h2>
                </motion.div>
                <motion.p
                  className="text-gray-600 mb-6 dark:text-dark-muted"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  Are you sure you want to logout?
                </motion.p>
                <motion.div
                  className="flex flex-col gap-3 sm:flex-row sm:justify-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 24 }}
                >
                  <motion.button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 sm:flex-none px-6 py-3 sm:py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[44px] sm:min-h-auto dark:border-dark-border dark:text-dark-text dark:hover:bg-slate-700 dark:active:bg-slate-600"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={confirmLogout}
                    className="flex-1 sm:flex-none px-6 py-3 sm:py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 active:bg-red-800 transition-colors min-h-[44px] sm:min-h-auto"
                    whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Yes, Logout
                  </motion.button>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
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
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="bg-white rounded-xl shadow-2xl p-4 md:p-6 w-full max-w-sm md:max-w-md max-h-[90vh] overflow-y-auto z-[100] dark:bg-dark-card dark:border dark:border-dark-border"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                className="flex items-center justify-between mb-4"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              >
                <h2 className="text-lg md:text-2xl font-bold text-gray-800 dark:text-dark-text">Profile</h2>
                <motion.button
                  onClick={() => setShowProfilePanel(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl md:text-2xl transition-colors dark:text-dark-muted dark:hover:text-dark-text"
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  ✕
                </motion.button>
              </motion.div>

              <div className="space-y-3 md:space-y-4">
                {/* Account Type */}
                <motion.div
                  className="border-b border-gray-200 pb-3 md:pb-4 dark:border-dark-border"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 24 }}
                >
                  <label className="text-xs text-gray-500 uppercase tracking-wide dark:text-dark-muted">Account Type</label>
                  <p className="text-xs md:text-sm font-semibold text-gray-800 mt-1 dark:text-dark-text">
                    {isScopedCustomer ? 'Customer' : 'Admin'}
                  </p>
                </motion.div>

                {/* Email */}
                <motion.div
                  className="border-b border-gray-200 pb-3 md:pb-4 dark:border-dark-border"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 24 }}
                >
                  <label className="text-xs text-gray-500 uppercase tracking-wide dark:text-dark-muted">Email</label>
                  <p className="text-xs md:text-sm font-semibold text-gray-800 mt-1 break-all dark:text-dark-text">{userEmail}</p>
                </motion.div>

                {/* Customer Details (if scoped user) */}
                {isScopedCustomer && customerDetails ? (
                  <>
                    <div className="border-b border-gray-200 pb-3 md:pb-4 dark:border-dark-border">
                      <label className="text-xs text-gray-500 uppercase tracking-wide dark:text-dark-muted">Customer Name</label>
                      <p className="text-xs md:text-sm font-semibold text-gray-800 mt-1 dark:text-dark-text">{customerDetails.name || '—'}</p>
                    </div>

                    <div className="border-b border-gray-200 pb-3 md:pb-4 dark:border-dark-border">
                      <label className="text-xs text-gray-500 uppercase tracking-wide dark:text-dark-muted">Phone Number</label>
                      <p className="text-xs md:text-sm font-semibold text-gray-800 mt-1 dark:text-dark-text">{customerDetails.phone || '—'}</p>
                    </div>

                    {customerDetails.address && (
                      <div className="border-b border-gray-200 pb-3 md:pb-4 dark:border-dark-border">
                        <label className="text-xs text-gray-500 uppercase tracking-wide dark:text-dark-muted">Address</label>
                        <p className="text-xs md:text-sm font-semibold text-gray-800 mt-1 break-words dark:text-dark-text">{customerDetails.address}</p>
                      </div>
                    )}

                    {/* Station Name - Editable */}
                    <div className="border-b border-gray-200 pb-3 md:pb-4 dark:border-dark-border">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <label className="text-xs text-gray-500 uppercase tracking-wide dark:text-dark-muted">Station Name</label>
                        <button
                          onClick={() => setIsEditingStation(!isEditingStation)}
                          className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
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
                            className="w-full bg-gray-50 border border-gray-300 rounded px-3 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted"
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
                        <p className="text-xs md:text-sm font-semibold text-gray-800 mt-1 dark:text-dark-text">{stationName || '—'}</p>
                      )}
                    </div>
                  </>
                ) : isScopedCustomer ? (
                  <div className="text-center py-4">
                    <p className="text-xs md:text-sm text-gray-500 dark:text-dark-muted">Customer details not found</p>
                  </div>
                ) : (
                  /* Admin Name - Editable */
                  <div className="border-b border-gray-200 pb-3 md:pb-4 dark:border-dark-border">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <label className="text-xs text-gray-500 uppercase tracking-wide dark:text-dark-muted">Display Name</label>
                      <button
                        onClick={() => setIsEditingAdminName(!isEditingAdminName)}
                        className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
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
                          className="w-full bg-gray-50 border border-gray-300 rounded px-3 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted"
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
                      <p className="text-xs md:text-sm font-semibold text-gray-800 mt-1 dark:text-dark-text">{adminNameFromMeta || '—'}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 md:mt-6 flex gap-2">
                <button
                  onClick={() => setShowProfilePanel(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm md:text-base font-medium rounded-lg transition-colors dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-dark-text"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen Backup Progress Overlay */}
      {backupRunning && typeof document !== 'undefined' && ReactDOM.createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 w-[90%] max-w-md mx-4"
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <span className="text-2xl">💾</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Database Backup</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Elapsed: {backupElapsed}</p>
              </div>
            </div>

            {/* Progress Bar - Material Design 3 Style */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-300">Progress</span>
                <span className="font-semibold text-green-600 dark:text-green-400">{backupProgress}%</span>
              </div>
              <SquigglyProgress
                value={backupProgress}
                height={12}
                color="#10b981"
                backgroundColor={theme === 'dark' ? '#334155' : '#e2e8f0'}
              />
            </div>

            {/* Current Step */}
            <div className="mb-6 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                {backupProgress < 100 && !backupCurrentStep.startsWith('❌') && !backupCurrentStep.startsWith('✅') && (
                  <svg className="w-4 h-4 animate-spin text-green-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                )}
                <span className="truncate">{backupCurrentStep}</span>
              </p>
            </div>

            {/* Cancel Button */}
            {backupProgress < 100 && !backupCurrentStep.startsWith('❌') && (
              <button
                onClick={async () => {
                  if (!backupRunId || backupCancelling) return;
                  setBackupCancelling(true);
                  setBackupCurrentStep('Cancelling backup...');
                  try {
                    const res = await fetch('/.netlify/functions/cancel-backup', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ runId: backupRunId })
                    });
                    if (res.ok) {
                      setBackupCurrentStep('❌ Backup cancelled');
                    } else {
                      const data = await res.json();
                      setBackupCurrentStep(`⚠️ Cancel failed: ${data.error || 'Unknown error'}`);
                    }
                  } catch (e: any) {
                    setBackupCurrentStep(`⚠️ Cancel failed: ${e.message}`);
                  } finally {
                    // Stop polling
                    if (backupPollRef.current) {
                      clearInterval(backupPollRef.current);
                      backupPollRef.current = null;
                    }
                    if (backupTimerRef.current) {
                      clearInterval(backupTimerRef.current);
                      backupTimerRef.current = null;
                    }
                    setBackupCancelling(false);
                    // Close after 2 seconds
                    setTimeout(() => {
                      setBackupRunning(false);
                      setBackupStartTs(null);
                      setBackupElapsed('00:00');
                    }, 2000);
                  }
                }}
                disabled={backupCancelling || !backupRunId}
                className="w-full px-4 py-3 bg-red-100 hover:bg-red-200 active:bg-red-300 text-red-700 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400"
              >
                {backupCancelling ? 'Cancelling...' : 'Cancel Backup'}
              </button>
            )}

            {/* View on GitHub and Close Buttons (shown when complete or error) */}
            {(backupProgress >= 100 || backupCurrentStep.startsWith('❌')) && (
              <div className="space-y-3">
                {/* Download Backup button - only show on success with artifacts */}
                {backupCurrentStep.startsWith('✅') && backupArtifacts.length > 0 && backupRunId && (
                  <button
                    onClick={async () => {
                      if (backupDownloading) return;
                      setBackupDownloading(true);
                      try {
                        const artifact = backupArtifacts[0]; // Get the first artifact
                        const res = await fetch('/.netlify/functions/download-artifact', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ run_id: backupRunId, artifact_id: artifact.id })
                        });
                        if (!res.ok) {
                          const txt = await res.text();
                          throw new Error(txt || 'Download failed');
                        }
                        // Download the blob
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${artifact.name}.zip`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      } catch (err: any) {
                        console.error('Download error:', err);
                        alert(`Download failed: ${err.message}`);
                      } finally {
                        setBackupDownloading(false);
                      }
                    }}
                    disabled={backupDownloading}
                    className="w-full px-4 py-3 bg-green-100 hover:bg-green-200 active:bg-green-300 text-green-700 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400"
                  >
                    {backupDownloading ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Backup
                      </>
                    )}
                  </button>
                )}
                {/* View on GitHub link - fallback */}
                {backupGitHubUrl && backupCurrentStep.startsWith('✅') && (
                  <a
                    href={backupGitHubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full px-4 py-3 bg-indigo-100 hover:bg-indigo-200 active:bg-indigo-300 text-indigo-700 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    View on GitHub
                  </a>
                )}
                <button
                  onClick={() => {
                    if (backupPollRef.current) {
                      clearInterval(backupPollRef.current);
                      backupPollRef.current = null;
                    }
                    if (backupTimerRef.current) {
                      clearInterval(backupTimerRef.current);
                      backupTimerRef.current = null;
                    }
                    setBackupRunning(false);
                    setBackupStartTs(null);
                    setBackupElapsed('00:00');
                  }}
                  className="w-full px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white"
                >
                  Close
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>,
        document.body
      )}
    </>
  );
});

ProfileHeader.displayName = 'ProfileHeader';

export default ProfileHeader;
