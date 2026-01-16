import React from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import { SquigglyProgress } from '../../SquigglyProgress';

export interface BackupArtifact {
    id: number;
    name: string;
}

interface BackupProgressModalProps {
    isOpen: boolean;
    theme: 'light' | 'dark';
    backupProgress: number;
    backupCurrentStep: string;
    backupElapsed: string;
    backupRunId: number | null;
    backupCancelling: boolean;
    backupGitHubUrl: string | null;
    backupArtifacts: BackupArtifact[];
    backupDownloading: boolean;
    onCancel: () => void;
    onDownload: (artifact: BackupArtifact) => void;
    onClose: () => void;
}

const BackupProgressModal: React.FC<BackupProgressModalProps> = ({
    isOpen,
    theme,
    backupProgress,
    backupCurrentStep,
    backupElapsed,
    backupRunId,
    backupCancelling,
    backupGitHubUrl,
    backupArtifacts,
    backupDownloading,
    onCancel,
    onDownload,
    onClose,
}) => {
    if (!isOpen || typeof document === 'undefined') return null;

    return ReactDOM.createPortal(
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

                {/* Progress Bar */}
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
                        onClick={onCancel}
                        disabled={backupCancelling || !backupRunId}
                        className="w-full px-4 py-3 bg-red-100 hover:bg-red-200 active:bg-red-300 text-red-700 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400"
                    >
                        {backupCancelling ? 'Cancelling...' : 'Cancel Backup'}
                    </button>
                )}

                {/* Complete/Error State */}
                {(backupProgress >= 100 || backupCurrentStep.startsWith('❌')) && (
                    <div className="space-y-3">
                        {/* Download Backup button */}
                        {backupCurrentStep.startsWith('✅') && backupArtifacts.length > 0 && backupRunId && (
                            <button
                                onClick={() => onDownload(backupArtifacts[0])}
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

                        {/* View on GitHub link */}
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
                            onClick={onClose}
                            className="w-full px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white"
                        >
                            Close
                        </button>
                    </div>
                )}
            </motion.div>
        </motion.div>,
        document.body
    );
};

export default BackupProgressModal;
