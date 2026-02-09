import { useEffect, useState, useRef, RefObject, useMemo } from 'react';

interface UseVisibilityTriggerOptions {
    threshold?: number | number[];
    root?: Element | Document | null;
    rootMargin?: string;
}

interface UseVisibilityTriggerResult {
    ref: RefObject<HTMLDivElement>;
    isVisible: boolean;
}

export function useVisibilityTrigger({
    threshold = 0.5,
    root = null,
    rootMargin = '0px',
}: UseVisibilityTriggerOptions = {}): UseVisibilityTriggerResult {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(true); // Default to true to avoid hydration mismatch/blocking

    // Memoize threshold to create a stable dependency; compares array values, not reference
    const memoizedThreshold = useMemo(() => threshold, [JSON.stringify(threshold)]);

    useEffect(() => {
        // Fallback for environments without IntersectionObserver (e.g., older browsers, JSDOM)
        if (typeof IntersectionObserver === 'undefined') {
            setIsVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            {
                threshold: memoizedThreshold,
                root,
                rootMargin,
            }
        );

        const currentRef = ref.current;
        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, [memoizedThreshold, root, rootMargin]);

    return { ref, isVisible };
}
