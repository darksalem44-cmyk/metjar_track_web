'use client';

import { useEffect, useState } from 'react';
import { subscribeToasts, type ToastItem } from '@/lib/toast';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToasts(setItems);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed top-4 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {items.map((item) => (
        <div
          key={item.id}
          className={`anim-enter pointer-events-auto flex items-center gap-3 rounded-[14px] border px-3.5 py-2.5 shadow-[var(--shadow-lg)] max-w-md w-full ${
            item.type === 'error'
              ? 'bg-[var(--error-surface)] border-[var(--error)]/35'
              : 'glass border-[var(--border)]'
          }`}
        >
          {item.type === 'error' ? (
            <span className="grid place-items-center w-6 h-6 rounded-full bg-[var(--error)] text-[var(--on-error)]">
              <AlertCircle className="w-4 h-4" />
            </span>
          ) : item.type === 'success' ? (
            <span className="grid place-items-center w-6 h-6 rounded-full bg-[var(--green)]/14 text-[var(--green)]">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          ) : (
            <span className="grid place-items-center w-6 h-6 rounded-full bg-[var(--primary-surface)] text-[var(--primary-dark)] dark:text-[var(--brand-700)]">
              <Info className="w-4 h-4" />
            </span>
          )}
          <p
            className={`text-[13px] font-semibold leading-relaxed ${
              item.type === 'error' ? 'text-[var(--error-text)]' : 'text-[var(--text)]'
            }`}
          >
            {item.message}
          </p>
        </div>
      ))}
    </div>
  );
}