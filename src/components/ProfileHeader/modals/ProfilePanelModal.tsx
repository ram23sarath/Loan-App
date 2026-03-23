import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Customer } from '../../../types';

interface ProfilePanelModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail: string;
    isScopedCustomer: boolean;
    customerDetails: Customer | null;
    adminNameFromMeta: string;
    // Station name editing
    stationName: string;
    isEditingStation: boolean;
    isSavingStation: boolean;
    setStationName: (name: string) => void;
    setIsEditingStation: (editing: boolean) => void;
    onSaveStation: () => void;
    // Admin name editing
    adminName: string;
    isEditingAdminName: boolean;
    isSavingAdminName: boolean;
    setAdminName: (name: string) => void;
    setIsEditingAdminName: (editing: boolean) => void;
    onSaveAdminName: () => void;
    // Avatar upload
    avatarImageUrl: string | null;
    isUploadingAvatar: boolean;
    avatarUploadError: string | null;
    avatarStatusText: string | null;
    avatarPreviewUrl: string | null;
    selectedAvatarFileName: string | null;
    onSelectAvatarFile: (file: File | null) => Promise<void>;
    onSaveAvatar: () => Promise<void>;
    onRetryAvatarUpload: () => Promise<void>;
    onCancelAvatarUpload: () => void;
}

