'use client';

import React from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'surface';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-90 active:opacity-80 shadow-sm',
    secondary:
      'bg-[var(--primary-surface)] text-[var(--primary-dark)] dark:text-[var(--accent-text)] hover:bg-[var(--primary-surface-light)]',
    outline:
      'bg-transparent text-[var(--text)] border border-[var(--border-light)] hover:bg-[var(--surface-variant)]',
    surface:
      'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] shadow-sm hover:bg-[var(--surface-variant)]',
    danger:
      'bg-[var(--error)] text-[var(--on-error)] hover:opacity-90 active:opacity-80 shadow-sm',
    ghost:
      'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-variant)]',
  };
  const sizes = {
    sm: 'h-8 px-3 text-[12px] rounded-lg gap-1.5',
    md: 'h-10 px-4 text-[13px] rounded-xl gap-2',
    lg: 'h-12 px-6 text-[14px] rounded-xl gap-2',
  };
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap select-none',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Spinner({ size = 24, className }: { size?: number; className?: string }) {
  return <Loader2 style={{ width: size, height: size }} className={cn('animate-spin text-[var(--primary)]', className)} />;
}

export function CenteredSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Spinner size={28} />
      {label && <p className="text-[13px] text-[var(--text-secondary)]">{label}</p>}
    </div>
  );
}

type ChipTone = 'primary' | 'success' | 'accent' | 'warning' | 'neutral' | 'purple' | 'orange' | 'error';

const chipTones: Record<ChipTone, string> = {
  primary: 'bg-[var(--primary-surface)] text-[var(--primary-dark)] dark:text-[var(--accent-text)] border-[var(--primary-light)]',
  success: 'bg-[var(--green)]/15 text-[var(--green)] border-[var(--green)]/40',
  accent: 'bg-[var(--accent-surface)] text-[var(--accent-text)] border-[var(--accent)]/40',
  warning: 'bg-[var(--warning-surface)] text-[var(--warning)] border-[var(--warning)]/40',
  neutral: 'bg-[var(--surface-variant)] text-[var(--text-secondary)] border-[var(--border-light)]',
  purple: 'bg-[var(--purple-light)] text-[var(--purple)] border-[var(--purple)]/40',
  orange: 'bg-[var(--orange-light)] text-[var(--orange)] border-[var(--orange)]/40',
  error: 'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/40',
};

const toneText: Record<ChipTone, string> = {
  primary: 'text-[var(--primary)]',
  success: 'text-[var(--green)]',
  accent: 'text-[var(--accent-text)]',
  warning: 'text-[var(--warning)]',
  neutral: 'text-[var(--text)]',
  purple: 'text-[var(--purple)]',
  orange: 'text-[var(--orange)]',
  error: 'text-[var(--error)]',
};

