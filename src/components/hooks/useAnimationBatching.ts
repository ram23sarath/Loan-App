import { useCallback, useEffect, useRef } from 'react';

// Use a module-level variable to store callbacks.
// This acts as a singleton registry for the entire app session.
const callbacks: Map<string, (time: number, deltaTime: number) => void> = new Map();
let animationFrameId: number | null = null;
let lastTime: number = 0;

// Internal loop function
const loop = (time: number) => {
    if (lastTime === 0) lastTime = time;
    const deltaTime = time - lastTime;
    lastTime = time;

    // Run all registered callbacks
    callbacks.forEach((callback) => {
        callback(time, deltaTime);
    });

    if (callbacks.size > 0) {
        animationFrameId = requestAnimationFrame(loop);
    } else {
        animationFrameId = null;
        lastTime = 0;
    }
};

const startLoopCommon = () => {
    if (animationFrameId === null && callbacks.size > 0) {
        animationFrameId = requestAnimationFrame(loop);
    }
};

const stopLoopCommon = () => {
    if (callbacks.size === 0 && animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        lastTime = 0;
    }
};

// Debug helper — use Vite's import.meta.env.DEV when available and guard for non-browser
const ANIMATION_BATCHING_DEBUG =
    typeof window !== 'undefined' && !!(typeof import.meta !== 'undefined' ? (import.meta as any).env?.DEV : false);

if (ANIMATION_BATCHING_DEBUG && typeof window !== 'undefined') {
    // Expose for debugging if needed, or just log occasionally
    (window as any).__ANIMATION_BATCH_SIZE = () => callbacks.size;
}

export const useAnimationBatching = () => {
    const register = useCallback(
        (id: string, callback: (time: number, deltaTime: number) => void) => {
            const wasSizeZero = callbacks.size === 0;
            
            callbacks.set(id, callback);

            if (ANIMATION_BATCHING_DEBUG) {
                console.log(`[AnimationBatching] Registered: ${id}. Total: ${callbacks.size}`);
            }

            // Only start the loop if transitioning from 0 to >0 registrations
            if (wasSizeZero && callbacks.size > 0) {
                startLoopCommon();
            }
        },
        []
    );

    const unregister = useCallback(
        (id: string) => {
            if (callbacks.has(id)) {
                callbacks.delete(id);

                if (ANIMATION_BATCHING_DEBUG) {
                    console.log(`[AnimationBatching] Unregistered: ${id}. Total: ${callbacks.size}`);
                }

                // Only stop the loop when transitioning to zero registrations
                if (callbacks.size === 0) {
                    stopLoopCommon();
                }
            }
        },
        []
    );

    return { register, unregister };
};
