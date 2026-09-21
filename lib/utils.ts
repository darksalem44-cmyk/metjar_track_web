import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { PeriodKey } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─────────────── Formatters ───────────────

export function formatDistanceText(distance?: number): string {
  if (distance === null || distance === undefined) return '';
  if (distance < 1000) return `${distance.toFixed(0)} م`;
  return `${(distance / 1000).toFixed(1)} كم`;
}

export function formatPrice(price: number, currency: string = 'SYP'): string {
  const value = Number.isInteger(price) ? price.toString() : price.toFixed(1);
  return `${value} ${currency}`;
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const local = new Date(date);
  let hour = local.getHours();
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  const minute = local.getMinutes().toString().padStart(2, '0');
  return `${local.getFullYear()}/${local.getMonth() + 1}/${local.getDate()} عند ${hour}:${minute}`;
}

export function formatDateLocal(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export function relativeTime(value: string | Date, now?: Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const current = now ?? new Date();
  const diff = current.getTime() - date.getTime();

  if (diff < 60 * 1000) return 'الآن';

  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 60) {
    if (minutes === 1) return 'منذ دقيقة واحدة';
    if (minutes === 2) return 'منذ دقيقتين';
    return `منذ ${minutes} دقائق`;
  }

  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 24) {
    if (hours === 1) return 'منذ ساعة واحدة';
    if (hours === 2) return 'منذ ساعتين';
    return `منذ ${hours} ساعات`;
  }

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days === 1) return 'أمس';
  if (days === 2) return 'منذ يومين';
  if (days < 7) return `منذ ${days} أيام`;

  return formatDateTime(value);
}

export function formatActivityTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const local = new Date(date);
  let hour = local.getHours();
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  const minute = local.getMinutes().toString().padStart(2, '0');
  return `${local.getFullYear()}/${local.getMonth() + 1}/${local.getDate()}، ${hour}:${minute}`;
}

// ─────────────── Validators (تعيد سبب الخطأ أو null) ───────────────

export function required(value?: string | null, message = 'هذا الحقل مطلوب'): string | null {
  if (value === null || value === undefined || String(value).trim() === '') return message;
  return null;
}

export function nameValidator(value?: string | null, fieldName = 'الاسم'): string | null {
  const name = value?.trim() ?? '';
  if (!name) return `${fieldName} مطلوب`;
  if (name.length < 2) return `${fieldName} قصير جدًا`;
  return null;
}

export function addressValidator(value?: string | null): string | null {
  const address = value?.trim() ?? '';
  if (!address) return 'العنوان مطلوب';
  if (address.length < 3) return 'العنوان قصير جدًا';
  return null;
}

export function phoneValidator(value?: string | null): string | null {
  const phone = value?.trim() ?? '';
  if (!phone) return 'رقم الهاتف مطلوب';
  if (!/^[0-9]+$/.test(phone)) return 'رقم الهاتف غير صحيح';
  return null;
}

export function emailValidator(value?: string | null): string | null {
  const email = value?.trim() ?? '';
  if (!email) return 'البريد الإلكتروني مطلوب';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'صيغة البريد الإلكتروني غير صحيحة';
  return null;
}

export function passwordValidator(value?: string | null, minLength = 8): string | null {
  const password = value ?? '';
  if (!password) return 'كلمة المرور مطلوبة';
  if (password.length < minLength) {
    return `كلمة المرور يجب أن تكون ${minLength} محارف على الأقل`;
  }
  return null;
}

export function isFormValid(errors: Record<string, string | null>): boolean {
  return Object.values(errors).every((e) => e === null || e === undefined);
}

// ─────────────── Misc helpers ───────────────

export function generatePassword(length = 12): string {
  const lowercase = 'abcdefghjkmnpqrstuvwxyz';
  const uppercase = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = lowercase + uppercase + digits + special;
  const chars = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  while (chars.length < length) {
    chars.push(all[Math.floor(Math.random() * all.length)]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

export function isWithinPageRange(index: number, page: number, size: number): boolean {
  return index < page * size;
}

export function getPeriodRange(
  period: PeriodKey,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const from = new Date(now);
  const to = new Date(now);
  switch (period) {
    case 'today':
      from.setHours(0, 0, 0, 0);
      break;
    case 'yesterday': {
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to.setDate(to.getDate() - 1);
      to.setHours(23, 59, 59, 999);
      break;
    }
    case 'last7':
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      break;
    case 'last30':
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      break;
    case 'custom':
      from.setHours(0, 0, 0, 0);
      break;
  }
  return { from, to };
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function toSupabaseTimestamp(date: Date): string {
  return date.toISOString();
}