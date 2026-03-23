import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compressAvatar } from "../../../utils/avatarCompression";
import {
  AvatarUploadError,
  canUseOriginalAvatarAsFallback,
  createAvatarError,
  getAvatarMetadata,
  isAvatarUploadAborted,
  normalizeAvatarError,
} from "../../../utils/avatarUtils";
import {
  buildAvatarPublicUrl,
  clearAvatarMetadata,
  deleteOldAvatarFile,
  persistAvatarMetadata,
  resolveAvatarPathForFile,
  uploadAvatarToStorage,
} from "../../../lib/avatarStorage";

type UseAvatarUploadOptions = {
  userId: string | null;
  userMetadata: Record<string, unknown> | null | undefined;
  showProfilePanel: boolean;
};

const isAbortLikeError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }

  if (typeof error === "object" && error !== null && "cause" in error) {
    const cause = (error as { cause?: unknown }).cause;
    if (cause instanceof DOMException && cause.name === "AbortError") {
      return true;
    }
    if (cause instanceof Error && cause.name === "AbortError") {
      return true;
    }
  }

  return false;
};

export interface UseAvatarUploadReturn {
  avatarImageUrl: string | null;
  isUploadingAvatar: boolean;
  isDeletingAvatar: boolean;
  avatarUploadError: AvatarUploadError | null;
  avatarStatusText: string | null;
  selectedAvatarFile: File | null;
  avatarPreviewUrl: string | null;
  selectAvatarFile: (file: File | null) => Promise<void>;
  saveAvatar: () => Promise<void>;
  deleteAvatar: () => Promise<void>;
  retryAvatarUpload: () => Promise<void>;
  cancelCurrentUpload: () => void;
  resetAvatarTransientState: () => void;
}

