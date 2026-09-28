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

/** يربط عنصر الإدخال بملصقه ورسالة خطئه عبر معرّفات فريدة. */
function useFieldIds(explicitId?: string) {
  const auto = useId();
  const id = explicitId ?? auto;
  return { id, messageId: `${id}-msg` };
}

function FieldShell({
  id,
  messageId,
  label,
  error,
  hint,
  required,
  children,
}: {
  id?: string;
  messageId?: string;
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
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
        <p id={messageId} className="text-[11px] text-[var(--error)]">{error}</p>
      ) : hint ? (
        <p id={messageId} className="text-[11px] text-[var(--text-muted)]">{hint}</p>
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
  id,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
}) {
  const field = useFieldIds(id);
  return (
    <FieldShell
      id={field.id}
      messageId={field.messageId}
      label={label}
      error={error}
      hint={hint}
      required={required}
    >
      <input
        id={field.id}
        className={fieldBase(!!error, className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? field.messageId : undefined}
        {...rest}
      />
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
  id,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
}) {
  const field = useFieldIds(id);
  return (
    <FieldShell
      id={field.id}
      messageId={field.messageId}
      label={label}
      error={error}
      hint={hint}
      required={required}
    >
      <textarea
        id={field.id}
        rows={rows}
        className={cn(fieldBase(!!error), 'resize-none', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? field.messageId : undefined}
        {...rest}
      />
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
  id,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
}) {
  const field = useFieldIds(id);
  return (
    <FieldShell
      id={field.id}
      messageId={field.messageId}
      label={label}
      error={error}
      hint={hint}
      required={required}
    >
      <select
        id={field.id}
        className={cn(fieldBase(!!error), 'appearance-none', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? field.messageId : undefined}
        {...rest}
      >
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
  const field = useFieldIds();
  const label = placeholder ?? 'بحث';
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
      <input
        type="text"
        id={field.id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={cn(fieldBase(), 'ps-9 pe-8')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="مسح البحث"
          className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <X className="w-4 h-4" aria-hidden="true" />
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
  const field = useFieldIds();
  return (
    <FieldShell id={field.id} label={label} error={error} required={required}>
      <input
        id={field.id}
        list={`cat-${field.id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={fieldBase(!!error)}
      />
      <datalist id={`cat-${field.id}`}>
        {storeCategories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </FieldShell>
  );
}