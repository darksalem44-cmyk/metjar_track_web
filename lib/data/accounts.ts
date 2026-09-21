import { supabase } from '@/lib/supabase';
import type { ActorWithProfile, Profile, UserRole } from '@/lib/types';
import { translateError, AppConstants } from '@/lib/constants';
import { resolvePage, type PageParams, type PageResult } from './base';

export function mapAccount(row: any): ActorWithProfile {
  return {
    id: row.id,
    role: (row.role ?? 'merchant') as ActorWithProfile['role'],
    email: row.email ?? undefined,
    fullName: row.full_name ?? '',
    canEdit: !!row.can_edit,
    canDelete: !!row.can_delete,
    isActive: row.is_active !== false,
    createdAt: row.created_at,
  };
}

function mapProfileRow(row: any): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name ?? '',
    role: row.role,
    createdAt: row.created_at,
    canEdit: !!row.can_edit,
    canDelete: !!row.can_delete,
    isActive: row.is_active !== false,
  };
}

export interface AccountListParams extends PageParams {
  role: UserRole;
  search?: string;
  filter: 'all' | 'active' | 'disabled' | 'withPermissions';
}

export async function fetchAccounts(params: AccountListParams): Promise<PageResult<ActorWithProfile>> {
  const { page, pageSize, role, search, filter } = params;
  let query = supabase
    .from('profiles')
    .select('id, email, full_name, role, can_edit, can_delete, is_active, created_at')
    .eq('role', role);

  if (search?.trim()) {
    query = query.or(`full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
  }
  if (filter === 'active') {
    query = query.eq('is_active', true);
  } else if (filter === 'disabled') {
    query = query.eq('is_active', false);
  } else if (filter === 'withPermissions') {
    query = query.or('can_edit.eq.true,can_delete.eq.true');
  }

  const rangeStart = page * pageSize;
  const { data, error } = await query
    .order('full_name', { ascending: true })
    .range(rangeStart, rangeStart + pageSize);
  if (error) throw translateError(error);
  return resolvePage((data ?? []).map(mapAccount), page, pageSize);
}

export async function fetchAllAccountsByRole(role: UserRole): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', role)
    .order('full_name', { ascending: true });
  if (error) throw translateError(error);
  return (data ?? []).map(mapProfileRow);
}

export async function fetchAllAccounts(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name', { ascending: true });
  if (error) throw translateError(error);
  return (data ?? []).map(mapProfileRow);
}

export async function createEmployeeAccount(opts: {
  email: string;
  password: string;
  fullName: string;
}): Promise<void> {
  const email = opts.email.trim().toLowerCase();
  if (!email.includes('@')) throw 'يرجى إدخال بريد إلكتروني صحيح';
  if (opts.password.length < 8) throw 'كلمة المرور يجب أن تكون 8 محارف على الأقل';
  if (!opts.fullName.trim()) throw 'يرجى إدخال اسم الموظف';
  const { error } = await supabase.functions.invoke('create-employee', {
    body: { email, password: opts.password, full_name: opts.fullName.trim() },
  });
  if (error) throw _functionErrorMessage(error, 'تعذر إنشاء الموظف');
}

export async function createMerchantAccount(opts: {
  email: string;
  password: string;
  fullName: string;
}): Promise<{ merchant: ActorWithProfile }> {
  const response = await supabase.functions.invoke('create-merchant', {
    body: {
      email: opts.email.trim().toLowerCase(),
      password: opts.password,
      full_name: opts.fullName.trim(),
    },
  });
  const data = response.data as any;
  if (!data || data['success'] !== true) {
    const message =
      (typeof data?.['error'] === 'string' && data['error']) ||
      (typeof data?.['message'] === 'string' && data['message']) ||
      'تعذر إنشاء التاجر';
    throw message;
  }
  const merchant = data['merchant'];
  if (!merchant) throw 'استجابة غير صالحة من الخادم';
  return { merchant: mapAccount(merchant) };
}

export async function updateAccountActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw translateError(error);
}

export async function updateAccountPermissions(
  id: string,
  canEdit: boolean,
  canDelete: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ can_edit: canEdit, can_delete: canDelete, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw translateError(error);
}

export async function adminResetPassword(accountId: string, newPassword: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw 'يجب تسجيل الدخول أولاً';
  if (newPassword.length < 8 || newPassword.length > 128) {
    throw 'كلمة المرور يجب أن تكون بين 8 و128 محرفاً';
  }

  const res = await fetch(
    `${AppConstants.supabaseUrl}/functions/v1/admin-reset-user-password`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      // نفس عقد تطبيق الموبايل: كلمة المرور الجديدة يحددها المدير
      body: JSON.stringify({ user_id: accountId, new_password: newPassword }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw translateError(String(body?.error ?? body?.message ?? 'تعذر إعادة تعيين كلمة المرور'));
  }
  if (body && typeof body === 'object' && body['success'] !== true) {
    throw translateError(String(body?.error ?? body?.message ?? 'تعذر إعادة تعيين كلمة المرور'));
  }
}

function _functionErrorMessage(error: any, fallback: string): string {
  if (typeof error?.message === 'string') return translateError(error.message);
  const details = error?.context?.message || error?.context?.error || error?.message;
  if (typeof details === 'string' && details.trim()) return details;
  return fallback;
}

export { getProfile, getProfileByEmail } from './profiles';