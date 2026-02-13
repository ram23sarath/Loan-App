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

    useEffect(() => {
        if (isOpen) {
            // Reset the flag
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

                // If closed by back button, the history is already popped.
                // If closed programmatically (and not by back button), we need to revert the pushState.
                // WE MUST CHECK IF THE CURRENT STATE IS OURS before going back, although
                // simply tracking closedByBackRef is usually sufficient for single-layer modals.
                if (!closedByBackRef.current) {
                    window.history.back();
                }
            };
        }
    }, [isOpen]);
};
