/**
 * تقرير التنبيهات الأسبوعي — Supabase Edge Function (Deno)
 *
 * ما تفعله:
 *  1. تحسب نافذة الأسبوع المنقضي (الأحد 00:00 → الأحد 00:00 بتوقيت دمشق).
 *  2. تقرأ أحداث activity_events وتصنّفها بنفس قواعد تطبيق الويب
 *     (حذف = حرج، تغيّر سعر منتج = حرج، تعديل = تحذير، إضافة = معلوماتي).
 *  3. تبني تقرير HTML جاهزاً للطباعة وتحفظه في جدول weekly_reports.
 *  4. ترسل إشعار PWA حقيقي (Web Push) لكل اشتراكات المديرين.
 *
 * تُشغَّل مجدولةً عبر pg_cron + pg_net (انظر مجلد migrations)،
 * ويمكن تشغيلها يدوياً لاختبار أسبوع محدد: ?week=2026-09-13
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

// ─────────────── إعدادات عامة ───────────────

/** دمشق +03:00 بلا توقيت صيفي، فنحسب الأسبوع بإزاحة ثابتة. */
const DAMASCUS_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** نافذة البحث عن لقطة السعر السابقة لمنتج. */
const PRICE_HISTORY_DAYS = 180;

type Severity = 'critical' | 'warning' | 'info';
type Action = 'created' | 'updated' | 'deleted';
type EntityType = 'store' | 'branch' | 'product';

interface EventRow {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  event_action: Action;
  entity_type: EntityType;
  entity_id: string | null;
  entity_name: string | null;
  event_at: string;
  details: Record<string, unknown> | null;
}

interface PreparedEvent {
  row: EventRow;
  severity: Severity;
  action: Action;
  entityType: EntityType;
  entityName: string;
  actorName: string;
  detail: string;
}

interface WeekWindow {
  start: Date;
  end: Date;
}

// ─────────────── أدوات التاريخ والأرشفة ───────────────

