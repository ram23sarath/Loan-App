import { apiRequest } from './apiClient';

export type CustomerAvatarMetadata = {
  avatarPath: string | null;
  avatarUpdatedAt: string | null;
};

type CustomerAvatarResponse = {
  success?: boolean;
  avatarPath?: string | null;
  avatarUpdatedAt?: string | null;
};

const EMPTY_AVATAR: CustomerAvatarMetadata = {
  avatarPath: null,
  avatarUpdatedAt: null,
};

export const fetchCustomerAvatarMetadata = async (
  customerUserId: string,
  accessToken?: string | null,
): Promise<CustomerAvatarMetadata> => {
  const normalizedCustomerUserId = String(customerUserId || '').trim();
  if (!normalizedCustomerUserId || !accessToken) {
    return EMPTY_AVATAR;
  }

  const endpoint = `/.netlify/functions/get-customer-avatar-metadata?customer_user_id=${encodeURIComponent(normalizedCustomerUserId)}`;

  try {
    const response = await apiRequest<CustomerAvatarResponse>(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeoutMs: 10000,
      retries: 1,
    });

    return {
      avatarPath:
        typeof response?.avatarPath === 'string' && response.avatarPath.trim()
          ? response.avatarPath.trim()
          : null,
      avatarUpdatedAt:
        typeof response?.avatarUpdatedAt === 'string' && response.avatarUpdatedAt.trim()
          ? response.avatarUpdatedAt.trim()
          : null,
    };
  } catch {
    return EMPTY_AVATAR;
  }
};
