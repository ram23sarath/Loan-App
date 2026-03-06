import { useEffect, useRef } from 'react';

/**
 * Hook to handle Android hardware back button (and browser back button) for modals.
 * When the modal opens, it pushes a state to the history stack.
 * When the back button is pressed, it catches the popstate event and closes the modal.
 * If the modal is closed programmatically (e.g. close button), it goes back in history to clean up.
 * 
 * @param isOpen boolean - whether the modal is currently open
 * @param onClose function - callback to close the modal
 */
export const useModalBackHandler = (isOpen: boolean, onClose: () => void) => {
    // Use a ref for onClose to avoid re-running effect when onClose changes
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    // Ref to track if the modal was closed by the back button
    const closedByBackRef = useRef(false);
    // Ref to track if we've pushed a state for this modal
    const pushedStateRef = useRef(false);

    useEffect(() => {
        if (isOpen) {
            // Only push state if we haven't already
            if (!pushedStateRef.current) {
                pushedStateRef.current = true;
                closedByBackRef.current = false;

                // Push a dummy state to the history stack
                window.history.pushState({ modalOpen: true }, '', window.location.href);

                const handlePopState = (event: PopStateEvent) => {
                    // The back button was pressed
                    closedByBackRef.current = true;
                    if (onCloseRef.current) {
                        onCloseRef.current();
                    }
                };

                window.addEventListener('popstate', handlePopState);

                return () => {
                    window.removeEventListener('popstate', handlePopState);

                    // If the modal was closed programmatically (not by back button),
                    // we need to go back to clean up the history state we pushed.
                    if (!closedByBackRef.current) {
                        window.history.back();
                    }
                    // Reset the flag so if the modal opens again, we push state again
                    pushedStateRef.current = false;
                };
            }
        }
    }, [isOpen]);
};
