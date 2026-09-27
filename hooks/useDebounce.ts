/**
 * useDebounce Hook
 * 
 * Debounces a value, returning the debounced value after the specified delay.
 * Useful for search inputs, API calls, etc.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Debounce a value
 * 
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounce a callback function
 * 
 * @param callback - The function to debounce
 * @param delay - Delay in milliseconds
 * @returns The debounced function
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
}

/**
 * Debounce with leading edge option
 * 
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds
 * @param options - Options including leading edge
 * @returns The debounced value
 */
export function useDebounceWithOptions<T>(
  value: T,
  delay: number,
  options: { leading?: boolean } = {}
): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (options.leading && isFirstRender.current) {
      isFirstRender.current = false;
      setDebouncedValue(value);
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay, options.leading]);

  return debouncedValue;
}

export default useDebounce;
