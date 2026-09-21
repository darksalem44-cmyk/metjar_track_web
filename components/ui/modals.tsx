'use client';

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button, Spinner } from './controls';

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
  useEffect(() => {
    if (!open || hidden) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, hidden]);

  if (!open || hidden) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        style={{ maxWidth }}
        className="relative w-full bg-[var(--surface)] sm:rounded-2xl rounded-t-2xl border border-[var(--border)] shadow-xl max-h-[90vh] flex flex-col"
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)] shrink-0">
            <h3 className="text-[15px] font-bold text-[var(--text)]">{title}</h3>
            <button
              onClick={onClose}
              className="grid place-items-center w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-variant)]"
            >
              <X className="w-4 h-4" />
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