-- متغيرات المنتج (مثال: أحمر، أزرق، XL، 250 غ…) كمصفوفة نصوص
-- نفّذ هذا الملف مرة واحدة في Supabase → SQL Editor قبل نشر نسختي الويب والموبايل
-- اللتين تقرآن العمود وتكتبانه. لا يمسّ أي بيانات موجودة: المنتجات الحالية تأخذ مصفوفة فارغة.

alter table public.products
  add column if not exists variants text[] not null default '{}';

-- لا قيم فارغة داخل المصفوفة (الواجهتان تحذفان الحقول الفارغة قبل الحفظ).
alter table public.products
  drop constraint if exists products_variants_no_blank_check;
alter table public.products
  add constraint products_variants_no_blank_check
  check (array_position(variants, '') is null and array_position(variants, null) is null);
