export type AvatarErrorCategory =
  | "auth"
  | "validation"
  | "compression"
  | "upload"
  | "metadata"
  | "unknown";

export type AvatarErrorCode = "ABORTED";

export type AvatarUploadError = {
  category: AvatarErrorCategory;
  message: string;
  cause?: unknown;
  code?: AvatarErrorCode;
};

export type AvatarMetadataShape = {
  avatarPath: string | null;
  avatarUpdatedAt: string | null;
};

export const AVATAR_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const AVATAR_TARGET_SIZE_BYTES = 200 * 1024;
export const AVATAR_HARD_MAX_SIZE_BYTES = 500 * 1024;
export const AVATAR_MAX_DIMENSION = 512;

export const SUPPORTED_INPUT_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

const SUPPORTED_OUTPUT_MIME_TYPES = [
  "image/webp",
  "image/jpeg",
  "image/png",
] as const;

const ALLOWED_AVATAR_EXTENSIONS = ["webp", "jpg", "jpeg", "png"] as const;

export type AvatarOutputMimeType = (typeof SUPPORTED_OUTPUT_MIME_TYPES)[number];

export const createAvatarError = (
  category: AvatarErrorCategory,
  message: string,
  cause?: unknown,
): AvatarUploadError => ({
  category,
  message,
  cause,
});

export const isAvatarUploadAborted = (error: AvatarUploadError): boolean => {
  return error.code === "ABORTED";
};

export const normalizeAvatarError = (
  error: unknown,
  fallbackCategory: AvatarErrorCategory = "unknown",
  fallbackMessage = "Avatar upload failed.",
): AvatarUploadError => {
  if (
    typeof error === "object" &&
    error !== null &&
    "category" in error &&
    "message" in error
  ) {
    return error as AvatarUploadError;
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return {
        ...createAvatarError("upload", "Upload cancelled.", error),
        code: "ABORTED",
      };
    }
    return createAvatarError(fallbackCategory, error.message || fallbackMessage, error);
  }

  return createAvatarError(fallbackCategory, fallbackMessage, error);
};

export const isSupportedAvatarInputMimeType = (mimeType: string): boolean => {
  const normalized = String(mimeType || "").toLowerCase().trim();
  return SUPPORTED_INPUT_MIME_TYPES.includes(
    normalized as (typeof SUPPORTED_INPUT_MIME_TYPES)[number],
  );
};

export const isLikelyHeic = (file: File): boolean => {
  const lowerName = file.name.toLowerCase();
  const mime = String(file.type || "").toLowerCase();
  return (
    mime.includes("heic") ||
    mime.includes("heif") ||
    lowerName.endsWith(".heic") ||
    lowerName.endsWith(".heif")
  );
};

export const preflightValidateAvatar = (file: File): void => {
  if (!file) {
    throw createAvatarError("validation", "Please select an image file.");
  }

  if (isLikelyHeic(file)) {
    throw createAvatarError(
      "validation",
      "HEIC/HEIF images are not supported yet. Please use JPG, PNG, or WebP.",
    );
  }

  if (!isSupportedAvatarInputMimeType(file.type)) {
    throw createAvatarError(
      "validation",
      "Unsupported file format. Please use JPG, PNG, or WebP.",
    );
  }

  if (file.size > AVATAR_MAX_FILE_SIZE_BYTES) {
    throw createAvatarError(
      "validation",
      "Image is too large. Please choose an image under 10 MB.",
    );
  }
};

export const supportsWebpEncoding = (): boolean => {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  try {
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
};

export const extensionFromMimeType = (mimeType: string): "webp" | "jpg" | "png" => {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/png") return "png";
  return "jpg";
};

export const normalizeOutputMimeType = (
  requested: AvatarOutputMimeType,
  hasTransparency: boolean,
): AvatarOutputMimeType => {
  const webpSupported = supportsWebpEncoding();

  if (requested === "image/webp") {
    return webpSupported ? "image/webp" : hasTransparency ? "image/png" : "image/jpeg";
  }

  if (requested === "image/png") {
    if (hasTransparency) return "image/png";
    return webpSupported ? "image/webp" : "image/jpeg";
  }

  if (hasTransparency && webpSupported) {
    return "image/webp";
  }

  if (hasTransparency) {
    return "image/png";
  }

  return "image/jpeg";
};

export const buildAvatarPath = (userId: string, mimeType: string): string => {
  const extension = extensionFromMimeType(mimeType);
  return `users/${userId}/avatar.${extension}`;
};

export const validateAvatarUploadPath = (path: string, userId: string): boolean => {
  if (!path || !userId) return false;
  if (path.startsWith("/")) return false;
  if (path.includes("..")) return false;

  const match = /^users\/([^/]+)\/avatar\.(webp|jpg|jpeg|png)$/i.exec(path);
  if (!match) return false;

  const pathUserId = match[1];
  const ext = match[2].toLowerCase();

  return pathUserId === userId && ALLOWED_AVATAR_EXTENSIONS.includes(ext as (typeof ALLOWED_AVATAR_EXTENSIONS)[number]);
};

export const getAvatarMetadata = (
  metadata: Record<string, unknown> | null | undefined,
): AvatarMetadataShape => {
  const avatarPathRaw = metadata?.avatar_path;
  const avatarUpdatedAtRaw = metadata?.avatar_updated_at;

  return {
    avatarPath: typeof avatarPathRaw === "string" && avatarPathRaw.trim() ? avatarPathRaw : null,
    avatarUpdatedAt:
      typeof avatarUpdatedAtRaw === "string" && avatarUpdatedAtRaw.trim()
        ? avatarUpdatedAtRaw
        : null,
  };
};

export const buildMergedAvatarMetadata = (
  currentMetadata: Record<string, unknown> | null | undefined,
  avatarPath: string,
  avatarUpdatedAt: string,
): Record<string, unknown> => {
  return {
    ...(currentMetadata || {}),
    avatar_path: avatarPath,
    avatar_updated_at: avatarUpdatedAt,
  };
};

export const canUseOriginalAvatarAsFallback = (file: File): boolean => {
  return isSupportedAvatarInputMimeType(file.type) && file.size <= AVATAR_HARD_MAX_SIZE_BYTES;
};
