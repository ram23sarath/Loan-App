export const NOTIFICATION_TYPES = Object.freeze({
  BACKUP: "backup",
  USER_CREATED: "user_created",
  SENIORITY_REQUEST: "seniority_request",
  INSTALLMENT_DEFAULT: "installment_default",
  QUARTERLY_INTEREST: "quarterly_interest",
  SYSTEM: "system",
});

export const NOTIFICATION_STATUSES = Object.freeze({
  PENDING: "pending",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
});

export const NOTIFICATION_FILTER_KEYS = Object.freeze({
  ALL: "all",
  QUARTERLY_INTEREST: "quarterly_interest",
  SENIORITY: "seniority",
  DEFAULTS: "defaults",
});
