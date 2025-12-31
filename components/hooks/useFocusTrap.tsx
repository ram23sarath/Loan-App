import { useEffect } from 'react';

export default function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, initialFocusSelector?: string) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusableSelector = 'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusable = () => Array.from(el.querySelectorAll<HTMLElement>(focusableSelector)).filter(n => n.offsetParent !== null);

    const initial = initialFocusSelector ? el.querySelector<HTMLElement>(initialFocusSelector) : getFocusable()[0];
    try {
      initial?.focus();
    } catch (e) { }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const nodes = getFocusable();
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      try { previouslyFocused?.focus(); } catch (e) { }
    };
  }, [containerRef, initialFocusSelector]);
}
