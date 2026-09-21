'use client';

import React from 'react';
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

export function PaginationFooter({
  page,
  hasMore,
  onPrev,
  onNext,
  skip,
}: {
  page: number;
  hasMore: boolean;
  onPrev: () => void;
  onNext: () => void;
  skip?: boolean;
}) {
  if (skip ?? (page === 0 && !hasMore)) return null;
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
            onClick={onBack}
            className="grid place-items-center w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-variant)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
      <span className="text-[20px] font-bold text-[var(--text)] leading-none">{value}</span>
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