export function Chip({
  label,
  tone = 'neutral',
  icon,
  className,
}: {
  label: React.ReactNode;
  tone?: ChipTone;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        chipTones[tone],
        className,
      )}
    >
      {icon}
      {label}
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  size = 'md',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const dims = size === 'sm' ? 'w-9 h-5' : 'w-11 h-6';
  const knob = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex items-center rounded-full transition-colors disabled:opacity-40 disabled:pointer-events-none shrink-0',
        dims,
        checked ? 'bg-[var(--primary)]' : 'bg-[var(--surface-variant)] border border-[var(--border-light)]',
      )}
    >
      <span
        className={cn(
          'absolute top-1/2 -translate-y-1/2 rounded-full bg-white dark:bg-[var(--surface)] shadow transition-all',
          knob,
          checked ? 'right-0.5' : 'right-[calc(100%-2px)] translate-x-full',
          // RTL: toggle knob moves from right
        )}
      />
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center gap-3">
      {icon && (
        <div className="grid place-items-center w-14 h-14 rounded-full bg-[var(--surface-variant)] text-[var(--text-muted)]">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-semibold text-[var(--text)]">{title}</p>
      {subtitle && <p className="text-[13px] text-[var(--text-secondary)] max-w-xs">{subtitle}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * نافذة أرقام الصفحات المنزلقة حول الصفحة الحالية.
 * مثال: 100 صفحة والصفحة الحالية 55 → [1, «…», 53, 54, 55, 56, 57, «…», 100]
 * دالة خالصة تُختبر في __smoke__.mjs — بلا أي اعتماد على React.
 */
export function paginationWindow(
  current: number,
  total: number,
  maxButtons = 5,
): (number | 'ellipsis')[] {
  if (total <= 1) return total === 1 ? [1] : [];
  const currentSafe = Math.min(Math.max(1, current), total);
  // كل الأرقام تتسع ضمن الحد المسموح + النهايتان → عرض كامل بلا فواصل
  if (total <= maxButtons + 2) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const side = Math.max(1, Math.floor((maxButtons - 1) / 2));
  let start = Math.max(2, currentSafe - side);
  let end = Math.min(total - 1, currentSafe + side);
  // أوسّع النافذة عند ملاصقة إحدى النهايتين حتى يثبت عدد الأزرار
  if (currentSafe - side <= 2) end = Math.min(total - 1, maxButtons);
  if (currentSafe + side >= total - 1) start = Math.max(2, total - maxButtons + 1);
  const out: (number | 'ellipsis')[] = [1];
  if (start > 2) out.push('ellipsis');
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push('ellipsis');
  out.push(total);
  return out;
}

/**
 * مؤشر ترقيم صفحات كامل: أرقام بنافذة منزلقة + سابق/تالي + إدخال قفز مباشر.
 * يتيح الانتقال من الصفحة 1 إلى 55 من أصل 100 بضغطة واحدة أو بكتابة الرقم.
 */
export function NumbersPaginationFooter({
  page,
  totalPages,
  onPage,
  loading = false,
}: {
  page: number; // صفري الأساس
  totalPages: number;
  onPage: (page: number) => void;
  loading?: boolean;
}) {
  const [jumpValue, setJumpValue] = useState('');
  const current = page + 1;
  const safeTotal = Math.max(totalPages, 1);
  const submitJump = () => {
    const target = parseInt(jumpValue, 10);
    if (!Number.isNaN(target) && target >= 1 && target <= safeTotal) {
      onPage(target - 1);
      setJumpValue('');
    }
  };
  const pages = paginationWindow(current, safeTotal);
  if (safeTotal <= 1) return null;
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <div className="flex items-center justify-center gap-1.5 flex-wrap" dir="rtl">
        <Button variant="surface" size="sm" onClick={() => onPage(page - 1)} disabled={page === 0 || loading}>
          السابق
        </Button>
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e${i}`} className="px-1 text-[12px] text-[var(--text-muted)] select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p - 1)}
              disabled={loading}
              aria-current={p === current ? 'page' : undefined}
              className={cn(
                'min-w-8 h-8 px-2 rounded-lg text-[12px] font-semibold transition-colors',
                p === current
                  ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-sm'
                  : 'bg-[var(--surface)] border border-[var(--border-light)] text-[var(--text-secondary)] hover:bg-[var(--surface-variant)]',
              )}
            >
              {p}
            </button>
          ),
        )}
        <Button variant="surface" size="sm" onClick={() => onPage(page + 1)} disabled={page + 1 >= safeTotal || loading}>
          التالي
        </Button>
      </div>
      {safeTotal > 10 && (
        <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
          <span>الانتقال إلى صفحة</span>
          <input
            type="number"
            min={1}
            max={safeTotal}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitJump();
            }}
            placeholder="1"
            dir="ltr"
            className="w-16 h-7 text-center rounded-lg border border-[var(--border)] bg-[var(--input)] text-[12px] text-[var(--text)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span>من {safeTotal}</span>
          <Button variant="ghost" size="sm" onClick={submitJump} disabled={loading}>
            انتقال
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * غلاف توافق قديم (سابق/تالي فقط) فوق المؤشر المرقّم.
 * عند تمرير total (عدد الصفحات) مع onPage يُعرض المؤشر المرقّم الكامل، وإلا يبقى الشكل القديم.
 */
export function PaginationFooter({
  page,
  hasMore,
  onPrev,
  onNext,
  skip,
  total,
  onPage,
  loading,
}: {
  page: number;
  hasMore: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  skip?: boolean;
  total?: number;
  /** مطلوب مع total: الانتقال المطلق إلى صفحة (صفري الأساس) — يدعم القفز لأي رقم */
  onPage?: (page: number) => void;
  loading?: boolean;
}) {
  if (skip ?? (page === 0 && !hasMore && !total)) return null;
  if (total !== undefined && total > 0 && onPage) {
    return <NumbersPaginationFooter page={page} totalPages={total} onPage={onPage} loading={loading} />;
  }
  return (
    <div className="flex items-center justify-center gap-3 py-4">
      <Button variant="surface" size="sm" onClick={onPrev} disabled={page === 0}>
        السابق
      </Button>
      <span className="text-[12px] text-[var(--text-secondary)]">صفحة {page + 1}</span>
      <Button variant="surface" size="sm" onClick={onNext} disabled={!hasMore}>
        التالي
      </Button>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  onBack,
  trailing,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  onBack?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-5">
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="رجوع"
            className="grid place-items-center w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-variant)]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-[16px] font-bold text-[var(--text)] truncate">{title}</h1>
          {subtitle && <p className="text-[12px] text-[var(--text-secondary)] truncate">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {trailing}
        {action}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tint?: ChipTone;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-4 gap-1.5">
      {icon && <span className="text-[var(--text-muted)]">{icon}</span>}
      <span className={cn('text-[20px] font-bold leading-none', tint ? toneText[tint] : 'text-[var(--text)]')}>
        {value}
      </span>
      <span className="text-[11px] text-[var(--text-secondary)]">{label}</span>
    </div>
  );
}

export function InfoCard({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
      {icon && (
        <span className="grid place-items-center w-8 h-8 rounded-lg bg-[var(--primary-surface-light)] text-[var(--primary-dark)] dark:text-[var(--accent-text)] shrink-0">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[11px] text-[var(--text-secondary)]">{label}</p>
        {value !== undefined && <p className="text-[13px] font-semibold text-[var(--text)] break-words">{value}</p>}
      </div>
    </div>
  );
}

export function Avatar({
  name,
  size = 40,
}: {
  name: string;
  size?: number;
}) {
  const initial = (name.trim()[0] ?? '؟').toUpperCase();
  return (
    <span
      style={{ width: size, height: size }}
      className="grid place-items-center rounded-full bg-[var(--primary-surface)] text-[var(--primary-dark)] dark:text-[var(--accent-text)] font-bold"
    >
      {initial}
    </span>
  );
}