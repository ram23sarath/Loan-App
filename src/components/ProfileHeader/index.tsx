import React, {
  useState,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext";
import { useTheme } from "../../context/ThemeContext";
import { MoonIcon, SunIcon } from "../../constants";
import { motion, AnimatePresence } from "framer-motion";
import ReactDOM from "react-dom";
import ChangePasswordModal from "../modals/ChangePasswordModal";

// Import from extracted modules
import {
  menuBackdropVariants,
  menuDropdownVariants,
  menuItemVariants,
  avatarVariants,
} from "./constants/animations";

import { useBackupWorkflow } from "./hooks/useBackupWorkflow";
import { useNotifications } from "./hooks/useNotifications";
import { useProfileEditing } from "./hooks/useProfileEditing";

import {
  NotificationModal,
  LogoutConfirmModal,
  ProfilePanelModal,
  BackupProgressModal,
  ToolsModal,
} from "./modals";

export interface ProfileHeaderHandle {
  openMenu: () => void;
}

const ProfileHeader = forwardRef<ProfileHeaderHandle>((props, ref) => {
  const navigate = useNavigate();
  const {
    session,
    signOut,
    isScopedCustomer,
    customerMap,
    scopedCustomerId,
    updateCustomer,
  } = useData();
  const { theme, toggleTheme } = useTheme();

  // Menu state
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Modal visibility state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  // Custom hooks
  const backup = useBackupWorkflow();
  const notifications = useNotifications(
    isScopedCustomer,
    session?.user?.id ?? null,
  );

  // Get customer details if scoped user
  const customerDetails =
    isScopedCustomer && scopedCustomerId
      ? (customerMap.get(scopedCustomerId) ?? null)
      : null;

  const userEmail = session?.user?.email || "User";
  const adminNameFromMeta = session?.user?.user_metadata?.name || "";

  const profileEditing = useProfileEditing({
    isScopedCustomer,
    scopedCustomerId,
    customerDetails,
    adminNameFromMeta,
    showProfilePanel,
    updateCustomer,
  });

  // Expose openMenu method to parent via ref
  useImperativeHandle(ref, () => ({
    openMenu: () => setShowMenu(true),
  }));

  // Handle Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showLogoutConfirm) {
          setShowLogoutConfirm(false);
        } else if (showChangePasswordModal) {
          setShowChangePasswordModal(false);
        } else if (showToolsModal) {
          setShowToolsModal(false);
        } else if (showProfilePanel) {
          setShowProfilePanel(false);
        } else if (showNotificationModal) {
          setShowNotificationModal(false);
        } else if (showMenu) {
          setShowMenu(false);
        } else if (
          backup.backupRunning &&
          (backup.backupProgress >= 100 ||
            backup.backupCurrentStep.startsWith("❌"))
        ) {
          backup.closeBackup();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    showMenu,
    showChangePasswordModal,
    showToolsModal,
    showProfilePanel,
    showLogoutConfirm,
    showNotificationModal,
    backup,
  ]);

  if (!session || !session.user) return null;

  // Prefer the customer's name for display when scoped; use metadata name for admins; fall back to email
  const displayName =
    isScopedCustomer && customerDetails?.name
      ? customerDetails.name
      : adminNameFromMeta || userEmail;

  const initials =
    (displayName && displayName.trim().charAt(0).toUpperCase()) || "U";

  // Event handlers
  const handleViewProfile = () => {
    setShowMenu(false);
    setShowProfilePanel(true);
  };

  const handleChangePassword = () => {
    setShowChangePasswordModal(true);
    setShowMenu(false);
  };

  const handleSignOut = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Logout failed", err);
    } finally {
      setShowLogoutConfirm(false);
      setShowMenu(false);
      setShowProfilePanel(false);
    }
  };

  const handleNotificationClick = async () => {
    setShowMenu(false);
    // clear previous error
    notifications.setNotificationError?.(null);
    try {
      await notifications.fetchNotifications(true);
      setShowNotificationModal(true);
    } catch (err) {
      console.error("Failed fetching notifications", err);
      // ensure modal is shown so the error UI can render
      setShowNotificationModal(true);
    }
  };

  const handleOpenTools = () => {
    setShowMenu(false);
    setShowToolsModal(true);
  };

  const handleStartBackup = () => {
    setShowToolsModal(false);
    backup.startBackup();
  };

  const handleNavigateToTrash = () => {
    navigate("/trash");
  };

  return (
    <>
      {/* Profile Avatar Button */}
      <div
        className="fixed top-4 right-6 z-[100] hidden sm:flex items-center gap-2"
        ref={menuRef}
      >
        <motion.button
          onClick={() => setShowMenu(!showMenu)}
          className="relative w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold flex items-center justify-center shadow-lg transition-colors text-lg md:text-xl"
          variants={avatarVariants}
          initial="idle"
          whileHover="hover"
          whileTap="tap"
          title={displayName}
        >
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-indigo-400/50"
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          {initials}
        </motion.button>
      </div>

      {/* Profile Menu Dropdown */}
      {typeof document !== "undefined" &&
        ReactDOM.createPortal(
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
                <motion.div
                  variants={menuDropdownVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute z-[120] bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden left-4 right-4 bottom-20 w-auto sm:w-60 sm:left-auto sm:right-6 sm:top-16 sm:bottom-auto landscape:w-60 landscape:left-auto landscape:right-6 landscape:top-16 landscape:bottom-auto dark:bg-dark-card dark:border-dark-border"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* User info header */}
                  <motion.div
                    className="px-3 md:px-4 py-2 md:py-3 border-b border-gray-100 dark:border-dark-border bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <p className="text-xs text-gray-500 dark:text-dark-muted">
                      Logged in as
                    </p>
                    <div className="flex items-center justify-between gap-1 md:gap-2 mt-1">
                      <p className="text-xs md:text-sm font-semibold text-gray-800 truncate dark:text-dark-text">
                        {isScopedCustomer && customerDetails
                          ? customerDetails.name
                          : userEmail}
                      </p>
                      {isScopedCustomer ? (
                        <motion.span
                          className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full whitespace-nowrap dark:bg-blue-900/30 dark:text-blue-400"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 20,
                            delay: 0.2,
                          }}
                        >
                          Customer
                        </motion.span>
                      ) : (
                        <motion.span
                          className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full whitespace-nowrap dark:bg-purple-900/30 dark:text-purple-400"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 20,
                            delay: 0.2,
                          }}
                        >
                          Admin
                        </motion.span>
                      )}
                    </div>
                  </motion.div>

                  {/* Menu items */}
                  <div className="py-1">
                    <motion.button
                      variants={menuItemVariants}
                      onClick={handleViewProfile}
                      className="w-full px-3 md:px-4 py-1.5 md:py-2 text-left text-xs md:text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium flex items-center gap-2 dark:text-dark-text dark:hover:bg-slate-700 dark:active:bg-slate-600"
                      whileHover={{
                        x: 4,
                        backgroundColor: "rgba(99, 102, 241, 0.05)",
                      }}
                      whileTap={{ scale: 0.98 }}
                    >
                      👤 View Profile
                    </motion.button>

                    {!isScopedCustomer && (
                      <motion.button
                        variants={menuItemVariants}
                        onClick={handleNotificationClick}
                        className="w-full px-3 md:px-4 py-1.5 md:py-2 text-left text-xs md:text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium flex items-center gap-2 dark:text-dark-text dark:hover:bg-slate-700 dark:active:bg-slate-600"
                        whileHover={{
                          x: 4,
                          backgroundColor: "rgba(99, 102, 241, 0.05)",
                        }}
                        whileTap={{ scale: 0.98 }}
                      >
                        🔔 Notification
                      </motion.button>
                    )}

                    <motion.button
                      variants={menuItemVariants}
                      onClick={() => window.location.reload()}
                      className="w-full px-3 md:px-4 py-1.5 md:py-2 text-left text-xs md:text-sm text-green-600 hover:bg-green-50 active:bg-green-100 transition-colors font-medium flex items-center gap-2 dark:text-green-400 dark:hover:bg-green-900/20 dark:active:bg-green-900/30"
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      🔄 Refresh App
                    </motion.button>

                    {!isScopedCustomer && (
                      <motion.button
                        variants={menuItemVariants}
                        onClick={handleOpenTools}
                        className="w-full px-3 md:px-4 py-1.5 md:py-2 text-left text-xs md:text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium flex items-center gap-2 dark:text-dark-text dark:hover:bg-slate-700 dark:active:bg-slate-600"
                        whileHover={{
                          x: 4,
                          backgroundColor: "rgba(99, 102, 241, 0.05)",
                        }}
                        whileTap={{ scale: 0.98 }}
                      >
                        🛠️ Tools
                      </motion.button>
                    )}

                    <motion.button
                      variants={menuItemVariants}
                      onClick={handleChangePassword}
                      className="w-full px-3 md:px-4 py-1.5 md:py-2 text-left text-xs md:text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium flex items-center gap-2 dark:text-dark-text dark:hover:bg-slate-700 dark:active:bg-slate-600"
                      whileHover={{
                        x: 4,
                        backgroundColor: "rgba(99, 102, 241, 0.05)",
                      }}
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
          document.body,
        )}

      {/* Change Password Modal */}
      <AnimatePresence>
        {showChangePasswordModal && (
          <ChangePasswordModal
            onClose={() => setShowChangePasswordModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        notifications={notifications.notifications}
        loading={notifications.notificationLoading}
        hasMoreNotifications={notifications.hasMoreNotifications}
        isScopedCustomer={isScopedCustomer}
        isClearing={notifications.isClearing}
        deletingNotificationId={notifications.deletingNotificationId}
        swipedNotificationId={notifications.swipedNotificationId}
        onDelete={notifications.deleteNotification}
        onClearAll={notifications.clearAllNotifications}
        onLoadMore={notifications.loadMoreNotifications}
        onSwipe={(id, dir) => {
          notifications.setSwipedNotificationId(id);
          notifications.setSwipeDirection(dir);
        }}
        error={notifications.notificationError}
        onRetry={async () => {
          try {
            await notifications.fetchNotifications(true);
          } catch (err) {
            console.error("Retry failed", err);
          }
        }}
      />

      {/* Tools Modal */}
      <ToolsModal
        isOpen={showToolsModal}
        onClose={() => setShowToolsModal(false)}
        onNavigateToTrash={handleNavigateToTrash}
        onStartBackup={handleStartBackup}
        backupDisabled={backup.backupRunning}
      />

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
      />

      {/* Profile Panel Modal */}
      <ProfilePanelModal
        isOpen={showProfilePanel}
        onClose={() => setShowProfilePanel(false)}
        userEmail={userEmail}
        isScopedCustomer={isScopedCustomer}
        customerDetails={customerDetails}
        adminNameFromMeta={adminNameFromMeta}
        stationName={profileEditing.stationName}
        isEditingStation={profileEditing.isEditingStation}
        isSavingStation={profileEditing.isSavingStation}
        setStationName={profileEditing.setStationName}
        setIsEditingStation={profileEditing.setIsEditingStation}
        onSaveStation={profileEditing.saveStation}
        adminName={profileEditing.adminName}
        isEditingAdminName={profileEditing.isEditingAdminName}
        isSavingAdminName={profileEditing.isSavingAdminName}
        setAdminName={profileEditing.setAdminName}
        setIsEditingAdminName={profileEditing.setIsEditingAdminName}
        onSaveAdminName={profileEditing.saveAdminName}
      />

      {/* Backup Progress Modal */}
      <BackupProgressModal
        isOpen={backup.backupRunning}
        theme={theme}
        backupProgress={backup.backupProgress}
        backupCurrentStep={backup.backupCurrentStep}
        backupElapsed={backup.backupElapsed}
        backupRunId={backup.backupRunId}
        backupCancelling={backup.backupCancelling}
        backupGitHubUrl={backup.backupGitHubUrl}
        backupArtifacts={backup.backupArtifacts}
        backupDownloading={backup.backupDownloading}
        onCancel={backup.cancelBackup}
        onDownload={backup.downloadArtifact}
        onClose={backup.closeBackup}
      />
    </>
  );
});

ProfileHeader.displayName = "ProfileHeader";

export default ProfileHeader;
