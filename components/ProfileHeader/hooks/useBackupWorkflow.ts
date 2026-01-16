import { useState, useRef, useCallback } from 'react';

export interface BackupArtifact {
    id: number;
    name: string;
}

export interface UseBackupWorkflowReturn {
    // State
    backupRunning: boolean;
    backupProgress: number;
    backupCurrentStep: string;
    backupElapsed: string;
    backupRunId: number | null;
    backupCancelling: boolean;
    backupGitHubUrl: string | null;
    backupArtifacts: BackupArtifact[];
    backupDownloading: boolean;
    // Actions
    startBackup: () => Promise<void>;
    cancelBackup: () => Promise<void>;
    downloadArtifact: (artifact: BackupArtifact) => Promise<void>;
    closeBackup: () => void;
}

export function useBackupWorkflow(): UseBackupWorkflowReturn {
    const [backupRunning, setBackupRunning] = useState(false);
    const [backupProgress, setBackupProgress] = useState(0);
    const [backupCurrentStep, setBackupCurrentStep] = useState('');
    const [backupElapsed, setBackupElapsed] = useState('00:00');
    const [backupRunId, setBackupRunId] = useState<number | null>(null);
    const [backupCancelling, setBackupCancelling] = useState(false);
    const [backupGitHubUrl, setBackupGitHubUrl] = useState<string | null>(null);
    const [backupArtifacts, setBackupArtifacts] = useState<BackupArtifact[]>([]);
    const [backupDownloading, setBackupDownloading] = useState(false);

    const backupTimerRef = useRef<number | null>(null);
    const backupPollRef = useRef<number | null>(null);

    const closeBackup = useCallback(() => {
        if (backupPollRef.current) {
            clearInterval(backupPollRef.current);
            backupPollRef.current = null;
        }
        if (backupTimerRef.current) {
            clearInterval(backupTimerRef.current);
            backupTimerRef.current = null;
        }
        setBackupRunning(false);
        setBackupElapsed('00:00');
    }, []);

    const startBackup = useCallback(async () => {
        if (backupRunning) return;

        setBackupRunning(true);
        setBackupProgress(0);
        setBackupCurrentStep('Starting backup...');
        setBackupRunId(null);
        setBackupCancelling(false); setBackupGitHubUrl(null);
        setBackupArtifacts([]);
        setBackupDownloading(false);

        const startTime = Date.now();
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

            // Initial delay before first poll
            await new Promise(r => setTimeout(r, 3000));
            await pollStatus();

            // Continue polling every 5 seconds
            backupPollRef.current = window.setInterval(pollStatus, 5000) as unknown as number;

        } catch (err: any) {
            setBackupCurrentStep(`❌ Error: ${err.message || 'Backup failed'}`);
            setBackupProgress(0);
            setBackupRunning(false);
            if (backupTimerRef.current) {
                clearInterval(backupTimerRef.current);
                backupTimerRef.current = null;
            }
        }
    }, []);

    const cancelBackup = useCallback(async () => {
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
                let errorMsg = 'Unknown error';
                try {
                    const data = await res.json();
                    errorMsg = data.error || errorMsg;
                } catch {
                    errorMsg = await res.text() || errorMsg;
                }
                setBackupCurrentStep(`⚠️ Cancel failed: ${errorMsg}`);
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
                setBackupElapsed('00:00');
            }, 2000);
        }
    }, [backupRunId, backupCancelling]);

    const downloadArtifact = useCallback(async (artifact: BackupArtifact) => {
        if (backupDownloading || !backupRunId) return;

        setBackupDownloading(true);
        try {
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
    }, [backupRunId, backupDownloading]);

    return {
        backupRunning,
        backupProgress,
        backupCurrentStep,
        backupElapsed,
        backupRunId,
        backupCancelling,
        backupGitHubUrl,
        backupArtifacts,
        backupDownloading,
        startBackup,
        cancelBackup,
        downloadArtifact,
        closeBackup,
    };
}
