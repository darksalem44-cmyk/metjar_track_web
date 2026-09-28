'use client';

import React, { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button, Spinner } from './controls';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** عدّاد مشترك: نافذتان فوق بعضهما لا تتركان الصفحة مقفلة عن التمرير بعد إغلاق إحداهما. */
let scrollLocks = 0;

function lockBodyScroll() {
  if (typeof document === 'undefined') return;
  scrollLocks += 1;
  document.body.style.overflow = 'hidden';
}

function unlockBodyScroll() {
  if (typeof document === 'undefined') return;
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.body.style.overflow = '';
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 480,
  hidden,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  hidden?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open || hidden) return;
    const panel = panelRef.current;
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const preferred = panel?.querySelector<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
    );
    (preferred ?? panel)?.focus();
    lockBodyScroll();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        panel?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      unlockBodyScroll();
      opener?.focus?.();
    };
  }, [open, onClose, hidden]);

  if (!open || hidden) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={typeof title === 'string' ? titleId : undefined}
        tabIndex={-1}
        style={{ maxWidth }}
        className="relative w-full bg-[var(--surface)] sm:rounded-2xl rounded-t-2xl border border-[var(--border)] shadow-xl max-h-[90vh] flex flex-col outline-none"
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)] shrink-0">
            <h3 id={titleId} className="text-[15px] font-bold text-[var(--text)]">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="grid place-items-center w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-variant)]"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-4 py-4 min-h-0">{children}</div>
        {footer && (
          <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  tone = 'danger',
  loading,
  onConfirm,
  onClose,
  children,
  hidden,
}: {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: React.ReactNode;
  hidden?: boolean;
}) {
  return (
    <Modal open={open} onClose={hidden ? () => {} : onClose} title={title} hidden={hidden}>
      {message && <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{message}</p>}
      {children}
      <div className="flex items-center justify-end gap-2 mt-5">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          {cancelText}
        </Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}

export function LoadingBlock({ text }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-12 gap-2">
      <Spinner size={22} />
      {text && <span className="text-[13px] text-[var(--text-secondary)]">{text}</span>}
    </div>
  );
}

export { cn };