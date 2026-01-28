import { useMemo } from 'react';
import { Variants, Transition } from 'framer-motion';

/**
 * Professional row deletion animation following best practices:
 * - Fade out: opacity 1 → 0
 * - Height collapse: natural height → 0
 * - Padding/margin collapse: prevents visual jumps
 * - Duration: 150ms (within 120-200ms range)
 * - Easing: cubic-bezier(0.2, 0, 0, 1) - Material Design's standard ease-out
 * - No scaling, bouncing, or overshoot
 * - Respects prefers-reduced-motion
 */

// Check for reduced motion preference
const prefersReducedMotion =
    typeof window !== 'undefined'
        ? window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
        : false;

// Professional easing: fast start, smooth deceleration
const EASE_OUT: [number, number, number, number] = [0.2, 0, 0, 1];

// Duration in seconds (150ms - middle of 120-200ms range)
const DURATION = prefersReducedMotion ? 0.001 : 0.15;
const OPACITY_DURATION = prefersReducedMotion ? 0.001 : 0.12;

// Transition config for exit animation
export const rowExitTransition: Transition = {
    duration: DURATION,
    ease: EASE_OUT,
    opacity: { duration: OPACITY_DURATION, ease: EASE_OUT },
    height: { duration: DURATION, ease: EASE_OUT },
};

// Transition config for layout shifts (sibling rows moving up)
export const layoutTransition: Transition = {
    duration: DURATION,
    ease: EASE_OUT,
};

/**
 * Row animation variants for Framer Motion
 */
export const rowVariants: Variants = {
    // Initial state when row enters
    initial: {
        opacity: 0,
        height: 'auto',
    },
    // Normal visible state
    visible: {
        opacity: 1,
        height: 'auto',
    },
    // Deleting state (while waiting for API)
    deleting: {
        opacity: 0.5,
        height: 'auto',
    },
    // Exit animation - collapse and fade
    exit: {
        opacity: 0,
        height: 0,
        paddingTop: 0,
        paddingBottom: 0,
        marginTop: 0,
        marginBottom: 0,
        transition: rowExitTransition,
    },
};

/**
 * Mobile card variants - similar but with overflow handling
 */
export const cardVariants: Variants = {
    initial: {
        opacity: 0,
        height: 'auto',
    },
    visible: {
        opacity: 1,
        height: 'auto',
    },
    deleting: {
        opacity: 0.5,
        height: 'auto',
    },
    exit: {
        opacity: 0,
        height: 0,
        marginTop: 0,
        marginBottom: 0,
        transition: rowExitTransition,
    },
};

/**
 * Hook to get animation props for a row
 */
export function useRowDeleteAnimation(isDeleting: boolean) {
    return useMemo(() => ({
        variants: rowVariants,
        initial: 'initial',
        animate: isDeleting ? 'deleting' : 'visible',
        exit: 'exit',
        layout: true,
        transition: layoutTransition,
        style: { overflow: 'hidden' as const },
    }), [isDeleting]);
}

/**
 * Hook to get animation props for a mobile card
 */
export function useCardDeleteAnimation(isDeleting: boolean) {
    return useMemo(() => ({
        variants: cardVariants,
        initial: 'initial',
        animate: isDeleting ? 'deleting' : 'visible',
        exit: 'exit',
        layout: true,
        transition: layoutTransition,
        style: { overflow: 'hidden' as const },
    }), [isDeleting]);
}

export { prefersReducedMotion };
