import { supabase } from '@/lib/supabase';
import { currencyLabels, translateError } from '@/lib/constants';
import type { ActivityAction, ActivityEntityType, CurrencyCode } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import {
  actionLabel,
  entityLabel,
  eventBriefDetail,
  eventName,
  eventPhrase,
  readEventDetails,
} from './data/activities';
import { fetchAllAccounts } from './data/accounts';

// ─────────────── أنواع التنبيهات ───────────────

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AdminAlert {
  id: string;
  severity: AlertSeverity;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: string;
  entityName: string;
  /** الكيان محذوف — لا يمكن فتح صفحته */
  deleted: boolean;
  /** معرّف المتجر الأب من اللقطة (لفتح تفاصيل فرع) */
  storeId?: string;
  actorId?: string;
  actorName: string;
  actorRole?: string;
  eventAt: string;
  /** القاعدة التي وقع تحتها الحدث — أساس تخصيص التنبيهات وكتمها */
  rule: AlertRuleKey;
  /** جملة الحدث، مثل «حذف للمتجر «متجر الساعة»» */
  title: string;
  /** ما تغيّر فعلياً، أو مقارنة السعر القديم/الجديد */
  detail: string;
  /** عدد الأحداث المدمجة في هذا التنبيه (للتعديلات المتقاربة على نفس الكيان) */
  count?: number;
  /** بقية التغييرات داخل التنبيه المدمج (بحد أقصى 3) */
  extraDetails?: string[];
  /** كل من عدّل الكيان داخل التنبيه المدمج */
  actorNames?: string[];
}

export const roleLabels: Record<string, string> = {
  manager: 'مدير',
  merchant: 'تاجر',
  employee: 'موظف',
};

// ─────────────── قواعد التنبيه وتخصيصها ───────────────

/** كل حدث حساس يقع تحت قاعدة واحدة، والقاعدة هي ما يتحكم به المدير. */
export type AlertRuleKey =
  | 'store_deleted'
  | 'branch_deleted'
  | 'product_deleted'
  | 'product_price_changed'
  | 'entity_updated'
  | 'entity_created';

export const alertRuleLabels: Record<AlertRuleKey, string> = {
  store_deleted: 'حذف متجر',
  branch_deleted: 'حذف فرع',
  product_deleted: 'حذف منتج',
  product_price_changed: 'تغيّر سعر منتج',
  entity_updated: 'تعديل بيانات متجر أو فرع أو منتج',
  entity_created: 'إضافة كيان جديد',
};

export const alertRuleDescriptions: Record<AlertRuleKey, string> = {
  store_deleted: 'حذف متجر (حذف ناعم قابل للاستعادة من قاعدة البيانات)',
  branch_deleted: 'حذف فرع من متجر',
  product_deleted: 'حذف منتج — الحذف نهائي في قاعدة البيانات',
  product_price_changed: 'تغيّر سعر منتج مقارنةً بلقطته السابقة',
  entity_updated: 'أي تعديل آخر على بيانات كيان',
  entity_created: 'إضافة متجر أو فرع أو منتج جديد',
};

export function alertRuleKey(
  action: ActivityAction,
  entityType: ActivityEntityType,
  priceChanged: boolean,
): AlertRuleKey {
  if (action === 'created') return 'entity_created';
  if (action === 'deleted') {
    if (entityType === 'store') return 'store_deleted';
    if (entityType === 'branch') return 'branch_deleted';
    return 'product_deleted';
  }
  if (entityType === 'product' && priceChanged) return 'product_price_changed';
  return 'entity_updated';
}

export interface AlertRuleSettings {
  /** إظهار الحدث في قائمة التنبيهات أصلاً */
  enabled: boolean;
  /** إحصاؤه على جرس التنبيهات (الأحداث الإخبارية لا تُحصى) */
  badge: boolean;
}

export interface MutedEntity {
  id: string;
  label: string;
  entityType: ActivityEntityType;
  /** null = كتم دائم */
  until: string | null;
}

