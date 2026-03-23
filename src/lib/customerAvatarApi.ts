import { buildAvatarPublicUrl } from './avatarStorage';

export type CustomerAvatarMetadata = {
  avatarPath: string | null;
  avatarUpdatedAt: string | null;
};

const EMPTY_AVATAR: CustomerAvatarMetadata = {
  avatarPath: null,
  avatarUpdatedAt: null,
};

const AVATAR_EXTENSIONS = ['webp', 'jpg', 'jpeg', 'png'] as const;

const probeImageUrl = (url: string, timeoutMs = 2500): Promise<boolean> =>
  new Promise((resolve) => {
    const image = new Image();
    let settled = false;

    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      resolve(result);
    };

    const timeoutId = window.setTimeout(() => {
      finish(false);
    }, timeoutMs);

    image.onload = () => {
      clearTimeout(timeoutId);
      finish(true);
    };

    image.onerror = () => {
      clearTimeout(timeoutId);
      finish(false);
    };

    image.src = url;
  });

const resolveAvatarPathFromPublicStorage = async (
  customerUserId: string,
): Promise<string | null> => {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return null;
  }

  for (const extension of AVATAR_EXTENSIONS) {
    const avatarPath = `users/${customerUserId}/avatar.${extension}`;
    const avatarUrl = buildAvatarPublicUrl(avatarPath, null);
    if (!avatarUrl) continue;

    const exists = await probeImageUrl(avatarUrl);
    if (exists) return avatarPath;
  }

  return null;
};

export const fetchCustomerAvatarMetadata = async (
  customerUserId: string,
  _accessToken?: string | null,
): Promise<CustomerAvatarMetadata> => {
  const normalizedCustomerUserId = String(customerUserId || '').trim();
  if (!normalizedCustomerUserId) {
    return EMPTY_AVATAR;
  }

  // Prefer direct public-storage resolution so avatar display doesn't depend
  // on serverless metadata lookup availability.
  const publicAvatarPath = await resolveAvatarPathFromPublicStorage(
    normalizedCustomerUserId,
  );
  if (publicAvatarPath) {
    return {
      avatarPath: publicAvatarPath,
      avatarUpdatedAt: null,
    };
  }

  return EMPTY_AVATAR;
};
