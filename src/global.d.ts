declare global {
  interface Window {
    isNativeApp?: () => boolean;
    NativeBridge?: {
      reportError: (
        message: string,
        stack?: string,
        componentStack?: string | null
      ) => void;
    };
  }
}

export {};
