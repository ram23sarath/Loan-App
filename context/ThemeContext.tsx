import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: (event?: React.MouseEvent) => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check localStorage first, then system preference
    const saved = localStorage.getItem('loan-app-theme') as Theme;
    if (saved) return saved;
    
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const isAnimating = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('loan-app-theme', theme);
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#1e293b' : '#4F46E5');
    }
  }, [theme]);

  const toggleTheme = (event?: React.MouseEvent) => {
    // Prevent multiple rapid toggles
    if (isAnimating.current) return;

    const newTheme = theme === 'light' ? 'dark' : 'light';
    
    // Get click coordinates or use center of screen
    const x = event?.clientX ?? window.innerWidth / 2;
    const y = event?.clientY ?? window.innerHeight / 2;
    
    // Calculate the max radius needed to cover the entire screen
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    // Check if View Transitions API is supported
    if (document.startViewTransition) {
      isAnimating.current = true;
      
      // Set CSS custom properties for the animation origin
      document.documentElement.style.setProperty('--theme-toggle-x', `${x}px`);
      document.documentElement.style.setProperty('--theme-toggle-y', `${y}px`);
      document.documentElement.style.setProperty('--theme-toggle-radius', `${maxRadius}px`);

      const transition = document.startViewTransition(() => {
        setThemeState(newTheme);
      });

      transition.finished.finally(() => {
        isAnimating.current = false;
      });
    } else {
      // Fallback for browsers without View Transitions API
      // Use CSS animation with overlay
      isAnimating.current = true;
      
      const overlay = document.createElement('div');
      overlay.className = 'theme-transition-overlay';
      overlay.style.setProperty('--x', `${x}px`);
      overlay.style.setProperty('--y', `${y}px`);
      overlay.style.setProperty('--radius', `${maxRadius}px`);
      overlay.style.backgroundColor = newTheme === 'dark' ? '#0f172a' : '#ffffff';
      document.body.appendChild(overlay);

      // Start the animation
      requestAnimationFrame(() => {
        overlay.classList.add('animate');
      });

      // Apply theme change mid-animation
      setTimeout(() => {
        setThemeState(newTheme);
      }, 400);

      // Remove overlay after animation
      setTimeout(() => {
        overlay.remove();
        isAnimating.current = false;
      }, 850);
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
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
