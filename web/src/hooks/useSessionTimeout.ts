'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseSessionTimeoutParams {
  /** Timeout duration in milliseconds (default: 15 minutes) */
  timeoutMs?: number;
  /** Callback when session times out */
  onTimeout: () => void;
  /** Whether the session is active */
  enabled?: boolean;
}

/**
 * Simple session timeout hook that tracks user activity and calls onTimeout when inactive too long.
 * Matches traditional finance behavior (banks, brokerages) - no warning modal, just auto-logout.
 */
export function useSessionTimeout({
  timeoutMs = 15 * 60 * 1000, // 15 minutes default
  onTimeout,
  enabled = true,
}: UseSessionTimeoutParams) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (enabled) {
      timeoutRef.current = setTimeout(() => {
        onTimeout();
      }, timeoutMs);
    }
  }, [enabled, timeoutMs, onTimeout]);

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Start the timer
    resetTimer();

    // Activity events to reset timer
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];

    const handleActivity = () => {
      resetTimer();
    };

    // Add event listeners with passive: true for better performance
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, resetTimer]);

  // Provide manual reset function for components that need it
  return {
    resetTimer,
  };
}
