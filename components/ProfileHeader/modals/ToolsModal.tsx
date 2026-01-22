import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

type ToolsView = 'menu' | 'createUser' | 'changeUserPassword' | 'userStatus';

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
                setToolsMessage({ type: 'error', text: result.error || 'Failed to change password' });
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

    if (!isOpen || typeof document === 'undefined') return null;

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
                    {/* Main Menu */}
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
                                <motion.button
                                    onClick={() => {
                                        setToolsView('userStatus');
                                        setToolsMessage(null);
                                        fetchUserStatus();
                                    }}
                                    className="w-full px-4 py-4 md:py-3 bg-cyan-50 hover:bg-cyan-100 active:bg-cyan-200 text-cyan-700 font-medium rounded-lg transition-colors flex items-center gap-3 dark:bg-cyan-900/30 dark:hover:bg-cyan-900/50 dark:text-cyan-400"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.18 }}
                                    whileHover={{ scale: 1.02, x: 4 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <span className="text-xl">📊</span>
                                    <div className="text-left">
                                        <div className="font-semibold text-sm md:text-base">User Account Status</div>
                                        <div className="text-xs text-cyan-500 dark:text-cyan-400/70">Check customer account sync status</div>
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
                                <motion.button
                                    onClick={() => {
                                        onClose();
                                        onNavigateToTrash();
                                    }}
                                    className="w-full px-4 py-4 md:py-3 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 font-medium rounded-lg transition-colors flex items-center gap-3 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 dark:text-rose-400"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.25 }}
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
                        </>
                    )}

                    {/* User Status Dashboard */}
                    {toolsView === 'userStatus' && (
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
                        </>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};

export default ToolsModal;
