-- ترقية موظف إلى مدير من صفحة إدارة الحسابات (نسخة الويب)
-- نفّذ هذا الملف مرة واحدة في Supabase → SQL Editor.
-- لا يعدّل أي جدول موجود — يضيف دالة RPC فقط.
--
-- لماذا RPC بدل UPDATE مباشر من العميل؟
-- 1) العميل لا يستطيع تمرير دور 'manager' بنفسه: الدالة تتحقق أن الهدف موظف
--    وتمنع ترقية التجار نهائياً، وترفض إن لم يكن المنفّذ مديراً نشطاً.
-- 2) الحماية تُفرض في قاعدة البيانات نفسها ولو خُترقت الواجهة.

create or replace function public.promote_employee_to_manager(p_employee_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_executor_role user_role;
  v_executor_active boolean;
  v_target_role user_role;
  v_target_active boolean;
begin
  -- من ينفّذ العملية؟ يجب أن يكون مديراً نشطاً (أو مفتاح خدمة auth.role() = service_role)
  if auth.uid() is not null then
    select role, is_active into v_executor_role, v_executor_active
    from public.profiles where id = auth.uid();

    if v_executor_role <> 'manager' or v_executor_active is not true then
      raise exception 'FORBIDDEN: تنفيذ الترقية يتطلب حساب مدير نشط';
    end if;
  elseif auth.role() <> 'service_role' then
    raise exception 'UNAUTHORIZED: يجب تسجيل الدخول أولاً';
  end if;

  -- الهدف: موظف نشط فقط — التجار لا يُرقّون أبداً
  select role, is_active into v_target_role, v_target_active
  from public.profiles where id = p_employee_id;

  if not found then
    raise exception 'USER_NOT_FOUND: المستخدم غير موجود';
  end if;
  if v_target_role <> 'employee' then
    raise exception 'INVALID_ROLE: يمكن ترقية الموظفين فقط — التاجر يبقى تاجراً';
  end if;
  if v_target_active is not true then
    raise exception 'ACCOUNT_DISABLED: الحساب معطّل — فعّله أولاً قبل الترقية';
  end if;

  update public.profiles
  set role = 'manager',
      can_edit = true,
      can_delete = true,
      updated_at = now()
  where id = p_employee_id;

  return true;
end;
$$;

-- المديرون فقط يستدعون الدالة (ومفتاح الخدمة يتجاوز RLS افتراضياً)
grant execute on function public.promote_employee_to_manager(uuid) to authenticated;

-- رسائل أخطاء الدالة تُترجم في الواجهة عبر translateError (errorMessages):
-- FORBIDDEN → 'صلاحيات غير كافية — المدير فقط يستطيع تنفيذ هذا الإجراء'
-- USER_NOT_FOUND → 'المستخدم غير موجود'
-- INVALID_ROLE → 'الحساب ليس موظفاً أو تاجراً'
-- ACCOUNT_DISABLED → 'هذا الحساب معطّل ولا يمكن تعديله'
