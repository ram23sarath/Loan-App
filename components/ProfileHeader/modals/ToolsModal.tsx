import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

type ToolsView = 'menu' | 'createUser' | 'changeUserPassword';

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
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};

export default ToolsModal;
