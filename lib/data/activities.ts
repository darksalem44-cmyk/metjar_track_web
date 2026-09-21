import { supabase } from '@/lib/supabase';
import type {
  ActivityAction,
  ActivityEntityType,
  ActorSummary,
  ActivityEvent,
  CurrencyCode,
  DailyPoint,
  UserRole,
} from '@/lib/types';
import { currencyLabels, translateError } from '@/lib/constants';
import { formatPrice } from '@/lib/utils';

/** الدور المخزَّن فعلياً في activity_events.actor_role هو واحد من هذه القيم الثلاث فقط. */
export function normalizeRole(value: string | null | undefined): UserRole {
  return value === 'merchant' || value === 'manager' ? value : 'employee';
}

function zeroSummary(actorId: string): ActorSummary {
  return {
    actor_id: actorId,
    total: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    stores: 0,
    branches: 0,
    products: 0,
  };
}

function mapSummary(row: any): ActorSummary {
  // حقول دالة get_activity_actor_summary كما يقرؤها تطبيق الموبايل
  return {
    actor_id: row.actor_id,
    total: row.total_activities ?? row.total ?? 0,
    created: row.created_count ?? row.created ?? 0,
    updated: row.updated_count ?? row.updated ?? 0,
    deleted: row.deleted_count ?? row.deleted ?? 0,
    stores: row.store_activities ?? row.stores ?? 0,
    branches: row.branch_activities ?? row.branches ?? 0,
    products: row.product_activities ?? row.products ?? 0,
  };
}

function mapEvent(row: any): ActivityEvent {
  return {
    id: row.id,
    actorId: row.actor_id ?? undefined,
    actorRole: row.actor_role ?? undefined,
    action: (row.event_action ?? 'created') as ActivityAction,
    entityType: (row.entity_type ?? 'store') as ActivityEntityType,
    entityId: row.entity_id ?? undefined,
    entityName: row.entity_name ?? undefined,
    eventAt: row.event_at,
    details: row.details ?? {},
  };
}

function toIso(date: Date): string {
  return date.toISOString();
}

/**
 * استدعاء دالة get_activity_actor_summary لدور واحد محدد.
 * ملاحظة مهمة: p_actor_role يقبل قيمة دور حقيقية فقط (employee/merchant/manager)
 * ولا يقبل قيمة تجميعية مثل 'all' — تمرير 'all' يجعل الفلتر لا يطابق أي صف وترجع الدالة فارغة.
 */
export async function getActorSummaries(opts: {
  actorIds: string[];
  actorRole: UserRole;
  from: Date;
  to: Date;
}): Promise<Record<string, ActorSummary>> {
  if (opts.actorIds.length === 0) return {};
  const { data, error } = await supabase.rpc('get_activity_actor_summary', {
    p_actor_ids: opts.actorIds,
    p_actor_role: opts.actorRole,
    p_from_ts: toIso(opts.from),
    p_to_ts: toIso(opts.to),
  });
  if (error) throw translateError(error);
  const result: Record<string, ActorSummary> = {};
  for (const row of (data as any[]) ?? []) {
    const s = mapSummary(row);
    result[s.actor_id] = s;
  }
  return result;
}

/** سقف أمان لعدد الصفوف في الحساب المحلي الاحتياطي (وضع «الكل» قد يغطي سنوات). */
const MAX_SCAN_ROWS = 20000;
const SCAN_PAGE = 1000;

/**
 * شبكة أمان: تجميع الملخصات محلياً من جدول activity_events.
 * تُستخدم فقط إذا رجعت الدالة فارغة بينما توجد أحداث فعلاً في الفترة، فتمنع
 * ظهور أرقام صفرية كاذبة في أي سيناريو (دور غير مدعوم، صفوف قديمة بلا actor_role...).
 */
async function summarizeFromEvents(
  actorIds: string[],
  opts: { from: Date; to: Date },
): Promise<Record<string, ActorSummary>> {
  const wanted = new Set(actorIds);
  const result: Record<string, ActorSummary> = {};
  if (wanted.size === 0) return result;

  const query = supabase
    .from('activity_events')
    .select('actor_id, event_action, entity_type')
    .gte('event_at', toIso(opts.from))
    .lt('event_at', toIso(opts.to));

  let scanned = 0;
  while (scanned < MAX_SCAN_ROWS) {
    const { data, error } = await query.range(scanned, scanned + SCAN_PAGE - 1);
    if (error) throw translateError(error);
    const rows = (data as any[]) ?? [];
    for (const row of rows) {
      const id = row.actor_id;
      if (!id || !wanted.has(id)) continue;
      const s = (result[id] ??= zeroSummary(id));
      s.total += 1;
      if (row.event_action === 'created') s.created += 1;
      else if (row.event_action === 'updated') s.updated += 1;
      else if (row.event_action === 'deleted') s.deleted += 1;
      if (row.entity_type === 'store') s.stores += 1;
      else if (row.entity_type === 'branch') s.branches += 1;
      else if (row.entity_type === 'product') s.products += 1;
    }
    scanned += rows.length;
    if (rows.length < SCAN_PAGE) break;
  }
  return result;
}

