import React, { useEffect, useRef } from "react";

interface PagePickerPopoverProps {
  /** Array of page numbers to display in the popover */
  pages: number[];
  /** Currently selected page number */
  currentPage: number;
  /** Callback when a page is selected */
  onPageChange: (page: number) => void;
  /** Key to distinguish "start" vs "end" pagination */
  openKey: "start" | "end";
  /** Whether this popover is open */
  isOpen: boolean;
  /** Callback to set open state */
  setOpen: (key: "start" | "end" | null) => void;
  /** Current offset for pagination within the popover */
  offset: number;
  /** Callback to set offset */
  setOffset: (offset: number) => void;
  /** Optional label for the popover (e.g., "Start Pages", "End Pages") */
  label?: string;
}

const PagePickerPopover: React.FC<PagePickerPopoverProps> = ({
  pages,
  currentPage,
  onPageChange,
  openKey,
  isOpen,
  setOpen,
  offset,
  setOffset,
  label = "Pages",
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRefsArray = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusedButtonIndex, setFocusedButtonIndex] = React.useState<
    number | null
  >(null);

  const itemsPerPage = 9; // 3x3 grid
  const maxOffset = Math.max(0, Math.ceil(pages.length / itemsPerPage) - 1);
  const visiblePages = pages.slice(
    offset * itemsPerPage,
    (offset + 1) * itemsPerPage
  );

  // Initialize button refs array when visible pages change
  React.useEffect(() => {
    buttonRefsArray.current = buttonRefsArray.current.slice(
      0,
      visiblePages.length
    );
  }, [visiblePages.length]);

  // Auto-focus the first button when popover opens or visible pages change
  React.useEffect(() => {
    if (isOpen && buttonRefsArray.current[0]) {
      buttonRefsArray.current[0].focus();
      setFocusedButtonIndex(0);
    }
  }, [isOpen, visiblePages.length]);

  // Handle keyboard navigation and click-outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key to close
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(null);
        return;
      }

      // Check if the popover or any of its children has focus
      const isPopoverFocused =
        popoverRef.current &&
        (document.activeElement === popoverRef.current ||
          popoverRef.current.contains(document.activeElement));

      if (!isPopoverFocused) return;

      // Arrow key navigation within the grid
      const currentFocused = focusedButtonIndex;
      if (currentFocused === null) return;

      let nextIndex: number | null = null;
      const colsPerRow = 3;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        // Move right in the same row
        if (
          (currentFocused + 1) % colsPerRow !== 0 &&
          currentFocused + 1 < visiblePages.length
        ) {
          nextIndex = currentFocused + 1;
        } else if (
          (currentFocused + 1) % colsPerRow === 0 ||
          currentFocused === visiblePages.length - 1
        ) {
          // At right edge or last item - advance to next page set
          if (offset < maxOffset) {
            setOffset(Math.min(maxOffset, offset + 1));
            // After offset changes, focus will be reset in the effect above
            return;
          }
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        // Move left in the same row
        if (currentFocused % colsPerRow !== 0) {
          nextIndex = currentFocused - 1;
        } else if (currentFocused % colsPerRow === 0 && currentFocused > 0) {
          // At left edge (but not first item) - go to previous page set
          if (offset > 0) {
            setOffset(Math.max(0, offset - 1));
            // After offset changes, focus will be reset in the effect above
            return;
          }
        } else if (currentFocused === 0 && offset > 0) {
          // At very first visible item but not first overall - go to previous page set
          setOffset(Math.max(0, offset - 1));
          return;
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        // Move down one row
        const nextRowIndex = currentFocused + colsPerRow;
        if (nextRowIndex < visiblePages.length) {
          nextIndex = nextRowIndex;
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        // Move up one row
        const prevRowIndex = currentFocused - colsPerRow;
        if (prevRowIndex >= 0) {
          nextIndex = prevRowIndex;
        }
      }

      // Focus the next button if found
      if (nextIndex !== null && buttonRefsArray.current[nextIndex]) {
        setFocusedButtonIndex(nextIndex);
        buttonRefsArray.current[nextIndex].focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    isOpen,
    focusedButtonIndex,
    visiblePages.length,
    setOpen,
    offset,
    maxOffset,
    setOffset,
  ]);

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (isOpen) {
            setOpen(null);
          } else {
            setOpen(openKey);
            setOffset(0);
          }
        }}
        className="px-2 text-gray-500 dark:text-dark-muted hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
        title={`Click to show ${label.toLowerCase()}`}
        aria-label={`${label} picker`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        ...
      </button>{" "}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg p-2 z-50 min-w-[140px]"
          role="dialog"
          aria-label={`${label} picker dialog`}
          aria-modal="true"
          tabIndex={-1}
        >
          {/* Navigation arrows */}
          <div className="flex items-center justify-between mb-2 px-1">
            <button
              onClick={() => setOffset(Math.max(0, offset - 1))}
              disabled={offset === 0}
              className="p-1 text-gray-500 dark:text-dark-muted hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous pages"
              title="Previous pages (Arrow Left)"
            >
              ‹
            </button>
            <span className="text-xs text-gray-500 dark:text-dark-muted">
              {offset * itemsPerPage + 1}-
              {Math.min((offset + 1) * itemsPerPage, pages.length)} of{" "}
              {pages.length}
            </span>
            <button
              onClick={() => setOffset(Math.min(maxOffset, offset + 1))}
              disabled={offset >= maxOffset}
              className="p-1 text-gray-500 dark:text-dark-muted hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next pages"
              title="Next pages (Arrow Right)"
            >
              ›
            </button>
          </div>
          {/* 3x3 grid of pages */}
          <div
            className="grid grid-cols-3 gap-1"
            role="group"
            aria-label={`${label} selection`}
          >
            {visiblePages.map((p, index) => (
              <button
                key={p}
                ref={(el) => {
                  if (el) {
                    buttonRefsArray.current[index] = el;
                  }
                }}
                onClick={() => {
                  onPageChange(p);
                  setOpen(null);
                }}
                onFocus={() => {
                  setFocusedButtonIndex(index);
                }}
                className={`px-2 py-1 text-sm rounded ${
                  currentPage === p
                    ? "bg-indigo-600 text-white"
                    : "text-gray-700 dark:text-dark-text hover:bg-indigo-100 dark:hover:bg-slate-600"
                }`}
                aria-label={`Page ${p}${currentPage === p ? " (current)" : ""}`}
                aria-current={currentPage === p ? "page" : undefined}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PagePickerPopover;
