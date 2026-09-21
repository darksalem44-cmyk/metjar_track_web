'use client';

import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let cached: BeforeInstallPromptEvent | null = null;
let bound = false;
const listeners = new Set<(v: BeforeInstallPromptEvent | null) => void>();

function bind() {
  if (bound || typeof window === 'undefined') return;
  bound = true;
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    cached = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l(cached));
  });
  window.addEventListener('appinstalled', () => {
    cached = null;
    listeners.forEach((l) => l(null));
  });
}

/** يكشف إمكانية التثبيت وينفّذه. يعمل عبر كل مكوّنات الصفحة. */
export function useInstall() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(cached);

  useEffect(() => {
    bind();
    listeners.add(setEvent);
    return () => {
      listeners.delete(setEvent);
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!event) return 'unavailable';
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      return outcome;
    } finally {
      cached = null;
      setEvent(null);
    }
  }, [event]);

  return { canInstall: !!event, install };
}

/** هل يعمل التطبيق مثبتاً (نافذة مستقلة)؟ */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
}
