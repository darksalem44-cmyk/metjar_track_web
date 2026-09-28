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
    'w-full field text-[var(--text)] text-[13px] rounded-[12px] px-3 py-2.5 placeholder:text-[var(--text-muted)] disabled:opacity-45 disabled:cursor-not-allowed',
    hasError
      ? 'border-[var(--error)] hover:border-[var(--error)] focus:border-[var(--error)] focus:shadow-[var(--ring-error)]'
      : undefined,
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
        <label htmlFor={id} className="block ps-0.5 text-[12px] font-semibold text-[var(--text-secondary)]">
          {label}
          {required && <span className="text-[var(--error)] ms-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={messageId} className="anim-fade text-[11px] font-medium text-[var(--error)]">{error}</p>
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
    <div className={cn('group relative', className)}>
      <Search
        className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] transition-colors group-focus-within:text-[var(--primary)]"
        aria-hidden="true"
      />
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
          className="absolute end-2.5 top-1/2 -translate-y-1/2 grid place-items-center w-6 h-6 rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-variant)] active:scale-90"
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