/**
 * ملخصات مجموعة حسابات بأنواع أدوارها (موظفين وتجار ومديرين في استدعاء واحد).
 * الدالة الأصلية تفلتر بـ p_actor_role، لذلك نجمّع المعرّفات حسب الدور ونستدعيها
 * مرة لكل دور ثم ندمج النتائج — مطابق لسلوك تطبيق الموبايل في كل تبويب.
 */
export async function getActorSummariesForActors(
  actors: { id: string; role: string | null | undefined }[],
  opts: { from: Date; to: Date },
): Promise<Record<string, ActorSummary>> {
  if (actors.length === 0) return {};

  const byRole = new Map<UserRole, string[]>();
  for (const a of actors) {
    const role = normalizeRole(a.role);
    const list = byRole.get(role) ?? [];
    list.push(a.id);
    byRole.set(role, list);
  }

  const merged: Record<string, ActorSummary> = {};
  const errors: unknown[] = [];
  await Promise.all(
    [...byRole.entries()].map(async ([role, ids]) => {
      try {
        Object.assign(
          merged,
          await getActorSummaries({ actorIds: ids, actorRole: role, from: opts.from, to: opts.to }),
        );
      } catch (e) {
        errors.push(e);
      }
    }),
  );

  // فشل كل الأدوار = خطأ حقيقي (شبكة/صلاحيات) نُظهره بدل الأصفار الصامتة.
  if (Object.keys(merged).length === 0 && errors.length === byRole.size) {
    throw errors[0];
  }
  if (Object.keys(merged).length > 0) return merged;

  // الدالة رجعت فارغة: نحاول الحساب المحلي قبل إظهار الأصفار.
  try {
    return await summarizeFromEvents(actors.map((a) => a.id), opts);
  } catch {
    return merged;
  }
}

