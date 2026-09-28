'use client';

import { useEffect, useState } from 'react';

/** فترة التحديث الافتراضية: دقيقة واحدة — نفس دقة نصوص «منذ ...». */
const TICK_MS = 60_000;

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * يعيد رسم المكوّن كل دقيقة لتبقى تسميات relativeTime محدّدة.
 * كل المكوّنات المشتركة تشترك في مؤقّت واحد بدل مؤقّت لكل شاشة.
 */
export function useNowTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    listeners.add(bump);
    if (!timer) {
      timer = setInterval(() => {
        for (const listener of listeners) listener();
      }, TICK_MS);
    }
    return () => {
      listeners.delete(bump);
      if (listeners.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);
  return tick;
}
