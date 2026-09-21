-- تقرير التنبيهات الأسبوعي + إشعارات PWA (Web Push)
-- نفّذ هذا الملف مرة واحدة في Supabase → SQL Editor.
-- كل ما فيه إضافي: لا يعدّل أي جدول موجود.

-- ─────────────── 1) اشتراكات الإشعارات ───────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- كل مستخدم يرى اشتراكاته فقط ويديرها بنفسه (الدالة المجدولة تستخدم مفتاح الخدمة فتتجاوز RLS)
drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- ─────────────── 2) التقارير المحفوظة ───────────────
create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  week_start timestamptz not null unique,
  week_end timestamptz not null,
  label text not null,
  total integer not null default 0,
  critical integer not null default 0,
  warning integer not null default 0,
  info integer not null default 0,
  html text not null,
  generated_at timestamptz not null default now()
);

create index if not exists weekly_reports_week_start_idx on public.weekly_reports(week_start desc);

alter table public.weekly_reports enable row level security;

-- المديرون فقط يقرأون التقارير (الكتابة تتم بمفتاح الخدمة من الدالة المجدولة)
drop policy if exists "weekly_reports_select_manager" on public.weekly_reports;
create policy "weekly_reports_select_manager"
  on public.weekly_reports for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'manager'
    )
  );

-- ─────────────── 3) الجدولة الأسبوعية ───────────────
-- كل أحد 06:00 UTC = 09:00 بتوقيت دمشق.
-- استبدل <PROJECT_REF> و<CRON_SECRET> بقيمك، وبعد نشر الدالة:
--   supabase functions deploy weekly-alerts-report --no-verify-jwt
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('weekly-alerts-report') where exists (
  select 1 from cron.job where jobname = 'weekly-alerts-report'
);

select cron.schedule(
  'weekly-alerts-report',
  '0 6 * * 0',
  $$
  select net.http_post(
    url := 'https://edbzutvunzkfujsatuwb.supabase.co/functions/v1/weekly-alerts-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'Kinan_Almahainy@123#Metjar_track_web'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- لمتابعة آخر عمليات التشغيل:
--   select * from cron.job_run_details order by start_time desc limit 10;