export async function getActorDaily(opts: {
  actorId: string;
  from: Date;
  to: Date;
  timezone?: string;
}): Promise<DailyPoint[]> {
  const { data, error } = await supabase.rpc('get_activity_daily_actor', {
    p_actor_id: opts.actorId,
    p_from_ts: toIso(opts.from),
    p_to_ts: toIso(opts.to),
    p_tz: opts.timezone ?? 'Asia/Damascus',
  });
  if (error) throw translateError(error);
  if (!Array.isArray(data)) return [];

  // الدالة ترجع صفاً لكل (يوم × نوع كيان × إجراء) بحقول
  // activity_day / entity_type / event_action / activity_count
  // — نجمعها حسب اليوم ليعمل مخطط الأعمدة الثلاثي.
  const byDay = new Map<string, DailyPoint>();
  for (const row of data as any[]) {
    const day = String(row.activity_day ?? '').slice(0, 10);
    if (!day) continue;
    const p = byDay.get(day) ?? { day, created: 0, updated: 0, deleted: 0, total: 0 };
    const count = Number(row.activity_count ?? 0);
    const action = String(row.event_action ?? '');
    if (action === 'created') p.created += count;
    else if (action === 'updated') p.updated += count;
    else if (action === 'deleted') p.deleted += count;
    p.total += count;
    byDay.set(day, p);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export interface TimelineFilter {
  action?: ActivityAction;
  entityType?: ActivityEntityType;
}

export async function getTimeline(opts: {
  actorId: string;
  from: Date;
  to: Date;
  filter?: TimelineFilter;
  fromRow?: number;
  limit?: number;
}): Promise<ActivityEvent[]> {
  let builder = supabase
    .from('activity_events')
    .select()
    .eq('actor_id', opts.actorId)
    .gte('event_at', toIso(opts.from))
    .lt('event_at', toIso(opts.to));

  if (opts.filter?.action) {
    builder = builder.eq('event_action', opts.filter.action);
  }
  if (opts.filter?.entityType) {
    builder = builder.eq('entity_type', opts.filter.entityType);
  }

  builder = builder.order('event_at', { ascending: false });

  if (opts.limit != null) {
    builder = builder.range(opts.fromRow ?? 0, (opts.fromRow ?? 0) + opts.limit - 1);
  }

  const { data, error } = await builder;
  if (error) throw translateError(error);
  return (data ?? []).map(mapEvent);
}

// ─────────────── صور عرض/أيقونات للأنشطة ───────────────

export const entityActionIcons: Record<ActivityEntityType, string> = {
  store: 'store',
  branch: 'branch',
  product: 'product',
};


// ─────────────── تفاصيل الحدث (activity_events.details) ───────────────

/**
 * عمود details يخزّن لقطة بيانات الكيان لحظة الحدث من مشغّلات قاعدة البيانات.
 * بعض الصفوف القديمة قد تصل كنص JSON — نتعامل معها بأمان مثل تطبيق الموبايل.
 */
export function readEventDetails(value: any): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** مفاتيح تقنية لا تُعرض للمستخدم (معرّفات، تواقيت نظام، مسارات صور، إحداثيات المستخدم). */
const hiddenDetailKeys = new Set([
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

/** ترتيب العرض المفضّل للحقول المعروفة في «تفاصيل النشاط». */
const detailFieldOrder = [
  'name',
  'price',
  'currency',
  'category',
  'description',
  'address',
  'phone',
  'commercial_register',
  'branch_code',
  'open_at',
  'close_at',
  'notes',
  'shamcash_wallet_id',
  'paymera_wallet_id',
  'is_best_seller',
  'is_active',
  'latitude',
  'longitude',
];

const detailFieldLabels: Record<string, string> = {
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
  shamcash_wallet_id: 'محفظة شام كاش',
  paymera_wallet_id: 'محفظة بايميرا',
  is_best_seller: 'الأكثر مبيعاً',
  is_active: 'مفعّل',
  latitude: 'خط العرض',
  longitude: 'خط الطول',
};

function detailLabel(key: string): string {
  return detailFieldLabels[key] ?? key;
}

/** تنسيق قيمة الحقل للعرض (bool، مصفوفة، سعر مع عملته، وقت HH:MM). */
function formatDetailValue(key: string, value: unknown, details: Record<string, any>): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (Array.isArray(value)) return value.length === 0 ? '—' : `${value.length} عنصر`;
  if (typeof value === 'object') return '—';

  if (key === 'price') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value);
    const code = String(details['currency'] ?? 'SYP') as CurrencyCode;
    return formatPrice(numeric, currencyLabels[code] ?? code);
  }

  const text = String(value).trim();
  if (!text) return '—';
  if (key === 'currency') return currencyLabels[text as CurrencyCode] ?? text;
  if (key === 'open_at' || key === 'close_at') return text.slice(0, 5);
  if (typeof value === 'number' && !Number.isInteger(value)) {
    return String(Number(value.toFixed(6)));
  }
  return text;
}

/** أول حقل معبّر لكل نوع كيان — نفس ترتيب briefDetail في تطبيق الموبايل. */
const briefKeysByEntity: Record<ActivityEntityType, string[]> = {
  store: ['address', 'phone', 'commercial_register', 'category'],
  branch: ['branch_code', 'address', 'phone', 'category'],
  product: ['price', 'category', 'description'],
};

/** سطر مختصر يوضح ما تغيّر فعلاً في الحدث، مثل «العنوان: دمشق». */
export function eventBriefDetail(rawDetails: any, entityType: ActivityEntityType): string {
  const details = readEventDetails(rawDetails);
  for (const key of briefKeysByEntity[entityType] ?? []) {
    const value = formatDetailValue(key, details[key], details);
    if (value !== '—') return `${detailLabel(key)}: ${value}`;
  }

  const fallbackKey = Object.keys(details).find(
    (k) => !hiddenDetailKeys.has(k) && formatDetailValue(k, details[k], details) !== '—',
  );
  if (!fallbackKey) return '';
  return `${detailLabel(fallbackKey)}: ${formatDetailValue(fallbackKey, details[fallbackKey], details)}`;
}

/** كل الحقول المعروضة في ورقة «تفاصيل النشاط»، مرتّبة وتسمياتها عربية. */
export function eventDetailFields(rawDetails: any): { label: string; value: string }[] {
  const details = readEventDetails(rawDetails);
  const keys = Object.keys(details).filter((k) => !hiddenDetailKeys.has(k));
  const ordered = [
    ...detailFieldOrder.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !detailFieldOrder.includes(k)),
  ];
  return ordered
    .map((key) => ({ label: detailLabel(key), value: formatDetailValue(key, details[key], details) }))
    .filter((field) => field.value !== '—');
}

/** اسم الكيان من الحدث، ويرجع لـ details.name إذا كان entity_name فارغاً (مثل الموبايل). */
export function eventName(ev: { entityName?: string; details?: any }): string {
  const direct = (ev.entityName ?? '').trim();
  if (direct) return direct;
  return String(readEventDetails(ev.details)['name'] ?? '').trim();
}

const entityTargetLabels: Record<ActivityEntityType, string> = {
  store: 'للمتجر',
  branch: 'للفرع',
  product: 'للمنتج',
};

export function entityTargetLabel(entityType: ActivityEntityType): string {
  return entityTargetLabels[entityType];
}

/** جملة الحدث الكاملة مثل «عدّل للمتجر «متجر الساعة»». */
export function eventPhrase(ev: {
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityName?: string;
  details?: any;
}): string {
  const name = eventName(ev);
  return `${actionLabel(ev.action)} ${entityTargetLabel(ev.entityType)}${name ? ` «${name}»` : ''}`;
}

export function entityLabel(entityType: ActivityEntityType): string {
  switch (entityType) {
    case 'store':
      return 'المتجر';
    case 'branch':
      return 'الفرع';
    case 'product':
      return 'المنتج';
  }
}

export function actionLabel(action: ActivityAction): string {
  switch (action) {
    case 'created':
      return 'إضافة';
    case 'updated':
      return 'تعديل';
    case 'deleted':
      return 'حذف';
  }
}