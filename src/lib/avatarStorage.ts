import { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import {
  AvatarMetadataShape,
  buildAvatarPath,
  buildMergedAvatarMetadata,
  createAvatarError,
  getAvatarMetadata,
  normalizeAvatarError,
  validateAvatarUploadPath,
} from "../utils/avatarUtils";

export const AVATAR_BUCKET = "avatars";

export const uploadAvatarToStorage = async (
  file: File,
  userId: string,
  avatarPath: string,
  signal?: AbortSignal,
): Promise<void> => {
  if (!userId) {
    throw createAvatarError("upload", "You must be signed in to upload an avatar.");
  }

  if (!validateAvatarUploadPath(avatarPath, userId)) {
    throw createAvatarError("validation", "Invalid avatar upload path.");
  }

  if (signal?.aborted) {
    throw new DOMException("Avatar upload aborted", "AbortError");
  }

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(avatarPath, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });

  if (signal?.aborted) {
    throw new DOMException("Avatar upload aborted", "AbortError");
  }

  if (error) {
    throw createAvatarError("upload", `Storage upload failed: ${error.message}`, error);
  }
};

export const buildAvatarPublicUrl = (
  avatarPath: string | null,
  avatarUpdatedAt: string | null,
): string | null => {
  if (!avatarPath) return null;

  const {
    data: { publicUrl },
  } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath);

  if (!publicUrl) return null;

  const finalUrl = avatarUpdatedAt
    ? `${publicUrl}?v=${encodeURIComponent(avatarUpdatedAt)}`
    : publicUrl;

  if (import.meta.env.DEV) {
    console.debug("[AvatarStorage] buildAvatarPublicUrl", {
      bucket: AVATAR_BUCKET,
      avatarPath,
      avatarUpdatedAt,
      publicUrl,
      finalUrl,
      hasPublicSegment: publicUrl.includes("/storage/v1/object/public/"),
    });
  }

  return finalUrl;
};

export const persistAvatarMetadata = async (
  avatarPath: string,
  avatarUpdatedAt: string,
): Promise<{ metadata: AvatarMetadataShape; session: Session | null }> => {
  const { data: beforeSessionData, error: beforeSessionError } = await supabase.auth.getSession();
  if (beforeSessionError) {
    throw createAvatarError("metadata", beforeSessionError.message, beforeSessionError);
  }

  const authenticatedSession = beforeSessionData.session;
  if (!authenticatedSession || !authenticatedSession.user) {
    throw createAvatarError("auth", "You must be signed in to update avatar metadata.");
  }

  const currentMetadata = authenticatedSession.user.user_metadata || {};
  const nextMetadata = buildMergedAvatarMetadata(currentMetadata, avatarPath, avatarUpdatedAt);

  const { error: metadataError } = await supabase.auth.updateUser({ data: nextMetadata });
  if (metadataError) {
    throw createAvatarError("metadata", metadataError.message, metadataError);
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw createAvatarError("metadata", sessionError.message, sessionError);
  }

  const metadata = getAvatarMetadata(sessionData.session?.user?.user_metadata as Record<string, unknown>);

  return {
    metadata,
    session: sessionData.session,
  };
};

export const resolveAvatarPathForFile = (userId: string, file: File): string => {
  return buildAvatarPath(userId, file.type);
};

export const deleteOldAvatarFile = async (
  previousAvatarPath: string | null,
  userId: string,
  signal?: AbortSignal,
): Promise<void> => {
  if (!previousAvatarPath || !userId) {
    return;
  }

  if (signal?.aborted) {
    throw new DOMException("Avatar cleanup aborted", "AbortError");
  }

  // Only delete if it's a different path (different format)
  try {
    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .remove([previousAvatarPath]);

    if (error) {
      // Log but don't throw - cleanup failure shouldn't fail the upload
      console.warn("[AvatarStorage] Failed to delete old avatar:", error.message);
    }
  } catch (error) {
    // Log but don't throw - cleanup failure shouldn't fail the upload
    console.warn("[AvatarStorage] Failed to delete old avatar:", error);
  }
};

export const mapAvatarStorageError = (error: unknown) => {
  return normalizeAvatarError(error, "upload", "Avatar upload failed.");
};