const ProfilePanelModal: React.FC<ProfilePanelModalProps> = ({
    isOpen,
    onClose,
    userEmail,
    isScopedCustomer,
    customerDetails,
    adminNameFromMeta,
    stationName,
    isEditingStation,
    isSavingStation,
    setStationName,
    setIsEditingStation,
    onSaveStation,
    adminName,
    isEditingAdminName,
    isSavingAdminName,
    setAdminName,
    setIsEditingAdminName,
    onSaveAdminName,
    avatarImageUrl,
    isUploadingAvatar,
    avatarUploadError,
    avatarStatusText,
    avatarPreviewUrl,
    selectedAvatarFileName,
    onSelectAvatarFile,
    onSaveAvatar,
    onRetryAvatarUpload,
    onCancelAvatarUpload,
}) => {
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const [avatarSelectionError, setAvatarSelectionError] = React.useState<string | null>(null);
    const [showAvatarActions, setShowAvatarActions] = React.useState(false);
    const [avatarImageFailed, setAvatarImageFailed] = React.useState(false);

    React.useEffect(() => {
        if (!isOpen && fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        if (!isOpen) {
            setAvatarSelectionError(null);
            setShowAvatarActions(false);
            setAvatarImageFailed(false);
        }
    }, [isOpen]);

    const displayName = isScopedCustomer
        ? (customerDetails?.name ?? '')
        : (adminNameFromMeta ?? userEmail ?? '');

    const avatarInitials = displayName
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || 'U';

    React.useEffect(() => {
        setAvatarImageFailed(false);
    }, [avatarPreviewUrl, avatarImageUrl]);

    const handleAvatarEditClick = () => {
        setShowAvatarActions((current) => !current);
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const nextFile = event.target.files?.[0] ?? null;
        setAvatarSelectionError(null);
        try {
            await onSelectAvatarFile(nextFile);
            setAvatarSelectionError(null);
        } catch (error) {
            console.error('[ProfilePanelModal] Failed to process selected avatar file', error);
            const message = error instanceof Error && error.message
                ? error.message
                : 'Could not select avatar image. Please try again.';
            setAvatarSelectionError(message);
            event.target.value = '';
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 bg-black/40 z-[99] flex items-center justify-center p-3 md:p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.97, opacity: 0, y: 8 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.98, opacity: 0, y: 4 }}
                        transition={{ type: 'tween', ease: [0.25, 0.1, 0.25, 1], duration: 0.25 }}
                        className="bg-white rounded-xl shadow-2xl p-4 md:p-6 w-full max-w-sm md:max-w-md max-h-[90vh] overflow-y-auto z-[100] dark:bg-dark-card dark:border dark:border-dark-border"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <motion.div
                            className="mb-4"
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: 'tween', ease: 'easeOut', duration: 0.2 }}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <h2 className="min-w-0 pr-2 text-lg md:text-2xl font-bold text-gray-800 dark:text-dark-text">Profile</h2>

                                <div className="flex shrink-0 items-start gap-3">
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="relative h-[4.5rem] w-[4.5rem] overflow-visible">
                                            <div className="absolute inset-0 overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold shadow-lg ring-2 ring-white/70 dark:ring-dark-card/80">
                                                {(avatarPreviewUrl || avatarImageUrl) && !avatarImageFailed ? (
                                                    <img
                                                        src={avatarPreviewUrl || avatarImageUrl || ''}
                                                        alt={displayName || 'Profile avatar'}
                                                        className="h-full w-full object-cover"
                                                        onError={() => setAvatarImageFailed(true)}
                                                    />
                                                ) : (
                                                    <span className="flex h-full w-full items-center justify-center text-xl">
                                                        {avatarInitials}
                                                    </span>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={handleAvatarEditClick}
                                                className="absolute -right-1 -bottom-1 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-indigo-700 text-white shadow-lg shadow-indigo-700/40 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-dark-card dark:focus:ring-offset-dark-card"
                                                aria-label={showAvatarActions ? 'Hide avatar upload options' : 'Edit avatar'}
                                                title={showAvatarActions ? 'Hide avatar upload options' : 'Edit avatar'}
                                            >
                                                <svg
                                                    aria-hidden="true"
                                                    viewBox="0 0 24 24"
                                                    className="h-4.5 w-4.5"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.6"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M12 20h9" />
                                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                                                </svg>
                                            </button>
                                        </div>

                                        <AnimatePresence initial={false}>
                                            {showAvatarActions && (
                                                <motion.div
                                                    className="w-full rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-dark-border dark:bg-slate-800/70"
                                                    initial={{ opacity: 0, y: -6, height: 0 }}
                                                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                                                    exit={{ opacity: 0, y: -4, height: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <input
                                                        ref={fileInputRef}
                                                        type="file"
                                                        accept="image/jpeg,image/jpg,image/png,image/webp"
                                                        className="hidden"
                                                        onChange={handleFileChange}
                                                        disabled={isUploadingAvatar}
                                                        id="avatar-file-input"
                                                    />
                                                    <div className="flex flex-wrap gap-2">
                                                        <label
                                                            htmlFor="avatar-file-input"
                                                            className={`px-3 py-2 text-xs md:text-sm font-medium rounded transition-colors cursor-pointer ${isUploadingAvatar ? 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-slate-700 dark:text-dark-muted' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50'}`}
                                                        >
                                                            Choose Image
                                                        </label>
                                                        <button
                                                            onClick={() => void onSaveAvatar()}
                                                            disabled={!selectedAvatarFileName || isUploadingAvatar}
                                                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs md:text-sm font-medium rounded transition-colors"
                                                        >
                                                            {isUploadingAvatar ? 'Saving...' : 'Save Avatar'}
                                                        </button>
                                                        {isUploadingAvatar && (
                                                            <button
                                                                onClick={onCancelAvatarUpload}
                                                                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs md:text-sm font-medium rounded transition-colors dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-dark-text"
                                                            >
                                                                Cancel
                                                            </button>
                                                        )}
                                                    </div>

                                                    {avatarUploadError && (
                                                        <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                                                            <p>{avatarUploadError}</p>
                                                            {!!selectedAvatarFileName && (
                                                                <button
                                                                    onClick={() => void onRetryAvatarUpload()}
                                                                    className="mt-2 text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                                                                >
                                                                    Retry
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    {avatarSelectionError && (
                                                        <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                                                            <p>{avatarSelectionError}</p>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <motion.button
                                        onClick={onClose}
                                        className="text-gray-400 hover:text-gray-600 text-xl md:text-2xl transition-colors dark:text-dark-muted dark:hover:text-dark-text"
                                        whileHover={{ scale: 1.1, rotate: 90 }}
                                        whileTap={{ scale: 0.9 }}
                                    >
                                        ✕
                                    </motion.button>
                                </div>
                            </div>
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

                            {avatarUploadError && (
                                <motion.div
                                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.18, type: 'spring', stiffness: 300, damping: 24 }}
                                >
                                    <p>{avatarUploadError}</p>
                                    {!!selectedAvatarFileName && (
                                        <button
                                            onClick={() => void onRetryAvatarUpload()}
                                            className="mt-2 text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                                        >
                                            Retry
                                        </button>
                                    )}
                                </motion.div>
                            )}

                            {avatarSelectionError && (
                                <motion.div
                                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.18, type: 'spring', stiffness: 300, damping: 24 }}
                                >
                                    <p>{avatarSelectionError}</p>
                                </motion.div>
                            )}

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
                                                    onClick={onSaveStation}
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
                                                onClick={onSaveAdminName}
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
                                onClick={onClose}
                                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm md:text-base font-medium rounded-lg transition-colors dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-dark-text"
                            >
                                Close
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ProfilePanelModal;
