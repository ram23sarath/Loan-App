import { useEffect, useRef } from "react";

/**
 * Hook to handle Escape key press with minimal dependencies.
 * Attaches a keydown listener when active is true and removes it when false or unmounted.
 * Uses a ref to store the latest onEscape callback, keeping the listener stable.
 *
 * @param active - Boolean indicating if the escape key listener should be active
 * @param onEscape - Callback function to execute when Escape is pressed
 */
export const useEscapeKey = (active: boolean, onEscape: () => void) => {
  const escapeRef = useRef(onEscape);

  // Update the ref whenever onEscape changes
  useEffect(() => {
    escapeRef.current = onEscape;
  }, [onEscape]);

  // Attach/remove listener based on active state only
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        escapeRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active]);
};
