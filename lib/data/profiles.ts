import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/lib/types';
import { translateError } from '@/lib/constants';

export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return mapProfile(data);
}

export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();
  if (error) return null;
  return mapProfile(data);
}

/**
 * عند إنشاء حساب جديد يقوم مشغّل الخادم (trigger) عادة بإنشاء صف
 * profile بعد تأكيد البريد. لضمان قدرة التاجر على تسجيل الدخول فوراً
 * (كما يفعل تطبيق الموبايل)، ننشئ الصف هنا إن لم يكن موجوداً.
 */
export async function ensureProfileRow(
  userId: string,
  opts: {
    fullName?: string;
    email?: string;
    role?: UserRole;
    canEdit?: boolean;
    canDelete?: boolean;
  } = {},
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (existing) return;
    const { error } = await supabase.from('profiles').insert({
      id: userId,
      full_name: opts.fullName ?? '',
      email: opts.email ?? '',
      role: opts.role ?? 'merchant',
      can_edit: opts.canEdit ?? true,
      can_delete: opts.canDelete ?? false,
      is_active: true,
    });
    if (error) throw error;
  } catch {
    // في حال منع RLS الإدراج فنكتفي برسالة تفعيل البريد من صفحة التسجيل
    // ويكون المشغّل هو المسؤول عن إنشاء الصف لاحقاً.
  }
}

function mapProfile(row: any): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name ?? row.fullName ?? '',
    role: (row.role ?? 'merchant') as UserRole,
    createdAt: row.created_at ?? row.createdAt,
    canEdit: !!row.can_edit,
    canDelete: !!row.can_delete,
    isActive: row.is_active !== false,
  };
}

export async function updateProfileName(id: string, fullName: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', id);
  if (error) throw translateError(error);
}

export async function changePasswordForm(currentPassword: string, newPassword: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw 'تعذّر الحصول على حسابك الحالي';
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) {
    throw translateError(signInError);
  }
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) throw translateError(updateError);
}

export async function changePasswordWithRecovery(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw translateError(error);
}

// Realtime على ملف المستخدم (لسماع تعطيل الحساب أو تعديل الصلاحيات)
let profileChannelSeq = 0;

export function subscribeProfile(
  userId: string,
  onUpdate: (profile: any) => void,
) {
  // اسم فريد لكل اشتراك: في بيئة التطوير يعيد React StrictMode تشغيل الـ
  // effect قبل اكتمال إزالة القناة السابقة، وإعادة استخدام نفس الاسم تسبب
  // خطأ "cannot add postgres_changes callbacks after subscribe()".
  const channelName = `profile-${userId}-${++profileChannelSeq}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        onUpdate(payload.new as any);
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}