/** بداية يوم الأحد الذي يحتوي التاريخ المحدد، بتوقيت دمشق. */
function startOfWeekSunday(date: Date): Date {
  const shifted = new Date(date.getTime() + DAMASCUS_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  shifted.setUTCDate(shifted.getUTCDate() - shifted.getUTCDay());
  return new Date(shifted.getTime() - DAMASCUS_OFFSET_MS);
}

/**
 * الأسبوع المنقضي: عند التشغيل صباح الأحد نحسب الأسبوع الذي انتهى للتو،
 * وإن كانت الدالة تعمل في يوم آخر نحسب الأسبوع الماضي الكامل أيضاً (سلوك آمن).
 */
function resolveWindow(now: Date, override?: string | null): WeekWindow {
  if (override) {
    const parsed = new Date(`${override}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) {
      const start = startOfWeekSunday(new Date(parsed.getTime() - DAMASCUS_OFFSET_MS));
      return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
    }
  }
  const currentWeekStart = startOfWeekSunday(now);
  return {
    start: new Date(currentWeekStart.getTime() - 7 * DAY_MS),
    end: currentWeekStart,
  };
}

function shortDate(date: Date): string {
  const local = new Date(date.getTime() + DAMASCUS_OFFSET_MS);
  return `${String(local.getUTCDate()).padStart(2, '0')}/${String(local.getUTCMonth() + 1).padStart(2, '0')}`;
}

function dateTimeLabel(date: Date): string {
  const local = new Date(date.getTime() + DAMASCUS_OFFSET_MS);
  const hours = String(local.getUTCHours()).padStart(2, '0');
  const minutes = String(local.getUTCMinutes()).padStart(2, '0');
  return `${local.getUTCFullYear()}/${local.getUTCMonth() + 1}/${local.getUTCDate()} ${hours}:${minutes}`;
}

function eventDayLabel(iso: string): string {
  const local = new Date(new Date(iso).getTime() + DAMASCUS_OFFSET_MS);
  return `${local.getUTCMonth() + 1}/${local.getUTCDate()}`;
}

// ─────────────── التصنيف والتفصيل ───────────────

const severityLabels: Record<Severity, string> = {
  critical: 'حرج',
  warning: 'تحذير',
  info: 'معلوماتي',
};

const actionLabels: Record<Action, string> = {
  created: 'إضافة',
  updated: 'تعديل',
  deleted: 'حذف',
};

const detailLabels: Record<string, string> = {
  name: 'الاسم',
  price: 'السعر',
  currency: 'العملة',
  category: 'التصنيف',
  description: 'الوصف',
  address: 'العنوان',
  phone: 'الهاتف',
  commercial_register: 'السجل التجاري',
  branch_code: 'رمز الفرع',
  open_at: 'يفتح',
  close_at: 'يغلق',
  notes: 'ملاحظات',
  is_best_seller: 'الأكثر مبيعاً',
  is_active: 'مفعّل',
};

const hiddenKeys = new Set([
  'id',
  'store_id',
  'branch_id',
  'created_by',
  'deleted_at',
  'deleted_by',
  'created_at',
  'updated_at',
  'parent_store_id',
  'custom_fields',
  'cover_image_urls',
  'images_url',
  'signage_image_url',
  'shamcash_qr_image_url',
  'paymera_qr_image_url',
  'user_latitude',
  'user_longitude',
  'actual_distance',
]);

const briefKeys: Record<EntityType, string[]> = {
  store: ['address', 'phone', 'commercial_register', 'category'],
  branch: ['branch_code', 'address', 'phone', 'category'],
  product: ['price', 'category', 'description'],
};

const currencyLabels: Record<string, string> = { SYP: 'ل.س', USD: 'دولار', TRY: 'ل.ت' };

function readDetails(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

function priceOf(details: unknown): { price: number; currency?: string } | null {
  const row = readDetails(details);
  const price = Number(row['price']);
  if (!Number.isFinite(price)) return null;
  return { price, currency: typeof row['currency'] === 'string' ? (row['currency'] as string) : undefined };
}

function priceText(snapshot: { price: number; currency?: string }): string {
  const label = currencyLabels[snapshot.currency ?? 'SYP'] ?? snapshot.currency ?? 'SYP';
  return `${snapshot.price} ${label}`;
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (Array.isArray(value)) return `${value.length} عنصر`;
  if (typeof value === 'object') return '';
  return String(value).trim();
}

/** سطر مختصر يوضح ما تغيّر فعلاً (نفس منطق تطبيق الويب). */
function briefDetail(details: unknown, entityType: EntityType): string {
  const row = readDetails(details);
  const price = priceOf(details);
  for (const key of briefKeys[entityType]) {
    const value = key === 'price' ? (price ? priceText(price) : '') : formatValue(key, row[key]);
    if (value) return `${detailLabels[key] ?? key}: ${value}`;
  }
  const fallback = Object.keys(row).find((key) => !hiddenKeys.has(key) && formatValue(key, row[key]));
  return fallback ? `${detailLabels[fallback] ?? fallback}: ${formatValue(fallback, row[fallback])}` : '';
}

function entityNameOf(row: EventRow): string {
  const direct = (row.entity_name ?? '').trim();
  if (direct) return direct;
  return String(readDetails(row.details)['name'] ?? '').trim();
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** يحوّل الصفوف الخام إلى أحداث مصنّفة مع السعر السابق لكل منتج. */
function prepareEvents(rows: EventRow[], actors: Map<string, string>): PreparedEvent[] {
  // سلسلة لقطات كل منتج بالترتيب الزمني — تُبنى من كل الأحداث (حتى الإضافات)
  // لأن سعر الإضافة هو «السعر السابق» لأول تعديل لاحق.
  const priceChains = new Map<string, { at: number; price: number; currency?: string }[]>();

  return rows.map((row) => {
    const current = priceOf(row.details);
    const at = Date.parse(row.event_at);
    let previous: { at: number; price: number; currency?: string } | undefined;

    if (row.entity_type === 'product' && row.entity_id && current) {
      const chain = priceChains.get(row.entity_id) ?? [];
      previous = [...chain].reverse().find((item) => item.at < at);
      chain.push({ at, price: current.price, currency: current.currency });
      priceChains.set(row.entity_id, chain);
    }

    const priceChanged =
      row.event_action === 'updated' && !!current && !!previous && previous.price !== current.price;

    const severity: Severity =
      row.event_action === 'deleted' || priceChanged
        ? 'critical'
        : row.event_action === 'updated'
          ? 'warning'
          : 'info';

    const detail =
      priceChanged && previous && current
        ? `تغيّر السعر من ${priceText(previous)} إلى ${priceText(current)}`
        : briefDetail(row.details, row.entity_type);

    return {
      row,
      severity,
      action: row.event_action,
      entityType: row.entity_type,
      entityName: entityNameOf(row),
      actorName: row.actor_id ? (actors.get(row.actor_id) ?? 'مستخدم غير معروف') : 'مستخدم غير معروف',
      detail,
    };
  });
}

function phrase(event: PreparedEvent): string {
  const name = event.entityName ? ` «${event.entityName}»` : '';
  const target =
    event.entityType === 'store' ? 'للمتجر' : event.entityType === 'branch' ? 'للفرع' : 'للمنتج';
  return `${actionLabels[event.action]} ${target}${name}`;
}

// ─────────────── بناء التقرير ───────────────

const severityColors: Record<Severity, string> = {
  critical: '#c0392b',
  warning: '#b7791f',
  info: '#555',
};

function buildReportHtml(events: PreparedEvent[], window: WeekWindow, generatedAt: Date): string {
  const counts = {
    total: events.length,
    critical: events.filter((event) => event.severity === 'critical').length,
    warning: events.filter((event) => event.severity === 'warning').length,
    info: events.filter((event) => event.severity === 'info').length,
  };
  const entityCount = new Set(events.map((event) => `${event.entityType}:${event.row.entity_id}`)).size;

  const rows = events
    .map(
      (event) => `
        <tr>
          <td class="nowrap">${escapeHtml(eventDayLabel(event.row.event_at))}</td>
          <td class="sev" style="color:${severityColors[event.severity]}">${escapeHtml(severityLabels[event.severity])}</td>
          <td>${escapeHtml(phrase(event))}</td>
          <td>${escapeHtml(event.detail)}</td>
          <td class="nowrap">${escapeHtml(event.actorName)}</td>
        </tr>`,
    )
    .join('');

  const label = `${shortDate(window.start)} – ${shortDate(new Date(window.end.getTime() - DAY_MS))}`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>تقرير التنبيهات الأسبوعي ${escapeHtml(label)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #1c1c1c; margin: 0; font-size: 12px; }
  header { border-bottom: 2px solid #984399; padding-bottom: 8px; margin-bottom: 14px; }
  header h1 { margin: 0; font-size: 18px; color: #984399; }
  header p { margin: 4px 0 0; color: #666; font-size: 11px; }
  .summary { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; font-size: 11.5px; }
  .summary span { background: #f4eef6; border: 1px solid #e2d3e7; border-radius: 6px; padding: 4px 9px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: right; vertical-align: top; }
  th { background: #f7f4f8; font-size: 10.5px; }
  .nowrap { white-space: nowrap; }
  .sev { font-weight: 700; white-space: nowrap; }
  footer { margin-top: 16px; border-top: 1px solid #ddd; padding-top: 6px; color: #888; font-size: 10px; }
</style>
</head>
<body>
  <header>
    <h1>تقرير التنبيهات الأسبوعي</h1>
    <p>متجر تراك • الأسبوع ${escapeHtml(label)} • أُنشئ في ${escapeHtml(dateTimeLabel(generatedAt))}</p>
  </header>
  <div class="summary">
    <span>إجمالي الأحداث: ${counts.total}</span>
    <span>حرج: ${counts.critical}</span>
    <span>تحذير: ${counts.warning}</span>
    <span>معلوماتي: ${counts.info}</span>
    <span>كيانات متأثرة: ${entityCount}</span>
  </div>
  ${
    events.length === 0
      ? '<p>لا أحداث مسجّلة في هذا الأسبوع.</p>'
      : `<table>
    <thead><tr><th>اليوم</th><th>التصنيف</th><th>الحدث</th><th>التفصيل</th><th>المستخدم</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
  }
  <footer>هذا التقرير مُشتق من سجل النشاطات (activity_events) ولا يُعدّل فيه.</footer>
</body>
</html>`;
}

// ─────────────── الاشتراك في الضغط (Web Push) ───────────────

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendPushNotifications(
  supabase: ReturnType<typeof createClient>,
  payload: { title: string; body: string; url: string; tag: string },
): Promise<{ sent: number; removed: number }> {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!publicKey || !privateKey) {
    // بلا مفاتيح VAPID نكتفي بالتقرير المحفوظ داخل التطبيق
    return { sent: 0, removed: 0 };
  }

  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com', publicKey, privateKey);

  const { data: managers, error: managersError } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'manager')
    .eq('is_active', true);
  if (managersError) throw managersError;

  const managerIds = ((managers ?? []) as { id: string }[]).map((row) => row.id);
  if (managerIds.length === 0) return { sent: 0, removed: 0 };

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', managerIds);
  if (subscriptionsError) throw subscriptionsError;

  let sent = 0;
  const expired: string[] = [];
  const message = JSON.stringify(payload);

  await Promise.allSettled(
    ((subscriptions ?? []) as PushSubscriptionRow[]).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          message,
          { TTL: 60 * 60 * 24 },
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410 = اشتراك لم يعد موجوداً عند المتصفح
        if (status === 404 || status === 410) expired.push(subscription.endpoint);
      }
    }),
  );

  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expired);
  }

  return { sent, removed: expired.length };
}

// ─────────────── نقطة الدخول ───────────────

function isAuthorized(req: Request): boolean {
  const secret = Deno.env.get('CRON_SECRET');
  const header = req.headers.get('x-cron-secret');
  if (secret) return header === secret;

  // بلا CRON_SECRET نسمح فقط لمفتاح الخدمة (تشغيل يدوي/اختباري)
  const authorization = req.headers.get('Authorization') ?? '';
  return authorization === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const now = new Date();
    const override = new URL(req.url).searchParams.get('week');
    const window = resolveWindow(now, override);

    // أحداث الأسبوع + أسماء الفاعلين + لقطات أسعار المنتجات قبل الأسبوع للمقارنة
    const { data: events, error: eventsError } = await supabase
      .from('activity_events')
      .select('id, actor_id, actor_role, event_action, entity_type, entity_id, entity_name, event_at, details')
      .gte('event_at', window.start.toISOString())
      .lt('event_at', window.end.toISOString())
      .order('event_at', { ascending: true });
    if (eventsError) throw eventsError;

    const { data: profiles } = await supabase.from('profiles').select('id, full_name');
    const actors = new Map<string, string>(
      ((profiles ?? []) as { id: string; full_name: string | null }[]).map((row) => [
        row.id,
        row.full_name ?? '',
      ]),
    );

    const rows = (events ?? []) as EventRow[];
    const productIds = [
      ...new Set(rows.filter((row) => row.entity_type === 'product' && row.entity_id).map((row) => row.entity_id as string)),
    ];

    let prepared = prepareEvents(rows, actors);
    if (productIds.length > 0) {
      const historySince = new Date(window.start.getTime() - PRICE_HISTORY_DAYS * DAY_MS);
      const { data: history } = await supabase
        .from('activity_events')
        .select('id, actor_id, actor_role, event_action, entity_type, entity_id, entity_name, event_at, details')
        .eq('entity_type', 'product')
        .in('entity_id', productIds)
        .gte('event_at', historySince.toISOString())
        .lt('event_at', window.start.toISOString())
        .order('event_at', { ascending: true });

      // اللقطات السابقة تُقرأ أولاً حتى تكون مقارنة السعر دقيقة عند بداية الأسبوع
      prepared = prepareEvents([...((history ?? []) as EventRow[]), ...rows], actors).filter((event) =>
        Date.parse(event.row.event_at) >= window.start.getTime(),
      );
    }

    const counts = {
      total: prepared.length,
      critical: prepared.filter((event) => event.severity === 'critical').length,
      warning: prepared.filter((event) => event.severity === 'warning').length,
      info: prepared.filter((event) => event.severity === 'info').length,
    };

    const html = buildReportHtml(prepared, window, now);
    const label = `${shortDate(window.start)} – ${shortDate(new Date(window.end.getTime() - DAY_MS))}`;

    const { error: saveError } = await supabase.from('weekly_reports').upsert(
      {
        week_start: window.start.toISOString(),
        week_end: window.end.toISOString(),
        total: counts.total,
        critical: counts.critical,
        warning: counts.warning,
        info: counts.info,
        label,
        html,
        generated_at: now.toISOString(),
      },
      { onConflict: 'week_start' },
    );
    if (saveError) throw saveError;

    const push = await sendPushNotifications(supabase, {
      title: 'تقرير التنبيهات الأسبوعي',
      body: `${label}: ${counts.total} حدثاً • ${counts.critical} حرج • ${counts.warning} تحذير`,
      url: '/alerts/archive',
      tag: `weekly-report-${window.start.toISOString().slice(0, 10)}`,
    }).catch(() => ({ sent: 0, removed: 0 }));

    return new Response(
      JSON.stringify({
        weekStart: window.start.toISOString(),
        weekEnd: window.end.toISOString(),
        ...counts,
        pushSent: push.sent,
        pushRemoved: push.removed,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
