-- سعات وأسعار إضافية للمنتج الواحد (مثال: 500 غ بسعر، 1 كغ بسعر آخر)
-- نفّذ هذا الملف مرة واحدة في Supabase → SQL Editor قبل نشر نسختي الويب والموبايل.
--
-- التصميم:
-- • السعة الأساسية تبقى في الأعمدة الحالية (price, unit_value, unit) كما هي، فلا يتغير شيء
--   للمنتجات الحالية ولا لنسخ التطبيق القديمة.
-- • price_options يحمل السعات الإضافية فقط، كل عنصر: {"unit_value": 1, "unit": "kg", "price": 22000}
--   والعملة واحدة للمنتج كله (عمود currency).
-- • لا تُضاف سعات إضافية إلا إذا كانت للمنتج سعة أساسية (unit غير فارغ).

alter table public.products
  add column if not exists price_options jsonb not null default '[]'::jsonb;

-- يتحقق من شكل كل عنصر: سعة موجبة، ورمز وحدة غير فارغ، وسعر رقمي غير سالب.
create or replace function public.product_price_options_valid(options jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(options) = 'array'
    and not exists (
      select 1
      from jsonb_array_elements(options) as o
      -- is distinct from: مفتاح مفقود يعطي null فيُعدّ خطأً بدل أن يمرّ
      where jsonb_typeof(o) is distinct from 'object'
         or jsonb_typeof(o -> 'unit_value') is distinct from 'number'
         or jsonb_typeof(o -> 'unit') is distinct from 'string'
         or jsonb_typeof(o -> 'price') is distinct from 'number'
         or (o ->> 'unit_value')::numeric <= 0
         or length(btrim(o ->> 'unit')) = 0
         or (o ->> 'price')::numeric < 0
    );
$$;

alter table public.products
  drop constraint if exists products_price_options_check;
alter table public.products
  add constraint products_price_options_check
  check (
    public.product_price_options_valid(price_options)
    and (jsonb_array_length(price_options) = 0 or unit is not null)
  );