export interface MutedActor {
  id: string;
  name: string;
  until: string | null;
}

export interface AlertSettings {
  version: 1;
  rules: Record<AlertRuleKey, AlertRuleSettings>;
  mutedEntities: MutedEntity[];
  mutedActors: MutedActor[];
}

/** الافتراضي: كل القواعد مفعّلة، والإضافة الإخبارية لا تُحصى على الجرس. */
export function defaultAlertSettings(): AlertSettings {
  return {
    version: 1,
    rules: {
      store_deleted: { enabled: true, badge: true },
      branch_deleted: { enabled: true, badge: true },
      product_deleted: { enabled: true, badge: true },
      product_price_changed: { enabled: true, badge: true },
      entity_updated: { enabled: true, badge: true },
      entity_created: { enabled: true, badge: false },
    },
    mutedEntities: [],
    mutedActors: [],
  };
}

/** يملأ أي إعداد مخزّن ناقص (من نسخة سابقة) بالقيم الافتراضية. */
export function normalizeAlertSettings(raw: Partial<AlertSettings> | null | undefined): AlertSettings {
  const defaults = defaultAlertSettings();
  if (!raw || typeof raw !== 'object') return defaults;
  const rules = { ...defaults.rules };
  for (const key of Object.keys(defaults.rules) as AlertRuleKey[]) {
    const value = raw.rules?.[key];
    if (value && typeof value === 'object') {
      rules[key] = { enabled: value.enabled !== false, badge: value.badge !== false };
    }
  }
  return {
    version: 1,
    rules,
    mutedEntities: Array.isArray(raw.mutedEntities) ? raw.mutedEntities.slice(0, 200) : [],
    mutedActors: Array.isArray(raw.mutedActors) ? raw.mutedActors.slice(0, 200) : [],
  };
}

export function isMuteActive(until: string | null, now: Date = new Date()): boolean {
  return !until || Date.parse(until) > now.getTime();
}

export interface AlertFeedResult {
  /** التنبيهات المرئية بعد القواعد والكتم */
  alerts: AdminAlert[];
  /** ما يظهر على الجرس (القواعد المعدودة وغير المقروءة) */
  unread: number;
  /** عدد ما أخفته القواعد المعطّلة */
  hiddenByRules: number;
  /** عدد ما أخفاه الكتم المؤقت أو الدائم */
  muted: number;
}

/**
 * يطبّق إعدادات المدير على قائمة التنبيهات.
 * الكتم عرضٌ فقط — لا يحذف أي حدث من قاعدة البيانات، فيبقى السجل كاملاً للمراجعة.
 */
export function applyAlertSettings(
  alerts: AdminAlert[],
  settings: AlertSettings,
  seenAt: string | null,
  now: Date = new Date(),
): AlertFeedResult {
  const seen = seenAt ? Date.parse(seenAt) : 0;
  const mutedEntityIds = new Set(
    settings.mutedEntities.filter((m) => isMuteActive(m.until, now)).map((m) => m.id),
  );
  const mutedActorIds = new Set(
    settings.mutedActors.filter((m) => isMuteActive(m.until, now)).map((m) => m.id),
  );

  const result: AlertFeedResult = { alerts: [], unread: 0, hiddenByRules: 0, muted: 0 };
  for (const alert of alerts) {
    const rule = settings.rules[alert.rule] ?? { enabled: true, badge: true };
    if (!rule.enabled) {
      result.hiddenByRules += 1;
      continue;
    }
    const isMuted =
      (!!alert.entityId && mutedEntityIds.has(alert.entityId)) ||
      (!!alert.actorId && mutedActorIds.has(alert.actorId));
    if (isMuted) {
      result.muted += 1;
      continue;
    }
    result.alerts.push(alert);
    if (rule.badge && Date.parse(alert.eventAt) > seen) result.unread += 1;
  }
  return result;
}

