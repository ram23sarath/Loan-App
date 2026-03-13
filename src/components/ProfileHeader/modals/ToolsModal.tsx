import React, { useState } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";
import type { Document } from "../../../types";

type ToolsView =
  | "menu"
  | "createUser"
  | "changeUserPassword"
  | "userStatus"
  | "manageDocuments"
  | "syncCustomers"
  | "admins";

interface ToolsModalProps {
  session: Session | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTrash: () => void;
  onStartBackup: () => void;
  backupDisabled: boolean;
}

interface AdminUserRecord {
  uid: string;
  name: string;
  email: string;
  role: string;
}

interface AdminUsersResponse {
  success: boolean;
  admins: AdminUserRecord[];
  is_super_admin?: boolean;
  super_admin_uid?: string;
  error?: string;
}

export interface UserStatusCustomer {
  id: string;
  name: string;
  phone: string;
  expectedEmail?: string;
  existingAuthId?: string | null;
  orphanedUserId?: string;
}

export interface UserStatusData {
  summary: {
    totalCustomers: number;
    totalAuthUsers: number;
    healthy: number;
    missingUserId: number;
    orphanedUserId: number;
  };
  customersWithoutUserId: UserStatusCustomer[];
  customersWithOrphanedUserId: UserStatusCustomer[];
  timestamp: string;
}

export interface SyncMismatchEntry {
  customerName: string;
  customerPhone: string;
  currentEmail: string;
  expectedEmail: string;
  newPassword?: string;
  error?: string;
}

export interface SyncResultData {
  summary: {
    totalCustomersChecked: number;
    totalAuthUsers: number;
    mismatches: number;
    updated: number;
    errors: number;
    skipped: number;
  };
  mismatches: SyncMismatchEntry[];
  updated: SyncMismatchEntry[];
  errors: SyncMismatchEntry[];
  message: string;
}

