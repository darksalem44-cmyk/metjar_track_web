import { supabase } from '@/lib/supabase';
import type {
  ActivityAction,
  ActivityEntityType,
  ActorSummary,
  ActivityEvent,
  ActivityActorRole,
  DailyPoint,
} from '@/lib/types';
import { translateError } from '@/lib/constants';

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

export async function getActorSummaries(opts: {
  actorIds: string[];
  actorRole: ActivityActorRole;
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

export function activityPhrase(
  action: ActivityAction,
  entityType: ActivityEntityType,
  entityName?: string,
): string {
  const entity = entityLabel(entityType);
  switch (action) {
    case 'created':
      return `${entity}: ${entityName ?? ''}`.trim();
    case 'updated':
      return `تعديل ${entity}: ${entityName ?? ''}`.trim();
    case 'deleted':
      return `حذف ${entity}: ${entityName ?? ''}`.trim();
  }
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