'use client';

import React from 'react';
import { Copy, Check, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

export function CopyButton({
  text,
  className,
  label,
  iconOnly,
}: {
  text: string;
  className?: string;
  label?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast('تم النسخ', 'success', 1500);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast('تعذر النسخ', 'error');
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        'inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-lg px-2 py-1.5 transition-colors',
        copied ? 'text-[var(--green)]' : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-variant)]',
        className,
      )}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {!iconOnly && (copied ? 'تم النسخ' : (label ?? 'نسخ'))}
    </button>
  );
}

export function WhatsAppShareButton({ text, className }: { text: string; className?: string }) {
  const share = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };
  return (
    <button
      type="button"
      onClick={share}
      className={cn(
        'inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-lg px-2 py-1.5 transition-colors text-[var(--green)] hover:bg-[var(--surface-variant)]',
        className,
      )}
    >
      <MessageCircle className="w-3.5 h-3.5" />
      مشاركة واتساب
    </button>
  );
}

export function CreatedAccountActions({
  email,
  password,
  name,
}: {
  email: string;
  password: string;
  name: string;
}) {
  const summary = `تم إنشاء حساب ${name} في متجر تراك\nالبريد الإلكتروني: ${email}\nكلمة المرور: ${password}`;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 bg-[var(--input)] rounded-lg p-3 border border-[var(--border)]">
        <div className="min-w-0">
          <p className="text-[11px] text-[var(--text-secondary)] mb-1" dir="ltr">{email}</p>
          <p className="text-[13px] font-mono font-semibold text-[var(--text)] tracking-wider" dir="ltr">
            {password}
          </p>
        </div>
        <CopyButton text={`${email}\n${password}`} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-[var(--text-secondary)]">حفظ كلمة المرور ومشاركتها</p>
        <div className="flex items-center gap-1">
          <CopyButton text={summary} iconOnly label="نسخ جميع البيانات" />
          <WhatsAppShareButton text={summary} />
        </div>
      </div>
    </div>
  );
}

export function PermissionRow({
  title,
  description,
  checked,
  disabled,
  onChange,
  danger,
}: {
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <label className={cn('flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 cursor-pointer select-none',
      danger ? 'border-[var(--warning)]/40 bg-[var(--warning-surface)]' : 'border-[var(--border)] bg-[var(--surface)]')}>
      <div>
        <p className="text-[13px] font-semibold text-[var(--text)]">{title}</p>
        {description && <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{description}</p>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          'w-5 h-5 rounded accent-[var(--primary)] shrink-0',
          disabled && 'opacity-40',
        )}
      />
    </label>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[12px] font-semibold text-[var(--error)]">{message}</p>;
}