const ToolsModal: React.FC<ToolsModalProps> = ({
  session,
  isOpen,
  onClose,
  onNavigateToTrash,
  onStartBackup,
  backupDisabled,
}) => {
  const navigate = useNavigate();
  const uiSuperAdminUid = import.meta.env.VITE_SUPER_ADMIN_UID?.trim() || "";
  const uiIsSuperAdmin = Boolean(
    uiSuperAdminUid && session?.user?.id === uiSuperAdminUid,
  );
  const sessionRole = String(session?.user?.app_metadata?.role || "").toLowerCase();
  const sessionIsSuperAdmin = sessionRole === "super_admin";

  const [toolsView, setToolsView] = useState<ToolsView>("menu");
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsMessage, setToolsMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Create User form state
  const [createUserEmail, setCreateUserEmail] = useState("");
  const [createUserPassword, setCreateUserPassword] = useState("");
  const [createUserName, setCreateUserName] = useState("");
  const [createUserPhone, setCreateUserPhone] = useState("");
  const [createUserIsAdmin, setCreateUserIsAdmin] = useState(false);

  // Change Password form state
  const [changePasswordEmail, setChangePasswordEmail] = useState("");
  const [changePasswordNew, setChangePasswordNew] = useState("");

  // User Status state
  const [userStatusData, setUserStatusData] = useState<UserStatusData | null>(
    null,
  );
  const [userStatusLoading, setUserStatusLoading] = useState(false);
  const [userStatusError, setUserStatusError] = useState<string | null>(null);
  const [fixingUserId, setFixingUserId] = useState<string | null>(null);
  const [expandMissing, setExpandMissing] = useState(true);
  const [expandOrphaned, setExpandOrphaned] = useState(true);

  // Document management state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // Sync Customers state
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncPhase, setSyncPhase] = useState<"confirm" | "syncing" | "results">(
    "confirm",
  );
  const [syncResult, setSyncResult] = useState<SyncResultData | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [expandSyncUpdated, setExpandSyncUpdated] = useState(true);
  const [expandSyncErrors, setExpandSyncErrors] = useState(true);

  // Admins state
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminsError, setAdminsError] = useState<string | null>(null);
  const [adminList, setAdminList] = useState<AdminUserRecord[]>([]);
  const [serverIsSuperAdmin, setServerIsSuperAdmin] = useState(false);

  const canAccessAdminTools = uiIsSuperAdmin || sessionIsSuperAdmin || serverIsSuperAdmin;

  // Reset state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setToolsLoading(false);
      setToolsView("menu");
      setToolsMessage(null);
      setCreateUserEmail("");
      setCreateUserPassword("");
      setCreateUserName("");
      setCreateUserPhone("");
      setCreateUserIsAdmin(false);
      setChangePasswordEmail("");
      setChangePasswordNew("");
      setUserStatusData(null);
      setUserStatusLoading(false);
      setUserStatusError(null);
      setFixingUserId(null);
      setExpandMissing(true);
      setExpandOrphaned(true);
      setDocuments([]);
      setDocumentsLoading(false);
      setSelectedFile(null);
      setUploadProgress(0);
      setDeletingDocId(null);
      setSyncProgress(0);
      setSyncPhase("confirm");
      setSyncResult(null);
      setSyncError(null);
      setExpandSyncUpdated(true);
      setExpandSyncErrors(true);
      setAdminsLoading(false);
      setAdminsError(null);
      setAdminList([]);
      setServerIsSuperAdmin(false);
    }
  }, [isOpen]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setToolsLoading(true);
    setToolsMessage(null);
    try {
      const email = createUserIsAdmin
        ? createUserEmail
        : `${createUserPhone}@gmail.com`;
      const password = createUserIsAdmin ? createUserPassword : createUserPhone;

      const response = await fetch("/.netlify/functions/create-auth-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: createUserName,
          phone: createUserIsAdmin ? "" : createUserPhone,
          isAdmin: createUserIsAdmin,
        }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        const userType = createUserIsAdmin ? "Admin user" : "Scoped user";
        const loginInfo = createUserIsAdmin
          ? `Email: ${createUserEmail}`
          : `Email: ${createUserPhone}@gmail.com\nPassword: ${createUserPhone}`;
        setToolsMessage({
          type: "success",
          text: `${userType} created successfully!\n${loginInfo}`,
        });
        setCreateUserEmail("");
        setCreateUserPassword("");
        setCreateUserName("");
        setCreateUserPhone("");
        setCreateUserIsAdmin(false);
      } else {
        setToolsMessage({
          type: "error",
          text: result.error || "Failed to create user",
        });
      }
    } catch (err: any) {
      setToolsMessage({
        type: "error",
        text: err.message || "An error occurred",
      });
    } finally {
      setToolsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setToolsLoading(true);
    setToolsMessage(null);
    try {
      const response = await fetch(
        "/.netlify/functions/reset-customer-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: changePasswordEmail,
            new_password: changePasswordNew,
          }),
        },
      );
      const result = await response.json();
      if (response.ok && result.success) {
        setToolsMessage({
          type: "success",
          text: "Password changed successfully!",
        });
        setChangePasswordEmail("");
        setChangePasswordNew("");
      } else {
        const errorMsg = result.details
          ? `${result.error}\n\n${result.details}`
          : result.error || "Failed to change password";
        setToolsMessage({ type: "error", text: errorMsg });
      }
    } catch (err: any) {
      setToolsMessage({
        type: "error",
        text: err.message || "An error occurred",
      });
    } finally {
      setToolsLoading(false);
    }
  };

  const fetchUserStatus = async () => {
    setUserStatusLoading(true);
    setUserStatusError(null);
    try {
      const response = await fetch("/.netlify/functions/compare-users");
      const result = await response.json();
      if (response.ok && result.success) {
        setUserStatusData(result);
      } else {
        setUserStatusError(result.error || "Failed to fetch user status");
      }
    } catch (err: any) {
      setUserStatusError(err.message || "An error occurred");
    } finally {
      setUserStatusLoading(false);
    }
  };

  const handleFixMissingUser = async (customer: UserStatusCustomer) => {
    setFixingUserId(customer.id);
    try {
      const response = await fetch(
        "/.netlify/functions/create-user-from-customer",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_id: customer.id,
            name: customer.name,
            phone: customer.phone,
          }),
        },
      );
      const result = await response.json();
      if (response.ok && result.success) {
        await fetchUserStatus();
      } else {
        setUserStatusError(
          `Failed to create user for ${customer.name}: ${result.error}`,
        );
      }
    } catch (err: any) {
      setUserStatusError(err.message || "An error occurred");
    } finally {
      setFixingUserId(null);
    }
  };

  const handleSyncCustomers = async () => {
    setSyncPhase("syncing");
    setSyncProgress(10);
    setSyncError(null);
    setSyncResult(null);

    let progressTimer1: NodeJS.Timeout | null = null;

    try {
      progressTimer1 = setTimeout(() => setSyncProgress(30), 800);

      const response = await fetch("/.netlify/functions/sync-customer-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });

      setSyncProgress(70);

      const resultText = await response.text();
      let result: any = {};
      try {
        result = JSON.parse(resultText);
      } catch {
        result = {
          error: resultText || "Received non-JSON response from sync endpoint",
          message: resultText || "Received non-JSON response from sync endpoint",
        };
      }

      setSyncProgress(90);
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (response.ok && result && result.success) {
        setSyncProgress(100);
        setSyncResult(result as SyncResultData);
        await new Promise((resolve) => setTimeout(resolve, 500));
        setSyncPhase("results");
      } else {
        const errMsg =
          (result && (result.error || result.message)) ||
          resultText ||
          "Sync failed";
        setSyncError(String(errMsg));
        setSyncPhase("results");
      }
    } catch (err: any) {
      setSyncError(err.message || "An error occurred while syncing");
      setSyncPhase("results");
    } finally {
      if (progressTimer1 !== null) {
        clearTimeout(progressTimer1);
      }
      setSyncProgress(0);
    }
  };

  const fetchAdmins = async () => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      setAdminsError("Missing session token. Please sign in again.");
      return;
    }

    setAdminsLoading(true);
    setAdminsError(null);
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      };

      const response = await fetch(
        `/.netlify/functions/get-admin-users`,
        { method: "GET", headers },
      );
      const result = (await response.json()) as AdminUsersResponse;

      if (response.ok && result.success) {
        setServerIsSuperAdmin(Boolean(result.is_super_admin));
        setAdminList(result.admins || []);
      } else {
        if (response.status === 401 || response.status === 403) {
          setServerIsSuperAdmin(false);
        }
        setAdminsError(result.error || "Failed to load admins");
      }
    } catch (err: any) {
      setAdminsError(err.message || "Failed to load admins");
    } finally {
      setAdminsLoading(false);
    }
  };

  const fetchDocuments = async () => {
    setDocumentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err: any) {
      setToolsMessage({
        type: "error",
        text: `Failed to load documents: ${err.message}`,
      });
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedFile) return;

    setUploadProgress(10);
    setToolsMessage(null);

    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${selectedFile.name}`;
      const filePath = `documents/${fileName}`;

      setUploadProgress(30);

      const { error: uploadError } = await supabase.storage
        .from("public-documents")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      setUploadProgress(50);

      const { error: dbError } = await supabase.from("documents").insert({
        name: selectedFile.name,
        file_path: filePath,
        file_size: selectedFile.size,
        uploaded_by: "admin",
      });

      if (dbError) {
        setUploadProgress(40);
        const { error: cleanupError } = await supabase.storage
          .from("public-documents")
          .remove([filePath]);

        if (cleanupError) {
          throw new Error(
            `Upload succeeded but database insert failed (${dbError.message}). Rollback cleanup also failed (${cleanupError.message}).`,
          );
        }

        throw new Error(
          `Database insert failed and uploaded file was rolled back: ${dbError.message}`,
        );
      }

      setUploadProgress(70);

      setUploadProgress(100);
      setToolsMessage({
        type: "success",
        text: `"${selectedFile.name}" uploaded successfully!`,
      });
      setSelectedFile(null);

      await fetchDocuments();
    } catch (err: any) {
      setToolsMessage({ type: "error", text: `Upload failed: ${err.message}` });
    } finally {
      setUploadProgress(0);
    }
  };

  const handleDeleteDocument = async (doc: Document) => {
    const originalDocRecord = { ...doc };
    setDeletingDocId(doc.id);
    try {
      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .eq("id", doc.id);

      if (dbError) throw dbError;

      const { error: storageError } = await supabase.storage
        .from("public-documents")
        .remove([doc.file_path]);

      if (storageError) {
        const { error: rollbackError } = await supabase
          .from("documents")
          .insert(originalDocRecord as any);

        if (rollbackError) {
          throw new Error(
            `Document record deleted, but file removal failed (${storageError.message}) and DB rollback failed (${rollbackError.message}).`,
          );
        }

        throw new Error(
          `File removal failed (${storageError.message}). Document record was restored; please retry.`,
        );
      }

      setToolsMessage({
        type: "success",
        text: `"${doc.name}" deleted successfully!`,
      });
      await fetchDocuments();
    } catch (err: any) {
      setToolsMessage({ type: "error", text: `Delete failed: ${err.message}` });
    } finally {
      setDeletingDocId(null);
    }
  };

  // Reusable UI Components
  const renderBackButton = () => (
    <motion.button
      onClick={() => setToolsView("menu")}
      className="flex items-center justify-center w-10 h-10 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full transition-colors"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19l-7-7 7-7"
        />
      </svg>
    </motion.button>
  );

  const renderAlert = () => (
    <AnimatePresence>
      {toolsMessage && (
        <motion.div
          className={`mb-6 p-4 rounded-2xl text-sm font-medium border flex items-start gap-3 shadow-sm ${
            toolsMessage.type === "success"
              ? "bg-green-50/80 border-green-200 text-green-800 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400"
              : "bg-red-50/80 border-red-200 text-red-800 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400"
          }`}
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <span className="text-lg mt-0.5">
            {toolsMessage.type === "success" ? "✅" : "⚠️"}
          </span>
          <span className="whitespace-pre-wrap leading-relaxed">
            {toolsMessage.text}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof window === "undefined") return null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="tools-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-md px-4 sm:px-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-white dark:bg-[#0f172a] rounded-[2rem] shadow-2xl shadow-slate-900/20 border border-slate-200 dark:border-slate-800 p-6 md:p-8 w-full max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden scrollbar-hide"
            onClick={(e) => e.stopPropagation()}
          >
          <AnimatePresence mode="wait">
            {/* Main Menu */}
            {toolsView === "menu" && (
              <motion.div
                key="tools-menu"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                    <span className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300">
                      🛠️
                    </span>
                    Admin Tools
                  </h2>
                  <motion.button
                    onClick={onClose}
                    className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 rounded-full transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </motion.button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Create User */}
                  <motion.button
                    onClick={() => {
                      setToolsView("createUser");
                      setToolsMessage(null);
                    }}
                    className="group relative w-full p-4 bg-white dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 border border-slate-200 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-500/50 rounded-2xl transition-all duration-300 flex items-start gap-4 shadow-sm hover:shadow-md text-left"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 rounded-xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                      👤
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white tracking-tight">
                        Create User
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        Create a new auth user account
                      </div>
                    </div>
                  </motion.button>

                  {/* Change Password */}
                  <motion.button
                    onClick={() => {
                      setToolsView("changeUserPassword");
                      setToolsMessage(null);
                    }}
                    className="group relative w-full p-4 bg-white dark:bg-slate-800/50 hover:bg-amber-50 dark:hover:bg-amber-500/10 border border-slate-200 dark:border-slate-700/80 hover:border-amber-300 dark:hover:border-amber-500/50 rounded-2xl transition-all duration-300 flex items-start gap-4 shadow-sm hover:shadow-md text-left"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex-shrink-0 w-12 h-12 bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 rounded-xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                      🔑
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white tracking-tight">
                        Reset Password
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        Change password for any user
                      </div>
                    </div>
                  </motion.button>

                  {/* User Status */}
                  <motion.button
                    onClick={() => {
                      setToolsView("userStatus");
                      setToolsMessage(null);
                      fetchUserStatus();
                    }}
                    className="group relative w-full p-4 bg-white dark:bg-slate-800/50 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 border border-slate-200 dark:border-slate-700/80 hover:border-cyan-300 dark:hover:border-cyan-500/50 rounded-2xl transition-all duration-300 flex items-start gap-4 shadow-sm hover:shadow-md text-left"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex-shrink-0 w-12 h-12 bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 rounded-xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                      📊
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white tracking-tight">
                        User Status
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        Check customer account health
                      </div>
                    </div>
                  </motion.button>

                  {/* Sync Customers */}
                  <motion.button
                    onClick={() => {
                      setToolsView("syncCustomers");
                      setToolsMessage(null);
                      setSyncPhase("confirm");
                      setSyncResult(null);
                      setSyncError(null);
                    }}
                    className="group relative w-full p-4 bg-white dark:bg-slate-800/50 hover:bg-sky-50 dark:hover:bg-sky-500/10 border border-slate-200 dark:border-slate-700/80 hover:border-sky-300 dark:hover:border-sky-500/50 rounded-2xl transition-all duration-300 flex items-start gap-4 shadow-sm hover:shadow-md text-left"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex-shrink-0 w-12 h-12 bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 rounded-xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                      🔄
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white tracking-tight">
                        Sync to Auth
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        Bulk update auth emails
                      </div>
                    </div>
                  </motion.button>

                  {/* Manage Documents */}
                  <motion.button
                    onClick={() => {
                      setToolsView("manageDocuments");
                      setToolsMessage(null);
                      fetchDocuments();
                    }}
                    className="group relative w-full p-4 bg-white dark:bg-slate-800/50 hover:bg-violet-50 dark:hover:bg-violet-500/10 border border-slate-200 dark:border-slate-700/80 hover:border-violet-300 dark:hover:border-violet-500/50 rounded-2xl transition-all duration-300 flex items-start gap-4 shadow-sm hover:shadow-md text-left sm:col-span-2"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex-shrink-0 w-12 h-12 bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 rounded-xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                      📄
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white tracking-tight">
                        Manage Documents
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        Upload and organize global PDFs for all customers
                      </div>
                    </div>
                  </motion.button>

                  {canAccessAdminTools && (
                    <>
                      <motion.button
                        onClick={() => {
                          onClose();
                          setToolsMessage(null);
                          navigate("/audit-log");
                        }}
                        className="group relative w-full p-4 bg-white dark:bg-slate-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 border border-slate-200 dark:border-slate-700/80 hover:border-emerald-300 dark:hover:border-emerald-500/50 rounded-2xl transition-all duration-300 flex items-start gap-4 shadow-sm hover:shadow-md text-left"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex-shrink-0 w-12 h-12 bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                          🧾
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white tracking-tight">
                            Audit Log
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                            Open full-page transaction history
                          </div>
                        </div>
                      </motion.button>

                      <motion.button
                        onClick={() => {
                          setToolsView("admins");
                          setToolsMessage(null);
                          fetchAdmins();
                        }}
                        className="group relative w-full p-4 bg-white dark:bg-slate-800/50 hover:bg-lime-50 dark:hover:bg-lime-500/10 border border-slate-200 dark:border-slate-700/80 hover:border-lime-300 dark:hover:border-lime-500/50 rounded-2xl transition-all duration-300 flex items-start gap-4 shadow-sm hover:shadow-md text-left"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex-shrink-0 w-12 h-12 bg-lime-100 text-lime-600 dark:bg-lime-500/20 dark:text-lime-400 rounded-xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                          🛡️
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white tracking-tight">
                            Admins
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                            Super-admin allowlist and discovered admins
                          </div>
                        </div>
                      </motion.button>
                    </>
                  )}

                  <div className="col-span-1 sm:col-span-2 h-px bg-slate-200 dark:bg-slate-800 my-2"></div>

                  {/* Backup */}
                  <motion.button
                    onClick={() => {
                      onClose();
                      onStartBackup();
                    }}
                    disabled={backupDisabled}
                    className="group relative w-full p-4 bg-gradient-to-br from-green-50 to-white dark:from-green-500/10 dark:to-slate-800/50 border border-green-200 dark:border-green-500/20 hover:border-green-400 rounded-2xl transition-all duration-300 flex items-start gap-4 shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed text-left"
                    whileHover={!backupDisabled ? { y: -2 } : {}}
                    whileTap={!backupDisabled ? { scale: 0.98 } : {}}
                  >
                    <div className="flex-shrink-0 w-12 h-12 bg-white dark:bg-slate-800 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-500/20 rounded-xl flex items-center justify-center text-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                      💾
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white tracking-tight">
                        Backup Database
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        Trigger a fresh DB backup to Google Drive
                      </div>
                    </div>
                  </motion.button>

                  {/* Trash */}
                  <motion.button
                    onClick={() => {
                      onClose();
                      onNavigateToTrash();
                    }}
                    className="group relative w-full p-4 bg-gradient-to-br from-rose-50 to-white dark:from-rose-500/10 dark:to-slate-800/50 border border-rose-200 dark:border-rose-500/20 hover:border-rose-400 rounded-2xl transition-all duration-300 flex items-start gap-4 shadow-sm hover:shadow-md text-left"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex-shrink-0 w-12 h-12 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20 rounded-xl flex items-center justify-center text-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                      🗑️
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white tracking-tight">
                        Trash Bin
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        View and restore soft-deleted items
                      </div>
                    </div>
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Create User Form */}
            {toolsView === "createUser" && (
              <motion.div
                key="tools-create-user"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <div className="flex items-center gap-4 mb-8">
                  {renderBackButton()}
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Create User
                  </h2>
                </div>

                {renderAlert()}

                <form onSubmit={handleCreateUser} className="space-y-5">
                  {/* Admin Toggle Card */}
                  <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl">
                    <div>
                      <label className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        Admin Privileges
                      </label>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {createUserIsAdmin
                          ? "Full access to all system data"
                          : "Scoped only to their data"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreateUserIsAdmin(!createUserIsAdmin)}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 shadow-inner ${createUserIsAdmin ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"}`}
                    >
                      <span className="sr-only">Toggle Admin</span>
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-300 ease-in-out ${createUserIsAdmin ? "translate-x-8" : "translate-x-1"}`}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Display Name{" "}
                      {!createUserIsAdmin && (
                        <span className="text-rose-500">*</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={createUserName}
                      onChange={(e) => setCreateUserName(e.target.value)}
                      required={!createUserIsAdmin}
                      placeholder="e.g. John Doe"
                      className="w-full px-4 py-3.5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 shadow-sm outline-none"
                    />
                  </div>

                  <AnimatePresence mode="popLayout">
                    {createUserIsAdmin ? (
                      <motion.div
                        key="admin-fields"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-5"
                      >
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Admin Email <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="email"
                            value={createUserEmail}
                            onChange={(e) => setCreateUserEmail(e.target.value)}
                            required
                            placeholder="admin@example.com"
                            className="w-full px-4 py-3.5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 shadow-sm outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Password <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="password"
                            value={createUserPassword}
                            onChange={(e) =>
                              setCreateUserPassword(e.target.value)
                            }
                            required
                            minLength={6}
                            placeholder="Minimum 6 characters"
                            className="w-full px-4 py-3.5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 shadow-sm outline-none"
                          />
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="scoped-fields"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-5"
                      >
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Phone Number{" "}
                            <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="tel"
                            value={createUserPhone}
                            onChange={(e) =>
                              setCreateUserPhone(
                                e.target.value.replace(/\D/g, "").slice(0, 10),
                              )
                            }
                            required
                            maxLength={10}
                            placeholder="10-digit number"
                            className={`w-full px-4 py-3.5 bg-white dark:bg-slate-900/50 border ${createUserPhone && createUserPhone.length !== 10 ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10" : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/10"} rounded-xl focus:ring-4 transition-all text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 shadow-sm outline-none`}
                          />
                          {createUserPhone && createUserPhone.length !== 10 && (
                            <p className="text-xs text-rose-500 mt-2 font-medium">
                              Phone number must be exactly 10 digits.
                            </p>
                          )}
                        </div>
                        <div className="p-4 bg-sky-50 dark:bg-sky-500/10 border border-sky-100 dark:border-sky-500/20 rounded-xl">
                          <div className="flex items-start gap-3">
                            <span className="text-sky-600 dark:text-sky-400 mt-0.5">
                              ℹ️
                            </span>
                            <div className="text-xs text-sky-800 dark:text-sky-300 leading-relaxed">
                              <strong>Login Credentials Generated:</strong>
                              <br />
                              Email:{" "}
                              <span className="font-mono bg-sky-100 dark:bg-sky-900/50 px-1 py-0.5 rounded">
                                {createUserPhone || "phone"}@gmail.com
                              </span>
                              <br />
                              Password:{" "}
                              <span className="font-mono bg-sky-100 dark:bg-sky-900/50 px-1 py-0.5 rounded">
                                {createUserPhone || "phone"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={
                        toolsLoading ||
                        (!createUserIsAdmin && createUserPhone.length !== 10)
                      }
                      className="relative w-full h-12 flex items-center justify-center text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none overflow-hidden"
                    >
                      {toolsLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : createUserIsAdmin ? (
                        "Create Admin User"
                      ) : (
                        "Create Scoped User"
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* Change User Password Form */}
            {toolsView === "changeUserPassword" && (
              <motion.div
                key="tools-change-password"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <div className="flex items-center gap-4 mb-8">
                  {renderBackButton()}
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Reset Password
                  </h2>
                </div>

                {renderAlert()}

                <form onSubmit={handleChangePassword} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      User Email
                    </label>
                    <input
                      type="email"
                      value={changePasswordEmail}
                      onChange={(e) => setChangePasswordEmail(e.target.value)}
                      required
                      placeholder="user@example.com"
                      className="w-full px-4 py-3.5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 shadow-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={changePasswordNew}
                      onChange={(e) => setChangePasswordNew(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                      className="w-full px-4 py-3.5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 shadow-sm outline-none"
                    />
                  </div>
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={toolsLoading}
                      className="relative w-full h-12 flex items-center justify-center text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 rounded-xl shadow-lg shadow-amber-500/25 transition-all active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
                    >
                      {toolsLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        "Update Password"
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* User Status Dashboard */}
            {toolsView === "userStatus" && (
              <motion.div
                key="tools-user-status"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    {renderBackButton()}
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      Account Status
                    </h2>
                  </div>
                  <motion.button
                    onClick={fetchUserStatus}
                    disabled={userStatusLoading}
                    className="w-10 h-10 flex items-center justify-center bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-full transition-colors hover:bg-cyan-100 dark:hover:bg-cyan-500/20 disabled:opacity-50"
                    whileTap={{ scale: 0.9 }}
                    title="Refresh"
                  >
                    <svg
                      className={`w-5 h-5 ${userStatusLoading ? "animate-spin" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </motion.button>
                </div>

                {userStatusError && (
                  <div className="mb-6 p-4 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 text-sm font-medium border border-rose-200 dark:border-rose-500/20">
                    {userStatusError}
                  </div>
                )}

                {userStatusLoading && !userStatusData && (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-10 h-10 border-4 border-slate-100 dark:border-slate-800 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      Analyzing accounts...
                    </p>
                  </div>
                )}

                {userStatusData && (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-center shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-green-500"></div>
                        <div className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                          {userStatusData.summary.healthy}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider font-bold text-green-600 dark:text-green-400 mt-1 flex items-center justify-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>{" "}
                          Valid
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-center shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400"></div>
                        <div className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                          {userStatusData.summary.missingUserId}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center justify-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>{" "}
                          Missing
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-center shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500"></div>
                        <div className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                          {userStatusData.summary.orphanedUserId}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider font-bold text-rose-600 dark:text-rose-400 mt-1 flex items-center justify-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>{" "}
                          Orphaned
                        </div>
                      </div>
                    </div>

                    <div className="text-xs font-medium text-slate-400 dark:text-slate-500 text-center uppercase tracking-wider">
                      {userStatusData.summary.totalCustomers} Customers Total
                    </div>

                    {/* Missing Users Section */}
                    {userStatusData.customersWithoutUserId.length > 0 && (
                      <div className="border border-amber-200 dark:border-amber-500/20 bg-white dark:bg-slate-800/30 rounded-2xl overflow-hidden shadow-sm">
                        <button
                          onClick={() => setExpandMissing(!expandMissing)}
                          className="w-full px-5 py-4 bg-amber-50/50 dark:bg-amber-500/5 hover:bg-amber-50 dark:hover:bg-amber-500/10 flex items-center justify-between transition-colors"
                        >
                          <span className="text-sm font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2">
                            ⚠️ Missing Auth Account (
                            {userStatusData.customersWithoutUserId.length})
                          </span>
                          <svg
                            className={`w-5 h-5 text-amber-600 transition-transform ${expandMissing ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                        <AnimatePresence>
                          {expandMissing && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: "auto" }}
                              exit={{ height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50 p-2">
                                {userStatusData.customersWithoutUserId.map(
                                  (customer) => (
                                    <div
                                      key={customer.id}
                                      className="p-3 flex items-center justify-between rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                                    >
                                      <div className="flex-1 min-w-0 pr-4">
                                        <div className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
                                          {customer.name}
                                        </div>
                                        <div className="text-xs font-medium text-slate-500 mt-0.5">
                                          {customer.phone}
                                        </div>
                                      </div>
                                      <button
                                        onClick={() =>
                                          handleFixMissingUser(customer)
                                        }
                                        disabled={fixingUserId === customer.id}
                                        className="flex-shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-transform active:scale-95 disabled:opacity-50"
                                      >
                                        {fixingUserId === customer.id
                                          ? "Fixing..."
                                          : "Create"}
                                      </button>
                                    </div>
                                  ),
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Orphaned Users Section */}
                    {userStatusData.customersWithOrphanedUserId.length > 0 && (
                      <div className="border border-rose-200 dark:border-rose-500/20 bg-white dark:bg-slate-800/30 rounded-2xl overflow-hidden shadow-sm">
                        <button
                          onClick={() => setExpandOrphaned(!expandOrphaned)}
                          className="w-full px-5 py-4 bg-rose-50/50 dark:bg-rose-500/5 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-between transition-colors"
                        >
                          <span className="text-sm font-bold text-rose-800 dark:text-rose-400 flex items-center gap-2">
                            ❌ Orphaned Account (
                            {userStatusData.customersWithOrphanedUserId.length})
                          </span>
                          <svg
                            className={`w-5 h-5 text-rose-600 transition-transform ${expandOrphaned ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                        <AnimatePresence>
                          {expandOrphaned && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: "auto" }}
                              exit={{ height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50 p-2">
                                {userStatusData.customersWithOrphanedUserId.map(
                                  (customer) => (
                                    <div
                                      key={customer.id}
                                      className="p-3 flex items-center justify-between rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                                    >
                                      <div className="flex-1 min-w-0 pr-4">
                                        <div className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
                                          {customer.name}
                                        </div>
                                        <div className="text-xs font-medium text-slate-500 mt-0.5">
                                          {customer.phone}
                                        </div>
                                      </div>
                                      <button
                                        onClick={() =>
                                          handleFixMissingUser(customer)
                                        }
                                        disabled={fixingUserId === customer.id}
                                        className="flex-shrink-0 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-transform active:scale-95 disabled:opacity-50"
                                      >
                                        {fixingUserId === customer.id
                                          ? "Fixing..."
                                          : "Recreate"}
                                      </button>
                                    </div>
                                  ),
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {userStatusData.summary.missingUserId === 0 &&
                      userStatusData.summary.orphanedUserId === 0 && (
                        <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                          <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 text-green-500 dark:text-green-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                            ✨
                          </div>
                          <div className="text-slate-800 dark:text-slate-200 font-bold">
                            System is Healthy
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            All customers have valid linked accounts.
                          </p>
                        </div>
                      )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Admins View */}
            {toolsView === "admins" && (
              <motion.div
                key="tools-admins"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    {renderBackButton()}
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      Admins
                    </h2>
                  </div>
                  <motion.button
                    onClick={fetchAdmins}
                    disabled={adminsLoading || !canAccessAdminTools}
                    className="w-10 h-10 flex items-center justify-center bg-lime-50 dark:bg-lime-500/10 text-lime-600 dark:text-lime-400 rounded-full transition-colors hover:bg-lime-100 dark:hover:bg-lime-500/20 disabled:opacity-50"
                    whileTap={{ scale: 0.9 }}
                    title="Refresh"
                  >
                    <svg
                      className={`w-5 h-5 ${adminsLoading ? "animate-spin" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </motion.button>
                </div>

                {!canAccessAdminTools && (
                  <div className="mb-4 p-4 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 text-sm font-medium border border-rose-200 dark:border-rose-500/20">
                    Access denied. This view is available only to the super admin.
                  </div>
                )}

                {canAccessAdminTools && (
                  <>
                    <div className="mb-4 p-4 rounded-xl bg-lime-50 dark:bg-lime-500/10 border border-lime-200 dark:border-lime-500/20 text-xs text-lime-800 dark:text-lime-300">
                      This list shows current admins from the database.
                    </div>

                    {adminsError && (
                      <div className="mb-4 p-4 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 text-sm font-medium border border-rose-200 dark:border-rose-500/20">
                        {adminsError}
                      </div>
                    )}

                    {adminsLoading && adminList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="w-10 h-10 border-4 border-slate-100 dark:border-slate-800 border-t-lime-500 rounded-full animate-spin mb-4"></div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          Loading admins...
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(adminList || []).map((admin) => (
                          <div
                            key={admin.uid}
                            className="p-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl"
                          >
                            <div className="text-sm font-semibold text-slate-900 dark:text-white break-all">
                              {admin.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-all">
                              {admin.email}
                            </div>
                            <div className="text-[11px] text-lime-700 dark:text-lime-400 mt-1 uppercase tracking-wider font-semibold">
                              {admin.role}
                            </div>
                          </div>
                        ))}
                        {adminList.length === 0 && (
                          <div className="p-4 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-700">
                            No admin users found.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* Manage Documents View */}
            {toolsView === "manageDocuments" && (
              <motion.div
                key="tools-manage-docs"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col h-full"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    {renderBackButton()}
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      Documents
                    </h2>
                  </div>
                  <motion.button
                    onClick={fetchDocuments}
                    disabled={documentsLoading}
                    className="w-10 h-10 flex items-center justify-center bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-full transition-colors hover:bg-violet-100 dark:hover:bg-violet-500/20 disabled:opacity-50"
                    whileTap={{ scale: 0.9 }}
                  >
                    <svg
                      className={`w-5 h-5 ${documentsLoading ? "animate-spin" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </motion.button>
                </div>

                {renderAlert()}

                {/* Upload Section */}
                <div className="mb-8 relative overflow-hidden rounded-2xl border-2 border-dashed border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-500/5 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors group">
                  <label className="flex flex-col items-center justify-center p-8 cursor-pointer relative z-10 w-full h-full">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) =>
                        setSelectedFile(e.target.files?.[0] || null)
                      }
                      className="hidden"
                      disabled={uploadProgress > 0}
                    />
                    <div
                      className={`w-12 h-12 mb-3 rounded-full flex items-center justify-center text-xl transition-all ${selectedFile ? "bg-violet-500 text-white shadow-md shadow-violet-500/30" : "bg-white dark:bg-slate-800 text-violet-500 shadow-sm group-hover:scale-110"}`}
                    >
                      {selectedFile ? "📄" : "📁"}
                    </div>
                    <div className="font-bold text-sm text-violet-900 dark:text-violet-200 text-center">
                      {selectedFile ? selectedFile.name : "Click to select PDF"}
                    </div>
                    {selectedFile ? (
                      <div className="text-xs text-violet-600/80 dark:text-violet-400/80 font-medium mt-1">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </div>
                    ) : (
                      <div className="text-xs text-violet-600/60 dark:text-violet-400/60 font-medium mt-1">
                        PDF up to 10MB
                      </div>
                    )}
                  </label>

                  {/* Upload Progress background fill */}
                  {uploadProgress > 0 && (
                    <motion.div
                      className="absolute bottom-0 left-0 h-full bg-violet-200 dark:bg-violet-900/50 z-0 origin-left"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ ease: "linear", duration: 0.2 }}
                    />
                  )}
                </div>

                {selectedFile && uploadProgress === 0 && (
                  <motion.button
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={handleUploadDocument}
                    className="mb-8 w-full py-3.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-violet-500/25 transition-all active:scale-[0.98]"
                  >
                    Upload Document
                  </motion.button>
                )}

                {/* Documents List */}
                <div className="flex-1 flex flex-col min-h-0">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Uploaded Files ({documents.length})
                  </h3>

                  <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden flex-1 max-h-64">
                    {documentsLoading && documents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32">
                        <div className="w-8 h-8 border-4 border-slate-200 border-t-violet-500 rounded-full animate-spin"></div>
                      </div>
                    ) : documents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 text-slate-400 dark:text-slate-500">
                        <span className="text-3xl mb-2 opacity-50">📭</span>
                        <p className="text-sm font-medium">No documents yet</p>
                      </div>
                    ) : (
                      <div className="overflow-y-auto max-h-full p-2 divide-y divide-slate-100 dark:divide-slate-700/50">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl mb-1 last:mb-0 shadow-sm border border-slate-100 dark:border-slate-700 transition-colors"
                          >
                            <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center flex-shrink-0">
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
                                {doc.name}
                              </div>
                              <div className="text-[11px] font-medium text-slate-500 mt-0.5 uppercase tracking-wide">
                                {doc.file_size
                                  ? `${(doc.file_size / 1024).toFixed(1)} KB`
                                  : "Unknown"}{" "}
                                •{" "}
                                {new Date(doc.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteDocument(doc)}
                              disabled={deletingDocId === doc.id}
                              className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              {deletingDocId === doc.id ? (
                                <div className="w-4 h-4 border-2 border-slate-300 border-t-rose-500 rounded-full animate-spin"></div>
                              ) : (
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Sync Customers View */}
            {toolsView === "syncCustomers" && (
              <motion.div
                key="tools-sync-customers"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <div className="flex items-center gap-4 mb-8">
                  {syncPhase !== "syncing" && renderBackButton()}
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Sync Auth
                  </h2>
                </div>

                {/* Confirm Phase */}
                {syncPhase === "confirm" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6"
                  >
                    <div className="p-6 bg-sky-50 dark:bg-sky-500/5 border border-sky-100 dark:border-sky-500/20 rounded-2xl flex gap-4 text-left shadow-sm">
                      <div className="w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400 text-xl flex-shrink-0">
                        🔄
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">
                          Standardize Accounts
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                          This tool scans all customers and ensures their auth
                          accounts use the standardized format.
                        </p>
                        <div className="inline-block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-400">
                          <span className="text-sky-500">{"<phone>"}</span>
                          @gmail.com
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setToolsView("menu")}
                        className="flex-1 py-3.5 text-sm font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSyncCustomers}
                        className="flex-[2] py-3.5 text-sm font-bold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 rounded-xl shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98]"
                      >
                        Start Sync Process
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Syncing Phase */}
                {syncPhase === "syncing" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-12 flex flex-col items-center"
                  >
                    <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
                      <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-800 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-sky-500 rounded-full border-t-transparent animate-spin"></div>
                      <div className="text-2xl">⚡</div>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                      {syncProgress < 30
                        ? "Initializing..."
                        : syncProgress < 70
                          ? "Cross-referencing accounts..."
                          : syncProgress < 100
                            ? "Applying updates..."
                            : "Finalizing!"}
                    </h3>
                    <div className="w-full max-w-xs h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-6 mb-2">
                      <motion.div
                        className="h-full bg-gradient-to-r from-sky-400 to-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${syncProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                      {syncProgress}% Complete
                    </p>
                  </motion.div>
                )}

                {/* Results Phase */}
                {syncPhase === "results" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {syncError && (
                      <div className="p-4 bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 rounded-xl text-sm font-medium shadow-sm">
                        {syncError}
                      </div>
                    )}

                    {syncResult && (
                      <>
                        {syncResult.summary.mismatches === 0 ? (
                          <div className="text-center py-8 bg-green-50/50 dark:bg-green-500/5 border border-green-100 dark:border-green-500/20 rounded-2xl shadow-sm">
                            <div className="w-16 h-16 bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                              🎉
                            </div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">
                              Perfectly Synced!
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                              All {syncResult.summary.totalCustomersChecked}{" "}
                              accounts are up to date.
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="p-4 bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20 rounded-xl text-sm font-medium shadow-sm text-center">
                              {syncResult.message}
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700/50">
                                <div className="text-xl font-bold text-slate-800 dark:text-slate-200">
                                  {syncResult.summary.totalCustomersChecked}
                                </div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">
                                  Checked
                                </div>
                              </div>
                              <div className="bg-green-50 dark:bg-green-500/10 rounded-xl p-3 text-center border border-green-100 dark:border-green-500/20">
                                <div className="text-xl font-bold text-green-700 dark:text-green-400">
                                  {syncResult.summary.updated}
                                </div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-500 mt-1">
                                  Updated
                                </div>
                              </div>
                              <div className="bg-rose-50 dark:bg-rose-500/10 rounded-xl p-3 text-center border border-rose-100 dark:border-rose-500/20">
                                <div className="text-xl font-bold text-rose-700 dark:text-rose-400">
                                  {syncResult.summary.errors}
                                </div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-500 mt-1">
                                  Failed
                                </div>
                              </div>
                            </div>

                            {syncResult.updated.length > 0 && (
                              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                                <button
                                  onClick={() =>
                                    setExpandSyncUpdated(!expandSyncUpdated)
                                  }
                                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex justify-between items-center text-sm font-semibold text-slate-700 dark:text-slate-300"
                                >
                                  <span>
                                    Success Log ({syncResult.updated.length})
                                  </span>
                                  <svg
                                    className={`w-4 h-4 transition-transform ${expandSyncUpdated ? "rotate-180" : ""}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                </button>
                                <AnimatePresence>
                                  {expandSyncUpdated && (
                                    <motion.div
                                      initial={{ height: 0 }}
                                      animate={{ height: "auto" }}
                                      exit={{ height: 0 }}
                                      className="overflow-hidden bg-white dark:bg-[#0f172a]"
                                    >
                                      <div className="max-h-40 overflow-y-auto p-2 space-y-1">
                                        {syncResult.updated.map((entry, i) => (
                                          <div
                                            key={i}
                                            className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs"
                                          >
                                            <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                                              {entry.customerName}
                                            </div>
                                            <div className="font-mono text-slate-500 break-all">
                                              <span className="line-through opacity-70">
                                                {entry.currentEmail}
                                              </span>{" "}
                                              <span className="mx-1">→</span>{" "}
                                              <span className="text-green-600 dark:text-green-400">
                                                {entry.expectedEmail}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}

                            {syncResult.errors.length > 0 && (
                              <div className="border border-rose-200 dark:border-rose-500/20 rounded-xl overflow-hidden shadow-sm">
                                <button
                                  onClick={() =>
                                    setExpandSyncErrors(!expandSyncErrors)
                                  }
                                  className="w-full px-4 py-3 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors flex justify-between items-center text-sm font-semibold text-rose-800 dark:text-rose-400"
                                >
                                  <span>
                                    Error Log ({syncResult.errors.length})
                                  </span>
                                  <svg
                                    className={`w-4 h-4 transition-transform ${expandSyncErrors ? "rotate-180" : ""}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                </button>
                                <AnimatePresence>
                                  {expandSyncErrors && (
                                    <motion.div
                                      initial={{ height: 0 }}
                                      animate={{ height: "auto" }}
                                      exit={{ height: 0 }}
                                      className="overflow-hidden bg-white dark:bg-[#0f172a]"
                                    >
                                      <div className="max-h-40 overflow-y-auto p-2 space-y-1">
                                        {syncResult.errors.map((entry, i) => (
                                          <div
                                            key={i}
                                            className="p-3 bg-rose-50 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/10 rounded-lg text-xs"
                                          >
                                            <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                                              {entry.customerName}
                                            </div>
                                            <div className="text-rose-600 dark:text-rose-400">
                                              {entry.error}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}

                    <button
                      onClick={() => setToolsView("menu")}
                      className="w-full py-3.5 text-sm font-bold text-white bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl shadow-md transition-all active:scale-[0.98]"
                    >
                      Done
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default ToolsModal;
