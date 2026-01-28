import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";

type Theme = "light" | "dark";

interface ThemeToggleOrigin {
  x: number;
  y: number;
}

interface ThemeContextType {
  theme: Theme;
  toggleTheme: (origin?: ThemeToggleOrigin) => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "light"; // SSR fallback
    }

    // Check localStorage first, then system preference
    try {
      const saved = localStorage.getItem("loan-app-theme") as Theme;
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // localStorage unavailable (private mode, etc.)
    }

    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  });
  const isAnimating = useRef(false);
  const timeoutIdsRef = useRef<number[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const overlayRef = useRef<HTMLElement | null>(null);

  // Cleanup function to prevent state updates on unmounted component
  useEffect(() => {
    return () => {
      // Clear all scheduled timeouts
      timeoutIdsRef.current.forEach((id) => clearTimeout(id));
      timeoutIdsRef.current = [];

      // Cancel RAF if pending
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      // Remove overlay if still in DOM
      if (overlayRef.current && overlayRef.current.parentNode) {
        overlayRef.current.remove();
        overlayRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("loan-app-theme", theme);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        "content",
        theme === "dark" ? "#1e293b" : "#4F46E5",
      );
    }
  }, [theme]);

  const toggleTheme = (origin?: ThemeToggleOrigin) => {
    // Prevent multiple rapid toggles
    if (isAnimating.current) return;

    const newTheme = theme === "light" ? "dark" : "light";

    // Get passed coordinates or fall back to center of the viewport
    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? window.innerHeight / 2;

    // Calculate the max radius needed to cover the entire screen
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    // Check if View Transitions API is supported
    if (document.startViewTransition) {
      isAnimating.current = true;

      // Set CSS custom properties for the animation origin
      document.documentElement.style.setProperty("--theme-toggle-x", `${x}px`);
      document.documentElement.style.setProperty("--theme-toggle-y", `${y}px`);
      document.documentElement.style.setProperty(
        "--theme-toggle-radius",
        `${maxRadius}px`,
      );

      // Set transition direction BEFORE starting (this is key!)
      // If currently dark, we're going to light mode
      document.documentElement.setAttribute(
        "data-theme-transition",
        theme === "dark" ? "to-light" : "to-dark",
      );

      const transition = document.startViewTransition(() => {
        setThemeState(newTheme);
      });

      transition.finished.finally(() => {
        document.documentElement.removeAttribute("data-theme-transition");
        isAnimating.current = false;
      });
    } else {
      // Fallback for browsers without View Transitions API
      // Use CSS animation with overlay
      isAnimating.current = true;

      const overlay = document.createElement("div");
      overlay.className = "theme-transition-overlay";
      overlay.style.setProperty("--theme-toggle-x", `${x}px`);
      overlay.style.setProperty("--theme-toggle-y", `${y}px`);
      overlay.style.setProperty("--theme-toggle-radius", `${maxRadius}px`);
      overlay.style.setProperty("--x", `${x}px`);
      overlay.style.setProperty("--y", `${y}px`);
      overlay.style.setProperty("--radius", `${maxRadius}px`);
      overlay.style.backgroundColor =
        newTheme === "dark" ? "#0f172a" : "#ffffff";
      document.body.appendChild(overlay);
      overlayRef.current = overlay;

      // Start the animation
      rafIdRef.current = requestAnimationFrame(() => {
        if (overlayRef.current) {
          overlayRef.current.classList.add("animate");
        }
        rafIdRef.current = null;
      });

      // Apply theme change mid-animation
      const themeTimeoutId = window.setTimeout(() => {
        setThemeState(newTheme);
      }, 750);
      timeoutIdsRef.current.push(themeTimeoutId);

      // Remove overlay after animation
      const cleanupTimeoutId = window.setTimeout(() => {
        if (overlayRef.current && overlayRef.current.parentNode) {
          overlayRef.current.remove();
          overlayRef.current = null;
        }
        isAnimating.current = false;
        // Remove these timeout IDs from the tracking array
        timeoutIdsRef.current = timeoutIdsRef.current.filter(
          (id) => id !== themeTimeoutId && id !== cleanupTimeoutId,
        );
      }, 1550);
      timeoutIdsRef.current.push(cleanupTimeoutId);
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