export const useAvatarUpload = ({
  userId,
  userMetadata,
  showProfilePanel,
}: UseAvatarUploadOptions): UseAvatarUploadReturn => {
  const metadataFromSession = useMemo(() => getAvatarMetadata(userMetadata || {}), [userMetadata]);

  const [avatarPath, setAvatarPath] = useState<string | null>(metadataFromSession.avatarPath);
  const [avatarUpdatedAt, setAvatarUpdatedAt] = useState<string | null>(
    metadataFromSession.avatarUpdatedAt,
  );

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<AvatarUploadError | null>(null);
  const [avatarStatusText, setAvatarStatusText] = useState<string | null>(null);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setAvatarPath(metadataFromSession.avatarPath);
    setAvatarUpdatedAt(metadataFromSession.avatarUpdatedAt);
  }, [metadataFromSession.avatarPath, metadataFromSession.avatarUpdatedAt]);

  const avatarImageUrl = useMemo(
    () => buildAvatarPublicUrl(avatarPath, avatarUpdatedAt),
    [avatarPath, avatarUpdatedAt],
  );

  const revokePreviewUrl = useCallback((url: string | null) => {
    if (!url) return;
    URL.revokeObjectURL(url);
  }, []);

  const cancelCurrentUpload = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const resetAvatarTransientState = useCallback(() => {
    setAvatarUploadError(null);
    setAvatarStatusText(null);
    setSelectedAvatarFile(null);
    setAvatarPreviewUrl((previous) => {
      revokePreviewUrl(previous);
      return null;
    });
  }, [revokePreviewUrl]);

  useEffect(() => {
    if (showProfilePanel) return;
    cancelCurrentUpload();
    setIsUploadingAvatar(false);
    resetAvatarTransientState();
  }, [showProfilePanel, cancelCurrentUpload, resetAvatarTransientState]);

  useEffect(() => {
    return () => {
      cancelCurrentUpload();
      resetAvatarTransientState();
    };
  }, [cancelCurrentUpload, resetAvatarTransientState]);

  const selectAvatarFile = useCallback(
    async (file: File | null) => {
      if (!file) {
        resetAvatarTransientState();
        return;
      }

      cancelCurrentUpload();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setAvatarUploadError(null);
      setAvatarStatusText("Compressing image...");
      setIsUploadingAvatar(true);

      try {
        const result = await compressAvatar(file, {
          quality: 0.8,
          outputMimeType: "image/webp",
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          return;
        }

        setSelectedAvatarFile(result.file);
        setAvatarPreviewUrl((previous) => {
          revokePreviewUrl(previous);
          return result.previewUrl;
        });
        setAvatarStatusText(null);
      } catch (error) {
        const mapped = normalizeAvatarError(error, "compression", "Could not compress image.");
        console.error("[AvatarUpload][compression]", mapped);

        const isAborted =
          isAvatarUploadAborted(mapped) ||
          isAbortLikeError(error) ||
          isAbortLikeError(mapped.cause);

        if (isAborted) {
          return;
        }

        if (canUseOriginalAvatarAsFallback(file)) {
          const fallbackPreviewUrl = URL.createObjectURL(file);
          setSelectedAvatarFile(file);
          setAvatarPreviewUrl((previous) => {
            revokePreviewUrl(previous);
            return fallbackPreviewUrl;
          });
          setAvatarUploadError(
            createAvatarError(
              "compression",
              "Compression failed. You can still upload the original image.",
              mapped.cause,
            ),
          );
        } else {
          setAvatarUploadError(mapped);
          setSelectedAvatarFile(null);
          setAvatarPreviewUrl((previous) => {
            revokePreviewUrl(previous);
            return null;
          });
        }
      } finally {
        setIsUploadingAvatar(false);
        setAvatarStatusText(null);
      }
    },
    [cancelCurrentUpload, resetAvatarTransientState, revokePreviewUrl],
  );

  const saveAvatar = useCallback(async () => {
    if (!selectedAvatarFile || !userId) {
      setAvatarUploadError(createAvatarError("validation", "Please select an image before saving."));
      return;
    }

    cancelCurrentUpload();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setAvatarUploadError(null);
    setAvatarStatusText("Uploading avatar...");
    setIsUploadingAvatar(true);

    try {
      const avatarPathForFile = resolveAvatarPathForFile(userId, selectedAvatarFile);

      // Clean up old avatar if uploading a different format
      if (avatarPath && avatarPath !== avatarPathForFile) {
        await deleteOldAvatarFile(avatarPath, userId, controller.signal);
      }

      await uploadAvatarToStorage(selectedAvatarFile, userId, avatarPathForFile, controller.signal);

      if (controller.signal.aborted) {
        return;
      }

      const avatarUpdatedAtNow = new Date().toISOString();
      const persisted = await persistAvatarMetadata(avatarPathForFile, avatarUpdatedAtNow);

      if (controller.signal.aborted) {
        return;
      }

      setAvatarPath(persisted.metadata.avatarPath);
      setAvatarUpdatedAt(persisted.metadata.avatarUpdatedAt || avatarUpdatedAtNow);

      setAvatarPreviewUrl((previous) => {
        revokePreviewUrl(previous);
        return null;
      });
      setSelectedAvatarFile(null);
      setAvatarStatusText(null);
    } catch (error) {
      if (isAbortLikeError(error)) {
        return;
      }

      const mapped = normalizeAvatarError(error, "upload", "Avatar upload failed.");
      console.error(`[AvatarUpload][${mapped.category}]`, mapped);
      setAvatarUploadError(mapped);
      setAvatarStatusText(null);
    } finally {
      setIsUploadingAvatar(false);
    }
  }, [cancelCurrentUpload, revokePreviewUrl, selectedAvatarFile, userId, avatarPath]);

  const retryAvatarUpload = useCallback(async () => {
    await saveAvatar();
  }, [saveAvatar]);

  const deleteAvatar = useCallback(async () => {
    if (!userId) {
      setAvatarUploadError(createAvatarError("auth", "You must be signed in to remove an avatar."));
      return;
    }

    cancelCurrentUpload();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setAvatarUploadError(null);
    setAvatarStatusText("Removing avatar...");
    setIsDeletingAvatar(true);

    try {
      if (avatarPath) {
        await deleteOldAvatarFile(avatarPath, userId, controller.signal);
      }

      if (controller.signal.aborted) {
        return;
      }

      const cleared = await clearAvatarMetadata();

      if (controller.signal.aborted) {
        return;
      }

      setAvatarPath(cleared.metadata.avatarPath);
      setAvatarUpdatedAt(cleared.metadata.avatarUpdatedAt);
      setAvatarPreviewUrl((previous) => {
        revokePreviewUrl(previous);
        return null;
      });
      setSelectedAvatarFile(null);
      setAvatarStatusText(null);
    } catch (error) {
      if (isAbortLikeError(error)) {
        return;
      }

      const mapped = normalizeAvatarError(error, "metadata", "Failed to remove avatar.");
      console.error(`[AvatarDelete][${mapped.category}]`, mapped);
      setAvatarUploadError(mapped);
      setAvatarStatusText(null);
    } finally {
      setIsDeletingAvatar(false);
    }
  }, [avatarPath, cancelCurrentUpload, revokePreviewUrl, userId]);

  return {
    avatarImageUrl,
    isUploadingAvatar,
    isDeletingAvatar,
    avatarUploadError,
    avatarStatusText,
    selectedAvatarFile,
    avatarPreviewUrl,
    selectAvatarFile,
    saveAvatar,
    deleteAvatar,
    retryAvatarUpload,
    cancelCurrentUpload,
    resetAvatarTransientState,
  };
};
