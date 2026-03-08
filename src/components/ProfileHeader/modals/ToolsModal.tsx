import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../../lib/supabase';
import type { Document } from '../../../types';

type ToolsView = 'menu' | 'createUser' | 'changeUserPassword' | 'userStatus' | 'manageDocuments' | 'syncCustomers';

interface ToolsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigateToTrash: () => void;
    onStartBackup: () => void;
    backupDisabled: boolean;
}

const ToolsModal: React.FC<ToolsModalProps> = ({
    isOpen,
    onClose,
    onNavigateToTrash,
    onStartBackup,
    backupDisabled,
}) => {
    const [toolsView, setToolsView] = useState<ToolsView>('menu');
    const [toolsLoading, setToolsLoading] = useState(false);
    const [toolsMessage, setToolsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Create User form state
    const [createUserEmail, setCreateUserEmail] = useState('');
    const [createUserPassword, setCreateUserPassword] = useState('');
    const [createUserName, setCreateUserName] = useState('');
    const [createUserPhone, setCreateUserPhone] = useState('');
    const [createUserIsAdmin, setCreateUserIsAdmin] = useState(false);

    // Change Password form state
    const [changePasswordEmail, setChangePasswordEmail] = useState('');
    const [changePasswordNew, setChangePasswordNew] = useState('');

    // User Status state
    interface UserStatusCustomer {
        id: string;
        name: string;
        phone: string;
        expectedEmail?: string;
        existingAuthId?: string | null;
        orphanedUserId?: string;
    }
    interface UserStatusData {
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
    const [userStatusData, setUserStatusData] = useState<UserStatusData | null>(null);
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
    interface SyncMismatchEntry {
        customerName: string;
        customerPhone: string;
        currentEmail: string;
        expectedEmail: string;
        newPassword?: string;
        error?: string;
    }
    interface SyncResultData {
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
    const [syncProgress, setSyncProgress] = useState(0);
    const [syncPhase, setSyncPhase] = useState<'confirm' | 'syncing' | 'results'>('confirm');
    const [syncResult, setSyncResult] = useState<SyncResultData | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [expandSyncUpdated, setExpandSyncUpdated] = useState(true);
    const [expandSyncErrors, setExpandSyncErrors] = useState(true);

    // Reset state when modal closes
    React.useEffect(() => {
        if (!isOpen) {
            setToolsView('menu');
            setToolsMessage(null);
            setCreateUserEmail('');
            setCreateUserPassword('');
            setCreateUserName('');
            setCreateUserPhone('');
            setCreateUserIsAdmin(false);
            setChangePasswordEmail('');
            setChangePasswordNew('');
            setUserStatusData(null);
            setUserStatusError(null);
            setExpandMissing(true);
            setExpandOrphaned(true);
            // Document management reset
            setSelectedFile(null);
            setUploadProgress(0);
            // Sync Customers reset
            setSyncProgress(0);
            setSyncPhase('confirm');
            setSyncResult(null);
            setSyncError(null);
            setExpandSyncUpdated(true);
            setExpandSyncErrors(true);
        }
    }, [isOpen]);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setToolsLoading(true);
        setToolsMessage(null);
        try {
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
    };

    const handleChangePassword = async (e: React.FormEvent) => {
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
                const errorMsg = result.details 
                    ? `${result.error}\n\n${result.details}`
                    : result.error || 'Failed to change password';
                setToolsMessage({ type: 'error', text: errorMsg });
            }
        } catch (err: any) {
            setToolsMessage({ type: 'error', text: err.message || 'An error occurred' });
        } finally {
            setToolsLoading(false);
        }
    };

    // Fetch user status data
    const fetchUserStatus = async () => {
        setUserStatusLoading(true);
        setUserStatusError(null);
        try {
            const response = await fetch('/.netlify/functions/compare-users');
            const result = await response.json();
            if (response.ok && result.success) {
                setUserStatusData(result);
            } else {
                setUserStatusError(result.error || 'Failed to fetch user status');
            }
        } catch (err: any) {
            setUserStatusError(err.message || 'An error occurred');
        } finally {
            setUserStatusLoading(false);
        }
    };

    // Fix a single missing user
    const handleFixMissingUser = async (customer: UserStatusCustomer) => {
        setFixingUserId(customer.id);
        try {
            const response = await fetch('/.netlify/functions/create-user-from-customer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_id: customer.id,
                    name: customer.name,
                    phone: customer.phone,
                }),
            });
            const result = await response.json();
            if (response.ok && result.success) {
                // Refresh the data
                await fetchUserStatus();
            } else {
                setUserStatusError(`Failed to create user for ${customer.name}: ${result.error}`);
            }
        } catch (err: any) {
            setUserStatusError(err.message || 'An error occurred');
        } finally {
            setFixingUserId(null);
        }
    };

    // Sync all customers to auth (calls serverless function)
    const handleSyncCustomers = async () => {
        setSyncPhase('syncing');
        setSyncProgress(10);
        setSyncError(null);
        setSyncResult(null);

        let progressTimer1: NodeJS.Timeout | null = null;

        try {
            progressTimer1 = setTimeout(() => setSyncProgress(30), 800);

            const response = await fetch('/.netlify/functions/sync-customer-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dryRun: false }),
            });

            setSyncProgress(70);

            const resultText = await response.text();
            let result: any = {};
            try {
                result = JSON.parse(resultText);
            } catch {
                // fallthrough
            }

            setSyncProgress(90);
            await new Promise(resolve => setTimeout(resolve, 300));

            if (response.ok && result && result.success) {
                setSyncProgress(100);
                setSyncResult(result as SyncResultData);
                await new Promise(resolve => setTimeout(resolve, 500));
                setSyncPhase('results');
            } else {
                const errMsg = (result && (result.error || result.message)) || resultText || 'Sync failed';
                setSyncError(String(errMsg));
                setSyncPhase('results');
            }
        } catch (err: any) {
            setSyncError(err.message || 'An error occurred while syncing');
            setSyncPhase('results');
        } finally {
            if (progressTimer1 !== null) {
                clearTimeout(progressTimer1);
            }
            setSyncProgress(0);
        }
    };

    // Fetch documents from Supabase
    const fetchDocuments = async () => {
        setDocumentsLoading(true);
        try {
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setDocuments(data || []);
        } catch (err: any) {
            setToolsMessage({ type: 'error', text: `Failed to load documents: ${err.message}` });
        } finally {
            setDocumentsLoading(false);
        }
    };

    // Upload document to Supabase Storage
    const handleUploadDocument = async () => {
        if (!selectedFile) return;
        
        setUploadProgress(10);
        setToolsMessage(null);
        
        try {
            // Generate unique filename
            const timestamp = Date.now();
            const fileName = `${timestamp}_${selectedFile.name}`;
            const filePath = `documents/${fileName}`;
            
            setUploadProgress(30);
            
            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('public-documents')
                .upload(filePath, selectedFile);
            
            if (uploadError) throw uploadError;
            
            setUploadProgress(70);
            
            // Create database record
            const { error: dbError } = await supabase
                .from('documents')
                .insert({
                    name: selectedFile.name,
                    file_path: filePath,
                    file_size: selectedFile.size,
                    uploaded_by: 'admin', // Could be enhanced to use actual user email
                });
            
            if (dbError) throw dbError;
            
            setUploadProgress(100);
            setToolsMessage({ type: 'success', text: `"${selectedFile.name}" uploaded successfully!` });
            setSelectedFile(null);
            
            // Refresh documents list
            await fetchDocuments();
        } catch (err: any) {
            setToolsMessage({ type: 'error', text: `Upload failed: ${err.message}` });
        } finally {
            setUploadProgress(0);
        }
    };

    // Delete document
    const handleDeleteDocument = async (doc: Document) => {
        setDeletingDocId(doc.id);
        try {
            // Delete from storage
            const { error: storageError } = await supabase.storage
                .from('public-documents')
                .remove([doc.file_path]);
            
            if (storageError) throw storageError;
            
            // Delete from database
            const { error: dbError } = await supabase
                .from('documents')
                .delete()
                .eq('id', doc.id);
            
            if (dbError) throw dbError;
            
            setToolsMessage({ type: 'success', text: `"${doc.name}" deleted successfully!` });
            await fetchDocuments();
        } catch (err: any) {
            setToolsMessage({ type: 'error', text: `Delete failed: ${err.message}` });
        } finally {
            setDeletingDocId(null);
        }
    };

    if (!isOpen || typeof window === 'undefined') return null;

    return ReactDOM.createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4"
                onClick={onClose}
                onMouseDown={onClose}
                onTouchStart={onClose}
            >
                <motion.div
                    initial={{ scale: 0.97, opacity: 0, y: 8 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.98, opacity: 0, y: 4 }}
                    transition={{ type: 'tween', ease: [0.25, 0.1, 0.25, 1], duration: 0.25 }}
                    className="bg-white rounded-2xl shadow-2xl p-4 md:p-6 w-[92%] max-w-md max-h-[85vh] overflow-y-auto dark:bg-dark-card dark:border dark:border-dark-border"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <AnimatePresence mode="wait">
                        {/* Main Menu */}
                        {toolsView === 'menu' && (
                            <motion.div
                                key="tools-menu"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                            >
                            <motion.div
                                className="flex items-center justify-between mb-4"
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ type: 'tween', ease: 'easeOut', duration: 0.2 }}
                            >
                                <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-dark-text">🛠️ Admin Tools</h2>
                                <motion.button
                                    onClick={onClose}
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
                                    }}
                                    className="w-full px-4 py-4 md:py-3 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 font-medium rounded-lg transition-colors flex items-center gap-3 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400"
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ type: 'tween', ease: 'easeOut', duration: 0.2, delay: 0.05 }}
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
                                    }}
                                    className="w-full px-4 py-4 md:py-3 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-700 font-medium rounded-lg transition-colors flex items-center gap-3 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400"
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ type: 'tween', ease: 'easeOut', duration: 0.2, delay: 0.08 }}
                                    whileHover={{ scale: 1.02, x: 4 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <span className="text-xl">🔑</span>
                                    <div className="text-left">
                                        <div className="font-semibold text-sm md:text-base">Change Password for User</div>
                                        <div className="text-xs text-amber-500 dark:text-amber-400/70">Reset password for any user</div>
                                    </div>
                                </motion.button>
                                <motion.button
                                    onClick={() => {
                                        setToolsView('userStatus');
                                        setToolsMessage(null);
                                        fetchUserStatus();
                                    }}
                                    className="w-full px-4 py-4 md:py-3 bg-cyan-50 hover:bg-cyan-100 active:bg-cyan-200 text-cyan-700 font-medium rounded-lg transition-colors flex items-center gap-3 dark:bg-cyan-900/30 dark:hover:bg-cyan-900/50 dark:text-cyan-400"
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ type: 'tween', ease: 'easeOut', duration: 0.2, delay: 0.11 }}
                                    whileHover={{ scale: 1.02, x: 4 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <span className="text-xl">📊</span>
                                    <div className="text-left">
                                        <div className="font-semibold text-sm md:text-base">User Account Status</div>
                                        <div className="text-xs text-cyan-500 dark:text-cyan-400/70">Check customer account sync status</div>
                                    </div>
                                </motion.button>
                                    <motion.button
                                        onClick={() => {
                                            setToolsMessage(null);
                                            setSyncPhase('confirm');
                                            setSyncResult(null);
                                            setSyncError(null);
                                            setToolsView('syncCustomers');
                                        }}
                                        className="w-full px-4 py-4 md:py-3 bg-sky-50 hover:bg-sky-100 active:bg-sky-200 text-sky-700 font-medium rounded-lg transition-colors flex items-center gap-3 dark:bg-sky-900/30 dark:hover:bg-sky-900/50 dark:text-sky-400"
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ type: 'tween', ease: 'easeOut', duration: 0.2, delay: 0.13 }}
                                        whileHover={{ scale: 1.02, x: 4 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <span className="text-xl">🔄</span>
                                        <div className="text-left">
                                            <div className="font-semibold text-sm md:text-base">Sync Customers to Auth</div>
                                            <div className="text-xs text-sky-500 dark:text-sky-400/70">Update auth emails/passwords to phone@gmail.com</div>
                                        </div>
                                    </motion.button>
                                <motion.button
                                    onClick={() => {
                                        setToolsView('manageDocuments');
                                        setToolsMessage(null);
                                        fetchDocuments();
                                    }}
                                    className="w-full px-4 py-4 md:py-3 bg-violet-50 hover:bg-violet-100 active:bg-violet-200 text-violet-700 font-medium rounded-lg transition-colors flex items-center gap-3 dark:bg-violet-900/30 dark:hover:bg-violet-900/50 dark:text-violet-400"
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ type: 'tween', ease: 'easeOut', duration: 0.2, delay: 0.14 }}
                                    whileHover={{ scale: 1.02, x: 4 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <span className="text-xl">📄</span>
                                    <div className="text-left">
                                        <div className="font-semibold text-sm md:text-base">Manage Documents</div>
                                        <div className="text-xs text-violet-500 dark:text-violet-400/70">Upload PDFs for customers</div>
                                    </div>
                                </motion.button>
                                <button
                                    onClick={() => {
                                        onClose();
                                        onStartBackup();
                                    }}
                                    className="w-full px-4 py-4 md:py-3 bg-green-50 hover:bg-green-100 active:bg-green-200 text-green-700 font-medium rounded-lg transition-colors flex items-center gap-3 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400"
                                    disabled={backupDisabled}
                                >
                                    <motion.span
                                        className="text-xl"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.2, delay: 0.15 }}
                                    >💾</motion.span>
                                    <div className="text-left">
                                        <div className="font-semibold text-sm md:text-base">Backup Database</div>
                                        <div className="text-xs text-green-500 dark:text-green-400/70">
                                            Trigger a DB backup to Google Drive
                                        </div>
                                    </div>
                                </button>
                                <motion.button
                                    onClick={() => {
                                        onClose();
                                        onNavigateToTrash();
                                    }}
                                    className="w-full px-4 py-4 md:py-3 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 font-medium rounded-lg transition-colors flex items-center gap-3 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 dark:text-rose-400"
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ type: 'tween', ease: 'easeOut', duration: 0.2, delay: 0.17 }}
                                    whileHover={{ scale: 1.02, x: 4 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <span className="text-xl">🗑️</span>
                                    <div className="text-left">
                                        <div className="font-semibold text-sm md:text-base">Trash</div>
                                        <div className="text-xs text-rose-500 dark:text-rose-400/70">View and restore deleted items</div>
                                    </div>
                                </motion.button>
                            </div>
                            </motion.div>
                        )}

                        {/* Create User Form */}
                        {toolsView === 'createUser' && (
                            <motion.div
                                key="tools-create-user"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                            >
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
                            <form onSubmit={handleCreateUser} className="space-y-4">
                                {/* Admin Toggle */}
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

                                {/* Name field */}
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

                                {/* Conditional fields */}
                                {createUserIsAdmin ? (
                                    <>
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
                            </motion.div>
                        )}

                        {/* Change User Password Form */}
                        {toolsView === 'changeUserPassword' && (
                            <motion.div
                                key="tools-change-password"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                            >
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
                            <form onSubmit={handleChangePassword} className="space-y-4">
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
                            </motion.div>
                        )}

                        {/* User Status Dashboard */}
                        {toolsView === 'userStatus' && (
                            <motion.div
                                key="tools-user-status"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                            >
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
                                <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-dark-text flex-1">User Account Status</h2>
                                <motion.button
                                    onClick={fetchUserStatus}
                                    disabled={userStatusLoading}
                                    className="text-cyan-600 hover:text-cyan-700 transition-colors p-1 dark:text-cyan-400 dark:hover:text-cyan-300"
                                    whileHover={{ scale: 1.1, rotate: 180 }}
                                    whileTap={{ scale: 0.9 }}
                                    title="Refresh"
                                >
                                    <span className="text-xl">{userStatusLoading ? '⏳' : '🔄'}</span>
                                </motion.button>
                            </motion.div>

                            {/* Error Message */}
                            <AnimatePresence>
                                {userStatusError && (
                                    <motion.div
                                        className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                    >
                                        {userStatusError}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Loading State */}
                            {userStatusLoading && !userStatusData && (
                                <motion.div
                                    className="flex flex-col items-center justify-center py-12"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    <div className="animate-spin text-4xl mb-3">⏳</div>
                                    <p className="text-gray-500 dark:text-dark-muted">Loading user status...</p>
                                </motion.div>
                            )}

                            {/* Dashboard Content */}
                            {userStatusData && (
                                <motion.div
                                    className="space-y-4"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <motion.div
                                            className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 text-center"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.1 }}
                                        >
                                            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                                                {userStatusData.summary.healthy}
                                            </div>
                                            <div className="text-xs text-green-600 dark:text-green-500">✅ Healthy</div>
                                        </motion.div>
                                        <motion.div
                                            className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-3 text-center"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.15 }}
                                        >
                                            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                                                {userStatusData.summary.missingUserId}
                                            </div>
                                            <div className="text-xs text-yellow-600 dark:text-yellow-500">⚠️ Missing</div>
                                        </motion.div>
                                        <motion.div
                                            className="bg-red-50 dark:bg-red-900/30 rounded-lg p-3 text-center"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.2 }}
                                        >
                                            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                                                {userStatusData.summary.orphanedUserId}
                                            </div>
                                            <div className="text-xs text-red-600 dark:text-red-500">❌ Orphaned</div>
                                        </motion.div>
                                    </div>

                                    {/* Stats Row */}
                                    <div className="text-xs text-gray-500 dark:text-dark-muted text-center">
                                        {userStatusData.summary.totalCustomers} customers • {userStatusData.summary.totalAuthUsers} auth users
                                    </div>

                                    {/* Missing Users Section */}
                                    {userStatusData.customersWithoutUserId.length > 0 && (
                                        <motion.div
                                            className="border border-yellow-200 dark:border-yellow-800 rounded-lg overflow-hidden"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.25 }}
                                        >
                                            <button
                                                onClick={() => setExpandMissing(!expandMissing)}
                                                className="w-full px-3 py-2 bg-yellow-50 dark:bg-yellow-900/30 flex items-center justify-between text-sm font-medium text-yellow-800 dark:text-yellow-400"
                                            >
                                                <span>⚠️ Missing Auth Account ({userStatusData.customersWithoutUserId.length})</span>
                                                <span>{expandMissing ? '▼' : '▶'}</span>
                                            </button>
                                            <AnimatePresence>
                                                {expandMissing && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="max-h-40 overflow-y-auto">
                                                            {userStatusData.customersWithoutUserId.map((customer) => (
                                                                <div
                                                                    key={customer.id}
                                                                    className="px-3 py-2 border-t border-yellow-100 dark:border-yellow-900 flex items-center justify-between text-sm"
                                                                >
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="font-medium text-gray-800 dark:text-dark-text truncate">{customer.name}</div>
                                                                        <div className="text-xs text-gray-500 dark:text-dark-muted">{customer.phone}</div>
                                                                    </div>
                                                                    <motion.button
                                                                        onClick={() => handleFixMissingUser(customer)}
                                                                        disabled={fixingUserId === customer.id}
                                                                        className="ml-2 px-2 py-1 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300 text-white text-xs font-medium rounded"
                                                                        whileHover={{ scale: 1.05 }}
                                                                        whileTap={{ scale: 0.95 }}
                                                                    >
                                                                        {fixingUserId === customer.id ? '...' : 'Create'}
                                                                    </motion.button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    )}

                                    {/* Orphaned Users Section */}
                                    {userStatusData.customersWithOrphanedUserId.length > 0 && (
                                        <motion.div
                                            className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.3 }}
                                        >
                                            <button
                                                onClick={() => setExpandOrphaned(!expandOrphaned)}
                                                className="w-full px-3 py-2 bg-red-50 dark:bg-red-900/30 flex items-center justify-between text-sm font-medium text-red-800 dark:text-red-400"
                                            >
                                                <span>❌ Orphaned Account ({userStatusData.customersWithOrphanedUserId.length})</span>
                                                <span>{expandOrphaned ? '▼' : '▶'}</span>
                                            </button>
                                            <AnimatePresence>
                                                {expandOrphaned && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="max-h-40 overflow-y-auto">
                                                            {userStatusData.customersWithOrphanedUserId.map((customer) => (
                                                                <div
                                                                    key={customer.id}
                                                                    className="px-3 py-2 border-t border-red-100 dark:border-red-900 flex items-center justify-between text-sm"
                                                                >
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="font-medium text-gray-800 dark:text-dark-text truncate">{customer.name}</div>
                                                                        <div className="text-xs text-gray-500 dark:text-dark-muted">{customer.phone}</div>
                                                                    </div>
                                                                    <motion.button
                                                                        onClick={() => handleFixMissingUser(customer)}
                                                                        disabled={fixingUserId === customer.id}
                                                                        className="ml-2 px-2 py-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-xs font-medium rounded"
                                                                        whileHover={{ scale: 1.05 }}
                                                                        whileTap={{ scale: 0.95 }}
                                                                    >
                                                                        {fixingUserId === customer.id ? '...' : 'Recreate'}
                                                                    </motion.button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    )}

                                    {/* All Healthy Message */}
                                    {userStatusData.summary.missingUserId === 0 && userStatusData.summary.orphanedUserId === 0 && (
                                        <motion.div
                                            className="text-center py-6"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                        >
                                            <div className="text-4xl mb-2">✨</div>
                                            <div className="text-green-600 dark:text-green-400 font-medium">All customers have valid accounts!</div>
                                        </motion.div>
                                    )}

                                    {/* Last Updated */}
                                    <div className="text-xs text-gray-400 dark:text-dark-muted text-center pt-2">
                                        Last checked: {new Date(userStatusData.timestamp).toLocaleTimeString()}
                                    </div>
                                </motion.div>
                            )}
                            </motion.div>
                        )}

                        {/* Manage Documents View */}
                        {toolsView === 'manageDocuments' && (
                            <motion.div
                                key="tools-manage-docs"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                            >
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
                                    <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-dark-text flex-1">Manage Documents</h2>
                                    <motion.button
                                        onClick={fetchDocuments}
                                        disabled={documentsLoading}
                                        className="text-violet-600 hover:text-violet-700 transition-colors p-1 dark:text-violet-400 dark:hover:text-violet-300"
                                        whileHover={{ scale: 1.1, rotate: 180 }}
                                        whileTap={{ scale: 0.9 }}
                                        title="Refresh"
                                    >
                                        <span className="text-xl">{documentsLoading ? '⏳' : '🔄'}</span>
                                    </motion.button>
                                </motion.div>

                                {/* Message */}
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

                                {/* Upload Section */}
                                <motion.div
                                    className="mb-4 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-lg border-2 border-dashed border-violet-200 dark:border-violet-800"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                >
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center gap-2">
                                            <label className="flex-1">
                                                <input
                                                    type="file"
                                                    accept=".pdf"
                                                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                                    className="hidden"
                                                />
                                                <div className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-violet-200 dark:border-violet-700 rounded-lg text-sm cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors truncate">
                                                    {selectedFile ? selectedFile.name : '📁 Choose PDF file...'}
                                                </div>
                                            </label>
                                        </div>
                                        {selectedFile && (
                                            <div className="text-xs text-gray-500 dark:text-dark-muted">
                                                Size: {(selectedFile.size / 1024).toFixed(1)} KB
                                            </div>
                                        )}
                                        <motion.button
                                            onClick={handleUploadDocument}
                                            disabled={!selectedFile || uploadProgress > 0}
                                            className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-semibold rounded-lg transition-colors"
                                            whileHover={{ scale: selectedFile && uploadProgress === 0 ? 1.02 : 1 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            {uploadProgress > 0 ? `Uploading... ${uploadProgress}%` : '⬆️ Upload Document'}
                                        </motion.button>
                                        {uploadProgress > 0 && (
                                            <div className="w-full h-2 bg-violet-200 dark:bg-violet-900 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-violet-600"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${uploadProgress}%` }}
                                                    transition={{ duration: 0.3 }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </motion.div>

                                {/* Documents List */}
                                <motion.div
                                    className="space-y-2"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <h3 className="text-sm font-semibold text-gray-700 dark:text-dark-text">
                                        Uploaded Documents ({documents.length})
                                    </h3>
                                    {documentsLoading && documents.length === 0 ? (
                                        <div className="text-center py-6">
                                            <div className="animate-spin text-3xl mb-2">⏳</div>
                                            <p className="text-sm text-gray-500 dark:text-dark-muted">Loading documents...</p>
                                        </div>
                                    ) : documents.length === 0 ? (
                                        <div className="text-center py-6 text-gray-500 dark:text-dark-muted">
                                            <div className="text-3xl mb-2">📭</div>
                                            <p className="text-sm">No documents uploaded yet</p>
                                        </div>
                                    ) : (
                                        <div className="max-h-48 overflow-y-auto space-y-2">
                                            {documents.map((doc) => (
                                                <motion.div
                                                    key={doc.id}
                                                    className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg"
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                >
                                                    <span className="text-xl">📄</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-sm text-gray-800 dark:text-dark-text truncate">
                                                            {doc.name}
                                                        </div>
                                                        <div className="text-xs text-gray-500 dark:text-dark-muted">
                                                            {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : 'Unknown size'}
                                                            {' • '}
                                                            {new Date(doc.created_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <motion.button
                                                        onClick={() => handleDeleteDocument(doc)}
                                                        disabled={deletingDocId === doc.id}
                                                        className="px-2 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-xs font-medium rounded"
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                    >
                                                        {deletingDocId === doc.id ? '...' : '🗑️'}
                                                    </motion.button>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            </motion.div>
                        )}

                        {/* Sync Customers View */}
                        {toolsView === 'syncCustomers' && (
                            <motion.div
                                key="tools-sync-customers"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                            >
                                {/* Header */}
                                <motion.div
                                    className="flex items-center gap-3 mb-4"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                                >
                                    <motion.button
                                        onClick={() => {
                                            if (syncPhase === 'syncing') return;
                                            setToolsView('menu');
                                        }}
                                        className={`text-gray-500 hover:text-gray-700 transition-colors p-1 -ml-1 dark:text-dark-muted dark:hover:text-dark-text ${syncPhase === 'syncing' ? 'opacity-40 cursor-not-allowed' : ''}`}
                                        whileHover={syncPhase !== 'syncing' ? { scale: 1.2, x: -3 } : {}}
                                        whileTap={syncPhase !== 'syncing' ? { scale: 0.9 } : {}}
                                    >
                                        <span className="text-xl">←</span>
                                    </motion.button>
                                    <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-dark-text flex-1">Sync Customers to Auth</h2>
                                </motion.div>

                                {/* Confirm Phase */}
                                {syncPhase === 'confirm' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-4"
                                    >
                                        <div className="p-4 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg">
                                            <p className="text-sm text-sky-800 dark:text-sky-300 font-medium mb-2">
                                                This will update auth emails and passwords for all customers to follow the {'{phone}@gmail.com'} convention.
                                            </p>
                                            <p className="text-xs text-sky-600 dark:text-sky-400">
                                                Only mismatched accounts will be updated. Accounts already in sync will be skipped.
                                            </p>
                                        </div>
                                        <div className="flex gap-3">
                                            <motion.button
                                                onClick={() => setToolsView('menu')}
                                                className="flex-1 px-4 py-3 md:py-2.5 text-sm font-semibold rounded-lg border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                Cancel
                                            </motion.button>
                                            <motion.button
                                                onClick={handleSyncCustomers}
                                                className="flex-1 px-4 py-3 md:py-2.5 text-sm bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg transition-colors"
                                                whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)' }}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                Start Sync
                                            </motion.button>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Syncing Phase - Progress Bar */}
                                {syncPhase === 'syncing' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-4 py-6"
                                    >
                                        <div className="text-center">
                                            <motion.div
                                                className="text-4xl mb-3 inline-block"
                                                animate={{ rotate: 360 }}
                                                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                                            >
                                                🔄
                                            </motion.div>
                                            <p className="text-sm font-medium text-gray-700 dark:text-dark-text">
                                                {syncProgress < 30 ? 'Initiating sync...' :
                                                 syncProgress < 70 ? 'Checking customer accounts...' :
                                                 syncProgress < 100 ? 'Processing updates...' :
                                                 'Sync complete!'}
                                            </p>
                                        </div>
                                        <div className="w-full h-2 bg-sky-200 dark:bg-sky-900 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-sky-600"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${syncProgress}%` }}
                                                transition={{ duration: 0.3 }}
                                            />
                                        </div>
                                        <p className="text-xs text-center text-gray-500 dark:text-dark-muted">
                                            {syncProgress}%
                                        </p>
                                    </motion.div>
                                )}

                                {/* Results Phase */}
                                {syncPhase === 'results' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-4"
                                    >
                                        {/* Error banner */}
                                        {syncError && (
                                            <motion.div
                                                className="p-3 rounded-lg text-sm bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                            >
                                                {syncError}
                                            </motion.div>
                                        )}

                                        {/* Success results */}
                                        {syncResult && (
                                            <>
                                                {/* Success message */}
                                                <motion.div
                                                    className="p-3 rounded-lg text-sm bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                >
                                                    {syncResult.message}
                                                </motion.div>

                                                {/* Summary cards */}
                                                <div className="grid grid-cols-3 gap-2">
                                                    <motion.div
                                                        className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 text-center"
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        transition={{ delay: 0.1 }}
                                                    >
                                                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                                            {syncResult.summary.totalCustomersChecked}
                                                        </div>
                                                        <div className="text-xs text-blue-600 dark:text-blue-500">Checked</div>
                                                    </motion.div>
                                                    <motion.div
                                                        className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 text-center"
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        transition={{ delay: 0.15 }}
                                                    >
                                                        <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                                                            {syncResult.summary.updated}
                                                        </div>
                                                        <div className="text-xs text-green-600 dark:text-green-500">Updated</div>
                                                    </motion.div>
                                                    <motion.div
                                                        className="bg-red-50 dark:bg-red-900/30 rounded-lg p-3 text-center"
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        transition={{ delay: 0.2 }}
                                                    >
                                                        <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                                                            {syncResult.summary.errors}
                                                        </div>
                                                        <div className="text-xs text-red-600 dark:text-red-500">Errors</div>
                                                    </motion.div>
                                                </div>

                                                {/* Updated accounts collapsible list */}
                                                {syncResult.updated.length > 0 && (
                                                    <motion.div
                                                        className="border border-green-200 dark:border-green-800 rounded-lg overflow-hidden"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        transition={{ delay: 0.25 }}
                                                    >
                                                        <button
                                                            onClick={() => setExpandSyncUpdated(!expandSyncUpdated)}
                                                            className="w-full px-3 py-2 bg-green-50 dark:bg-green-900/30 flex items-center justify-between text-sm font-medium text-green-800 dark:text-green-400"
                                                        >
                                                            <span>Updated Accounts ({syncResult.updated.length})</span>
                                                            <span>{expandSyncUpdated ? '▼' : '▶'}</span>
                                                        </button>
                                                        <AnimatePresence>
                                                            {expandSyncUpdated && (
                                                                <motion.div
                                                                    initial={{ height: 0, opacity: 0 }}
                                                                    animate={{ height: 'auto', opacity: 1 }}
                                                                    exit={{ height: 0, opacity: 0 }}
                                                                    className="overflow-hidden"
                                                                >
                                                                    <div className="max-h-48 overflow-y-auto">
                                                                        {syncResult.updated.map((entry, i) => (
                                                                            <div
                                                                                key={i}
                                                                                className="px-3 py-2 border-t border-green-100 dark:border-green-900 text-sm"
                                                                            >
                                                                                <div className="font-medium text-gray-800 dark:text-dark-text">
                                                                                    {entry.customerName}
                                                                                </div>
                                                                                <div className="text-xs text-gray-500 dark:text-dark-muted mt-0.5">
                                                                                    Phone: {entry.customerPhone}
                                                                                </div>
                                                                                <div className="text-xs text-gray-500 dark:text-dark-muted">
                                                                                    <span className="text-red-500 line-through">{entry.currentEmail}</span>
                                                                                    {' → '}
                                                                                    <span className="text-green-600 dark:text-green-400 font-medium">{entry.expectedEmail}</span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </motion.div>
                                                )}

                                                {/* Errors collapsible list */}
                                                {syncResult.errors.length > 0 && (
                                                    <motion.div
                                                        className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        transition={{ delay: 0.3 }}
                                                    >
                                                        <button
                                                            onClick={() => setExpandSyncErrors(!expandSyncErrors)}
                                                            className="w-full px-3 py-2 bg-red-50 dark:bg-red-900/30 flex items-center justify-between text-sm font-medium text-red-800 dark:text-red-400"
                                                        >
                                                            <span>Failed Updates ({syncResult.errors.length})</span>
                                                            <span>{expandSyncErrors ? '▼' : '▶'}</span>
                                                        </button>
                                                        <AnimatePresence>
                                                            {expandSyncErrors && (
                                                                <motion.div
                                                                    initial={{ height: 0, opacity: 0 }}
                                                                    animate={{ height: 'auto', opacity: 1 }}
                                                                    exit={{ height: 0, opacity: 0 }}
                                                                    className="overflow-hidden"
                                                                >
                                                                    <div className="max-h-40 overflow-y-auto">
                                                                        {syncResult.errors.map((entry, i) => (
                                                                            <div
                                                                                key={i}
                                                                                className="px-3 py-2 border-t border-red-100 dark:border-red-900 text-sm"
                                                                            >
                                                                                <div className="font-medium text-gray-800 dark:text-dark-text">
                                                                                    {entry.customerName}
                                                                                </div>
                                                                                <div className="text-xs text-gray-500 dark:text-dark-muted">
                                                                                    Phone: {entry.customerPhone}
                                                                                </div>
                                                                                <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                                                                                    {entry.error}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </motion.div>
                                                )}

                                                {/* All in sync message */}
                                                {syncResult.summary.mismatches === 0 && (
                                                    <motion.div
                                                        className="text-center py-6"
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                    >
                                                        <div className="text-4xl mb-2">✨</div>
                                                        <div className="text-green-600 dark:text-green-400 font-medium">
                                                            All accounts are already in sync!
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </>
                                        )}

                                        {/* Done button */}
                                        <motion.button
                                            onClick={() => setToolsView('menu')}
                                            className="w-full px-4 py-3 md:py-2.5 text-sm bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg transition-colors"
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            Done
                                        </motion.button>
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};

export default ToolsModal;
