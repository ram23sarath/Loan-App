/**
 * Theme Configuration
 *
 * Centralized theme objects for light and dark modes.
 * Used across components to maintain consistent theming.
 */

export const lightTheme = {
  primaryBg: "#F8FAFC",
  skeleton: "#E2E8F0",
} as const;

export const darkTheme = {
  primaryBg: "#0F172A",
  skeleton: "#334155",
} as const;
