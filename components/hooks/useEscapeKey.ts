import { useEffect } from "react";

/**
 * Hook to handle Escape key press with minimal dependencies.
 * Attaches a keydown listener when active is true and removes it when false or unmounted.
 *
 * @param active - Boolean indicating if the escape key listener should be active
 * @param onEscape - Callback function to execute when Escape is pressed
 */
export const useEscapeKey = (active: boolean, onEscape: () => void) => {
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, onEscape]);
};
