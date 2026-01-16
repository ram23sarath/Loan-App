import { Variants } from 'framer-motion';

// ============================================
// Menu & Dropdown Animation Variants
// ============================================

export const menuBackdropVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const menuDropdownVariants: Variants = {
    hidden: { opacity: 0, scale: 0.9, y: -10 },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
            type: 'spring',
            stiffness: 400,
            damping: 25,
            staggerChildren: 0.05,
            delayChildren: 0.1,
        },
    },
    exit: {
        opacity: 0,
        scale: 0.95,
        y: -5,
        transition: { duration: 0.15 },
    },
};

export const menuItemVariants: Variants = {
    hidden: { opacity: 0, x: -10 },
    visible: {
        opacity: 1,
        x: 0,
        transition: { type: 'spring', stiffness: 300, damping: 24 },
    },
};

// ============================================
// Modal Animation Variants
// ============================================

export const modalBackdropVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const modalContentVariants: Variants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
            type: 'spring',
            stiffness: 350,
            damping: 25,
        },
    },
    exit: {
        opacity: 0,
        scale: 0.95,
        y: 10,
        transition: { duration: 0.15 },
    },
};

// ============================================
// Button Animation Variants
// ============================================

export const buttonVariants: Variants = {
    idle: { scale: 1 },
    hover: {
        scale: 1.02,
        transition: { type: 'spring', stiffness: 400, damping: 20 },
    },
    tap: { scale: 0.98 },
};

export const toolButtonVariants: Variants = {
    idle: { scale: 1, x: 0 },
    hover: {
        scale: 1.02,
        x: 4,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        transition: { type: 'spring', stiffness: 400, damping: 20 },
    },
    tap: { scale: 0.98 },
};

// ============================================
// Avatar Animation Variants
// ============================================

export const avatarVariants: Variants = {
    idle: { scale: 1 },
    hover: {
        scale: 1.08,
        boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
        transition: { type: 'spring', stiffness: 400, damping: 20 },
    },
    tap: { scale: 0.95 },
};

// ============================================
// Notification Animation Variants
// ============================================

export const notificationItemVariants: Variants = {
    hidden: { opacity: 0, scale: 0.8, filter: 'blur(10px)' },
    visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
    exit: {
        opacity: 0,
        scale: 0.9,
        x: [0, 20, -20, 0], // Shake
        filter: ['blur(0px)', 'blur(5px)', 'blur(10px)'],
        transition: { duration: 0.8, ease: 'easeInOut' },
    },
    swipeExit: {
        opacity: 0,
        x: 0,
        transition: { duration: 0.3, ease: 'easeOut' },
    },
};

export const checkmarkVariants: Variants = {
    hidden: { scale: 0, opacity: 0 },
    visible: {
        scale: 1,
        opacity: 1,
        transition: {
            type: 'spring',
            stiffness: 400,
            damping: 20,
        },
    },
    exit: {
        scale: 0.8,
        opacity: 0,
        transition: { duration: 0.2 },
    },
};

export const checkmarkPathVariants: Variants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
        pathLength: 1,
        opacity: 1,
        transition: {
            duration: 0.4,
            ease: 'easeInOut',
        },
    },
};

// ============================================
// Helper Functions
// ============================================

export const getButtonCenter = (button: HTMLElement): { x: number; y: number } => {
    const rect = button.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
    };
};