/** مدة كتم جاهزة: ساعة/يوم/أسبوع أو دائم (null). */
export const muteDurations: { key: string; label: string; hours: number | null }[] = [
  { key: 'hour', label: 'ساعة', hours: 1 },
  { key: 'day', label: 'يوم', hours: 24 },
  { key: 'week', label: 'أسبوع', hours: 24 * 7 },
  { key: 'forever', label: 'دائماً', hours: null },
];

export function muteUntil(hours: number | null, now: Date = new Date()): string | null {
  return hours === null ? null : new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export const severityLabels: Record<AlertSeverity, string> = {
  critical: 'حرج',
  warning: 'تحذير',
  info: 'معلوماتي',
};

export const severityTones: Record<AlertSeverity, 'error' | 'warning' | 'neutral'> = {
  critical: 'error',
  warning: 'warning',
  info: 'neutral',
};

/** الخطير والمهم هو ما يستحق عدّاد الجرس (الحذف وتغيّر السعر والتعديلات). */
export function isUnreadWorthy(severity: AlertSeverity): boolean {
  return severity !== 'info';
}

// ─────────────── قواعد التصنيف (دوال خالصة قابلة للفحص) ───────────────

/**
 * درجة خطورة الحدث: الحذف وتغيّر السعر حرج، أي تعديل تحذير، والإضافة معلوماتية.
 */
export function alertSeverity(action: ActivityAction, priceChanged: boolean): AlertSeverity {
  if (action === 'deleted') return 'critical';
  if (priceChanged) return 'critical';
  if (action === 'updated') return 'warning';
  return 'info';
}

export interface PriceSnapshot {
  eventAt: string;
  price: number;
  currency?: string;
}

function priceOf(details: any): { price: number; currency?: string } | null {
  const row = readEventDetails(details);
  const price = Number(row['price']);
  if (!Number.isFinite(price)) return null;
  return { price, currency: typeof row['currency'] === 'string' ? row['currency'] : undefined };
}

function priceText(snapshot: { price: number; currency?: string }): string {
  const code = (snapshot.currency ?? 'SYP') as CurrencyCode;
  return formatPrice(snapshot.price, currencyLabels[code] ?? code);
}

interface EventLike {
  id: string;
  entity_id?: string | null;
  event_at: string;
}

/**
 * يحدّد لكل حدث «السعر السابق» لنفس المنتج من اللقطة السابقة مباشرة.
 * اللقطة الكاملة في details لا تقول أي حقل تغيّر، لذا المقارنة بين لقطتين متتاليتين
 * هي الطريقة الدقيقة المتاحة بلا أي تغيير على قاعدة البيانات.
 */
export function previousPricesByEvent(
  current: EventLike[],
  history: { entity_id?: string | null; event_at: string; details?: any }[],
): Record<string, PriceSnapshot | undefined> {
  const byEntity = new Map<string, PriceSnapshot[]>();
  for (const row of history) {
    if (!row.entity_id) continue;
    const snapshot = priceOf(row.details);
    if (!snapshot) continue;
    const list = byEntity.get(row.entity_id) ?? [];
    list.push({ eventAt: row.event_at, price: snapshot.price, currency: snapshot.currency });
    byEntity.set(row.entity_id, list);
  }
  for (const list of byEntity.values()) list.sort((a, b) => a.eventAt.localeCompare(b.eventAt));

  const result: Record<string, PriceSnapshot | undefined> = {};
  for (const row of current) {
    if (!row.entity_id) continue;
    const list = byEntity.get(row.entity_id);
    if (!list) continue;
    let previous: PriceSnapshot | undefined;
    for (const snapshot of list) {
      if (snapshot.eventAt < row.event_at) previous = snapshot;
      else break;
    }
    if (previous) result[row.id] = previous;
  }
  return result;
}

export interface AlertEventRow {
  id: string;
  actor_id?: string | null;
  actor_role?: string | null;
  event_action: ActivityAction;
  entity_type: ActivityEntityType;
  entity_id?: string | null;
  entity_name?: string | null;
  event_at: string;
  details?: any;
}

export interface AlertActor {
  fullName: string;
  role?: string;
}

/** يحوّل صفوف activity_events إلى تنبيهات مصنّفة بالخطورة مع اسم الفاعل. */
export function buildAlerts(
  rows: AlertEventRow[],
  opts: {
    actors?: Map<string, AlertActor>;
    previousPrices?: Record<string, PriceSnapshot | undefined>;
  } = {},
): AdminAlert[] {
  const actors = opts.actors ?? new Map<string, AlertActor>();
  const previousPrices = opts.previousPrices ?? {};

  return rows.map((row) => {
    const event = {
      action: row.event_action,
      entityType: row.entity_type,
      entityName: row.entity_name ?? undefined,
      details: row.details,
    };
    const details = readEventDetails(row.details);
    const previous = previousPrices[row.id];
    const currentPrice =
      row.event_action === 'updated' && row.entity_type === 'product' ? priceOf(row.details) : null;
    const priceChanged =
      !!previous && !!currentPrice && Number.isFinite(currentPrice.price)
        ? currentPrice.price !== previous.price
        : false;
    const actor = row.actor_id ? actors.get(row.actor_id) : undefined;

    return {
      id: row.id,
      severity: alertSeverity(row.event_action, priceChanged),
      rule: alertRuleKey(row.event_action, row.entity_type, priceChanged),
      action: row.event_action,
      entityType: row.entity_type,
      entityId: row.entity_id ?? undefined,
      entityName: eventName(event),
      deleted: row.event_action === 'deleted',
      storeId: typeof details['store_id'] === 'string' ? details['store_id'] : undefined,
      actorId: row.actor_id ?? undefined,
      actorName: actor?.fullName ?? 'مستخدم غير معروف',
      actorRole: row.actor_role ?? actor?.role,
      eventAt: row.event_at,
      title: eventPhrase(event),
      detail:
        priceChanged && previous && currentPrice
          ? `تغيّر السعر من ${priceText(previous)} إلى ${priceText(currentPrice)}`
          : eventBriefDetail(row.details, row.entity_type),
    };
  });
}

// ─────────────── جلب التنبيهات ───────────────

export interface FetchAlertsOptions {
  /** عدد الأيام التي تُقرأ للخلف */
  days?: number;
  limit?: number;
}

/** أوسع نافذة بحث عن اللقطة السابقة لمنتج، لتبقى مقارنة السعر دقيقة. */
const PRICE_HISTORY_DAYS = 180;

export async function fetchAdminAlerts(opts: FetchAlertsOptions = {}): Promise<AdminAlert[]> {
  const days = opts.days ?? 30;
  const limit = opts.limit ?? 80;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('activity_events')
    .select('id, actor_id, actor_role, event_action, entity_type, entity_id, entity_name, event_at, details')
    .gte('event_at', since.toISOString())
    .order('event_at', { ascending: false })
    .limit(limit);
  if (error) throw translateError(error);

  const rows = (data ?? []) as AlertEventRow[];

  // أسماء الفاعلين: جدول profiles صغير، فنجلبه مرة واحدة بدل ربط معقّد.
  let actors = new Map<string, AlertActor>();
  try {
    const accounts = await fetchAllAccounts();
    actors = new Map(accounts.map((a) => [a.id, { fullName: a.fullName, role: a.role }]));
  } catch {
    // التنبيهات تعمل حتى لو تعذّر جلب الأسماء
  }

  const productIds = [
    ...new Set(
      rows
        .filter((r) => r.entity_type === 'product' && r.event_action === 'updated' && r.entity_id)
        .map((r) => r.entity_id as string),
    ),
  ];

  let previousPrices: Record<string, PriceSnapshot | undefined> = {};
  if (productIds.length > 0) {
    const historySince = new Date(since.getTime() - PRICE_HISTORY_DAYS * 24 * 60 * 60 * 1000);
    const { data: history, error: historyError } = await supabase
      .from('activity_events')
      .select('entity_id, event_at, details')
      .eq('entity_type', 'product')
      .in('entity_id', productIds)
      .gte('event_at', historySince.toISOString())
      .order('event_at', { ascending: true })
      .limit(1000);
    if (!historyError) {
      previousPrices = previousPricesByEvent(rows, (history ?? []) as any[]);
    }
  }

  return buildAlerts(rows, { actors, previousPrices });
}

// ─────────────── تصدير وطباعة التقرير ───────────────

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  // حماية من تنفيذ صيغ عند فتح الملف في Excel
  if (/^[=+\-@\t]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function timeLabel(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** صف تفصيلي واحد لكل حدث (لا يُدمج المتقارب هنا — التصدير سجل تدقيقي كامل). */
export function alertsToCsv(alerts: AdminAlert[]): string {
  const header = [
    'الأسبوع',
    'التاريخ',
    'الوقت',
    'التصنيف',
    'الإجراء',
    'النوع',
    'الاسم',
    'المستخدم',
    'الدور',
    'التفصيل',
  ];

  const rows = alerts.map((alert) => {
    const date = new Date(alert.eventAt);
    const detail = [alert.detail, ...(alert.extraDetails ?? [])].filter(Boolean).join(' • ');
    return [
      weekLabelFor(date),
      `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`,
      timeLabel(date),
      severityLabels[alert.severity],
      actionLabel(alert.action),
      entityLabel(alert.entityType),
      alert.entityName,
      alert.actorNames?.length ? alert.actorNames.join('، ') : alert.actorName,
      alert.actorRole ? (roleLabels[alert.actorRole] ?? alert.actorRole) : '',
      detail,
    ]
      .map(csvCell)
      .join(',');
  });

  return [header.map(csvCell).join(','), ...rows].join('\r\n');
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** اسم ملف آمن بالتاريخ (بون Latin لتفادي مشاكل الترميز في التنزيل). */
export function archiveFileName(extension: string, now: Date = new Date()): string {
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `metjar-track-alerts-${stamp}.${extension}`;
}

const severityColors: Record<AlertSeverity, string> = {
  critical: '#c0392b',
  warning: '#b7791f',
  info: '#555',
};

/**
 * يبني مستند تقرير أسبوعي جاهزاً للطباعة أو للحفظ PDF.
 * مبنيّ كـ HTML مستقل بأنماط داخلية حتى تخرج الطبعة نظيفة بلا واجهة التطبيق.
 */
export function buildArchiveReportHtml(
  weeks: WeeklyArchive[],
  opts: { generatedAt?: Date; title?: string } = {},
): string {
  const generatedAt = opts.generatedAt ?? new Date();
  const title = opts.title ?? 'تقرير التنبيهات الأسبوعي';
  const visible = weeks.filter((week) => week.total > 0);

  const totals = weeks.reduce(
    (acc, week) => ({
      total: acc.total + week.total,
      critical: acc.critical + week.critical,
      warning: acc.warning + week.warning,
      info: acc.info + week.info,
    }),
    { total: 0, critical: 0, warning: 0, info: 0 },
  );

  const weekSections = visible
    .map((week) => {
      const rows = week.alerts
        .map((alert) => {
          const date = new Date(alert.eventAt);
          const detail = [alert.detail, ...(alert.extraDetails ?? [])].filter(Boolean).join(' • ');
          return `
            <tr>
              <td class="nowrap">${escapeHtml(`${date.getMonth() + 1}/${date.getDate()}`)} ${escapeHtml(timeLabel(date))}</td>
              <td class="sev" style="color:${severityColors[alert.severity]}">${escapeHtml(severityLabels[alert.severity])}</td>
              <td>${escapeHtml(alert.title)}</td>
              <td>${escapeHtml(detail)}</td>
              <td class="nowrap">${escapeHtml(alert.actorNames?.length ? alert.actorNames.join('، ') : alert.actorName)}</td>
            </tr>`;
        })
        .join('');

      return `
        <section>
          <h2>الأسبوع ${escapeHtml(week.label)}</h2>
          <p class="stats">
            ${week.total} حدثاً • حرج ${week.critical} • تحذير ${week.warning} • معلوماتي ${week.info}
            ${week.entityCount ? ` • ${week.entityCount} كياناً متأثراً` : ''}
            ${week.topActors.length ? ` • الأكثر نشاطاً: ${escapeHtml(week.topActors.map((a) => `${a.name} (${a.count})`).join(', '))}` : ''}
          </p>
          <table>
            <thead>
              <tr><th>الوقت</th><th>التصنيف</th><th>الحدث</th><th>التفصيل</th><th>المستخدم</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #1c1c1c; margin: 0; font-size: 12px; }
  header { border-bottom: 2px solid #984399; padding-bottom: 8px; margin-bottom: 14px; }
  header h1 { margin: 0; font-size: 18px; color: #984399; }
  header p { margin: 4px 0 0; color: #666; font-size: 11px; }
  .summary { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; font-size: 11.5px; }
  .summary span { background: #f4eef6; border: 1px solid #e2d3e7; border-radius: 6px; padding: 4px 9px; }
  section { margin-bottom: 18px; page-break-inside: avoid; }
  h2 { font-size: 13.5px; margin: 0 0 4px; color: #4a2a52; }
  .stats { margin: 0 0 6px; color: #666; font-size: 10.5px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: right; vertical-align: top; }
  th { background: #f7f4f8; font-size: 10.5px; }
  td { font-size: 10.5px; }
  .nowrap { white-space: nowrap; }
  .sev { font-weight: 700; white-space: nowrap; }
  footer { margin-top: 16px; border-top: 1px solid #ddd; padding-top: 6px; color: #888; font-size: 10px; }
</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <p>متجر تراك • آخر ${weeks.length} أسابيع • أُنشئ في ${escapeHtml(`${generatedAt.getFullYear()}/${generatedAt.getMonth() + 1}/${generatedAt.getDate()} ${timeLabel(generatedAt)}`)}</p>
  </header>
  <div class="summary">
    <span>إجمالي الأحداث: ${totals.total}</span>
    <span>حرج: ${totals.critical}</span>
    <span>تحذير: ${totals.warning}</span>
    <span>معلوماتي: ${totals.info}</span>
  </div>
  ${weekSections || '<p>لا توجد أحداث في الفترة المحددة.</p>'}
  <footer>هذا التقرير مُشتق من سجل النشاطات (activity_events) ولا يُعدّل فيه.</footer>
</body>
</html>`;
}

let channelSequence = 0;

/**
 * يشترك في إضافة صفوف جديدة إلى activity_events.
 * اسم قناة فريد لكل اشتراك لتفادي خطأ supabase عند إعادة الاشتراك (StrictMode).
 * ملاحظة: يتطلب أن يكون الجدول مضافاً إلى منشور realtime في Supabase،
 * وإلا فلن يصل أي حدث (تُبقى الفترة الاحتياطية للتحقق الدوري في الواجهة).
 */
// ─────────────── دمج الأحداث المتقاربة ───────────────

/** المدة التي تُدمج خلالها تعديلات نفس الكيان في تنبيه واحد. */
export const ALERT_GROUP_WINDOW_MINUTES = 60;

const severityRank: Record<AlertSeverity, number> = { critical: 2, warning: 1, info: 0 };

function updatesCountLabel(count: number): string {
  if (count === 2) return 'تعديلان';
  if (count <= 10) return `${count} تعديلات`;
  return `${count} تعديلاً`;
}

/**
 * يدمج تعديلات نفس الكيان المتقاربة زمنياً في تنبيه واحد مع ملخص،
 * فيتحوّل عشرون تعديلاً على منتج واحد خلال ساعة إلى سطر واحد قابل للقراءة.
 * الحذف والإضافة لا يُدمان أبداً — كل حذف حدث مستقل يستحق تنبيهاً خاصاً.
 */
export function groupNearbyAlerts(
  alerts: AdminAlert[],
  opts: { windowMinutes?: number } = {},
): AdminAlert[] {
  const windowMs = (opts.windowMinutes ?? ALERT_GROUP_WINDOW_MINUTES) * 60 * 1000;
  const groups: AdminAlert[] = [];
  const positions = new Map<string, number>();
  // أقدم وقت في كل مجموعة: نمدّد المجموعة ما دامت كل خطوة قريبة من سابقتها،
  // فلا تُدمج تعديلات كثيرة متباعدة يجمعها كيان واحد (مثل تعديلات على مدار يوم كامل).
  const oldestInGroup: number[] = [];

  const startGroup = (alert: AdminAlert) => {
    positions.set(`${alert.entityType}:${alert.entityId}`, groups.length);
    oldestInGroup.push(Date.parse(alert.eventAt));
    groups.push(alert);
  };

  for (const alert of alerts) {
    if (alert.action !== 'updated' || !alert.entityId) {
      groups.push(alert);
      continue;
    }

    const position = positions.get(`${alert.entityType}:${alert.entityId}`);
    if (position === undefined || oldestInGroup[position] - Date.parse(alert.eventAt) > windowMs) {
      startGroup(alert);
      continue;
    }

    const group = groups[position];
    oldestInGroup[position] = Date.parse(alert.eventAt);

    const count = (group.count ?? 1) + 1;
    const actorNames = [...new Set([...(group.actorNames ?? [group.actorName]), alert.actorName])];
    // الأهم في المجموعة يحدّد تصنيفها وتفصيلها الأساسي (تغيّر السعر يتقدّم على تعديل الوصف)
    const promoted = severityRank[alert.severity] > severityRank[group.severity];
    const detail = promoted ? alert.detail : group.detail;
    const name = alert.entityName || group.entityName;
    const extraDetails = [group.detail, ...(group.extraDetails ?? []), alert.detail]
      .filter((text, index, list) => !!text && text !== detail && list.indexOf(text) === index)
      .slice(0, 3);

    groups[position] = {
      ...group,
      severity: promoted ? alert.severity : group.severity,
      detail,
      title: `${updatesCountLabel(count)} على ${entityLabel(alert.entityType)}${name ? ` «${name}»` : ''}`,
      count,
      extraDetails,
      actorNames,
    };
  }

  return groups;
}

// ─────────────── الأرشيف الأسبوعي ───────────────

export interface WeeklyArchive {
  key: string;
  label: string;
  start: string;
  end: string;
  total: number;
  critical: number;
  warning: number;
  info: number;
  entityCount: number;
  topActors: { name: string; count: number }[];
  alerts: AdminAlert[];
  /** تنبيهات الأسبوع بعد دمج المتقارب */
  groupedAlerts: AdminAlert[];
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** مفتاح تاريخ محلي بصيغة YYYY-MM-DD (بدل toISOString الذي ينجرف إلى اليوم السابق خارج UTC). */
function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** بداية الأسبوع (الأحد). */
export function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function shortDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** وسم أسبوع أي تاريخ بالشكل «20/09 – 26/09» (يُستخدم في الأرشيف وفي التصدير). */
export function weekLabelFor(date: Date): string {
  const start = startOfWeek(date);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  return `${shortDate(start)} – ${shortDate(end)}`;
}

/** يبني أرشيفاً لأحدث عدة أسابيع: إحصاءات وأبرز الفاعلين وأحداث كل أسبوع. */
export function buildWeeklyArchive(
  alerts: AdminAlert[],
  opts: { weeks?: number; now?: Date; groupWindowMinutes?: number } = {},
): WeeklyArchive[] {
  const weeks = opts.weeks ?? 8;
  const currentWeekStart = startOfWeek(opts.now ?? new Date());

  const buckets: WeeklyArchive[] = [];
  for (let i = 0; i < weeks; i++) {
    const start = new Date(currentWeekStart.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    buckets.push({
      key: localDateKey(start),
      label: weekLabelFor(start),
      start: start.toISOString(),
      end: end.toISOString(),
      total: 0,
      critical: 0,
      warning: 0,
      info: 0,
      entityCount: 0,
      topActors: [],
      alerts: [],
      groupedAlerts: [],
    });
  }

  const rangeStart = Date.parse(buckets[buckets.length - 1].start);
  for (const alert of alerts) {
    const at = Date.parse(alert.eventAt);
    if (!Number.isFinite(at) || at < rangeStart) continue;
    const bucket = buckets.find((b) => at >= Date.parse(b.start) && at < Date.parse(b.end));
    if (!bucket) continue;
    bucket.alerts.push(alert);
    bucket.total += 1;
    bucket[alert.severity] += 1;
  }

  for (const bucket of buckets) computeWeekStats(bucket, bucket.alerts);

  return buckets;
}

/** يحسب إحصاءات أسبوع من قائمة أحداثه (يُستخدم في البناء وبعد تطبيق الإعدادات). */
function computeWeekStats(week: WeeklyArchive, alerts: AdminAlert[]): void {
  week.alerts = alerts;
  week.total = alerts.length;
  week.critical = alerts.filter((a) => a.severity === 'critical').length;
  week.warning = alerts.filter((a) => a.severity === 'warning').length;
  week.info = alerts.filter((a) => a.severity === 'info').length;
  week.entityCount = new Set(alerts.map((a) => `${a.entityType}:${a.entityId ?? a.entityName}`)).size;

  const actorCounts = new Map<string, number>();
  for (const alert of alerts) {
    actorCounts.set(alert.actorName, (actorCounts.get(alert.actorName) ?? 0) + 1);
  }
  week.topActors = [...actorCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  week.groupedAlerts = groupNearbyAlerts(alerts);
}

/**
 * يطبّق قواعد المدير وكتمه على أرشيف كامل، فتبقى الإحصاءات مطابقة لما يراه فعلاً.
 * الكتم عرضٌ فقط — البيانات لا تُحذف من السجل.
 */
export function applySettingsToArchive(
  weeks: WeeklyArchive[],
  settings: AlertSettings,
  now: Date = new Date(),
): WeeklyArchive[] {
  return weeks.map((week) => {
    const visible = applyAlertSettings(week.alerts, settings, null, now).alerts;
    const next: WeeklyArchive = { ...week };
    computeWeekStats(next, visible);
    return next;
  });
}

// ─────────────── التقارير الأسبوعية المحفوظة ───────────────

/** تقرير أسبوعي أنشأته الدالة المجدولة وحفظته في weekly_reports. */
export interface WeeklyReport {
  id: string;
  weekStart: string;
  weekEnd: string;
  label: string;
  total: number;
  critical: number;
  warning: number;
  info: number;
  html: string;
  generatedAt: string;
}

/**
 * يقرأ التقارير المحفوظة (المديرون فقط بحسب سياسة RLS).
 * إن لم يُهيأ الجدول بعد تُعاد قائمة فارغة بدل إظهار خطأ.
 */
export async function fetchWeeklyReports(limit = 12): Promise<WeeklyReport[]> {
  const { data, error } = await supabase
    .from('weekly_reports')
    .select('id, week_start, week_end, label, total, critical, warning, info, html, generated_at')
    .order('week_start', { ascending: false })
    .limit(limit);
  if (error) return [];

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    label: row.label ?? '',
    total: Number(row.total ?? 0),
    critical: Number(row.critical ?? 0),
    warning: Number(row.warning ?? 0),
    info: Number(row.info ?? 0),
    html: String(row.html ?? ''),
    generatedAt: row.generated_at,
  }));
}

// ─────────────── التحديث اللحظي ───────────────

export function subscribeToAlerts(onInsert: () => void): () => void {
  channelSequence += 1;
  let disposed = false;
  const channel = supabase
    .channel(`alerts-${channelSequence}-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_events' },
      () => {
        if (!disposed) onInsert();
      },
    )
    .subscribe();

  return () => {
    disposed = true;
    supabase.removeChannel(channel);
  };
}
