-- سعة/وحدة المنتج (مثال: 500 غ، 1.5 لتر، 12 قطعة)
-- نفّذ هذا الملف مرة واحدة في Supabase → SQL Editor قبل نشر نسخة الويب التي تقرأ العمودين.
-- عمودان اختياريان فقط: لا يمسّان أي بيانات موجودة، وتطبيق الموبايل يتجاهلهما بأمان
-- (لا يرسلهما في التحديث فلا يمحوهما).
--
-- unit يحمل رمز الوحدة بالإنجليزية (kg, ml, l, piece …) والقائمة الكاملة في lib/constants.ts
-- حتى تُضاف وحدات جديدة من الواجهة دون تعديل القاعدة.

alter table public.products
  add column if not exists unit_value numeric,
  add column if not exists unit text;

-- القيمة والوحدة تأتيان معاً أو تغيبان معاً، والقيمة موجبة دائماً.
alter table public.products
  drop constraint if exists products_unit_pair_check;
alter table public.products
  add constraint products_unit_pair_check
  check ((unit_value is null) = (unit is null) and (unit_value is null or unit_value > 0));
