'use client';

import React, { useId } from 'react';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';
import { storeCategories } from '@/lib/constants';

function fieldBase(
  hasError?: boolean,
  className?: string,
): string {
  return cn(
    'w-full bg-[var(--input)] text-[var(--text)] text-[13px] rounded-xl border px-3 py-2.5 placeholder:text-[var(--text-muted)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
    hasError
      ? 'border-[var(--error)] focus:border-[var(--error)]'
      : 'border-[var(--border)] hover:border-[var(--border-light)] focus:border-[var(--primary)]',
    className,
  );
}

function FieldShell({
  label,
  error,
  hint,
  required,
  children,
}: {
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-[12px] font-semibold text-[var(--text-secondary)]">
          {label}
          {required && <span className="text-[var(--error)] ms-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[11px] text-[var(--error)]">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  error,
  hint,
  required,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
}) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      <input className={fieldBase(!!error, className)} {...rest} />
    </FieldShell>
  );
}

export function TextArea({
  label,
  error,
  hint,
  required,
  className,
  rows = 3,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
}) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      <textarea rows={rows} className={cn(fieldBase(!!error), 'resize-none', className)} {...rest} />
    </FieldShell>
  );
}

export function SelectField({
  label,
  error,
  hint,
  required,
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
}) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      <select className={cn(fieldBase(!!error), 'appearance-none', className)} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(fieldBase(), 'ps-9 pe-8')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/** قائمة فئات مع إكمال تلقائي (قابلة للتعديل يدويا). */
export function CategoryAutocomplete({
  value,
  onChange,
  label,
  error,
  required,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  error?: string | null;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} required={required}>
      <input
        id={id}
        list={`cat-${id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={fieldBase(!!error)}
      />
      <datalist id={`cat-${id}`}>
        {storeCategories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </FieldShell>
  );
}