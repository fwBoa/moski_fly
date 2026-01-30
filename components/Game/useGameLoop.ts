'use client';

import { useRef, useEffect, useCallback } from 'react';

interface GameLoopOptions {
    onUpdate: (deltaTime: number) => void;
    isRunning: boolean;
}

export function useGameLoop({ onUpdate, isRunning }: GameLoopOptions) {
    const frameIdRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    const callbackRef = useRef(onUpdate);

    // Keep callback ref updated
    useEffect(() => {
        callbackRef.current = onUpdate;
    }, [onUpdate]);

    const loop = useCallback((timestamp: number) => {
        if (lastTimeRef.current === 0) {
            lastTimeRef.current = timestamp;
        }

        const deltaTime = Math.min(timestamp - lastTimeRef.current, 32); // Cap at ~30fps minimum
        lastTimeRef.current = timestamp;

        callbackRef.current(deltaTime);

        frameIdRef.current = requestAnimationFrame(loop);
    }, []);

    useEffect(() => {
        if (isRunning) {
            lastTimeRef.current = 0;
            frameIdRef.current = requestAnimationFrame(loop);
        } else {
            if (frameIdRef.current) {
                cancelAnimationFrame(frameIdRef.current);
                frameIdRef.current = null;
            }
        }

        return () => {
            if (frameIdRef.current) {
                cancelAnimationFrame(frameIdRef.current);
            }
        };
    }, [isRunning, loop]);
}

export default useGameLoop;
