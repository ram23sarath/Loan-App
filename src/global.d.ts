declare global {
  interface Window {
    isNativeApp?: () => boolean;
    sendToNative?: (type: string, payload?: any) => void;
    registerNativeHandler?: (handler: (message: any) => void) => void | (() => void);
    NativeBridge?: {
      requestAuth: () => void;
      logout: () => void;
      updateSession: (session: {
        accessToken: string;
        refreshToken: string;
        expiresAt: number;
        user: {
          id: string;
          email?: string;
          isScopedCustomer?: boolean;
          scopedCustomerId?: string | null;
        };
      }) => void;
      openExternalLink: (url: string) => void;
      hapticFeedback: (style: 'light' | 'medium' | 'heavy') => void;
      share: (content: { title?: string; text: string; url?: string }) => void;
      copyToClipboard: (text: string) => void;
      requestPushPermission: () => void;
      reportPageLoad: (route: string, title?: string) => void;
      reportError: (
        message: string,
        stack?: string,
        componentStack?: string | null
      ) => void;
      reportTheme: (mode: 'light' | 'dark') => void;
    };
  }
}

export {};
