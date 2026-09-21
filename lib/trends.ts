import type { ActivityAction, ActivityEntityType } from '@/lib/types';
import { startOfWeek, weekLabelFor } from '@/lib/notifications';

// ─────────────── سلسلة الاتجاه الأسبوعية ───────────────

/** نقطة أسبوع في لوحة الاتجاهات. */
export interface TrendPoint {
  /** مفتاح الأسبوع = تاريخ بدايته (الأحد) بصيغة ISO */
  key: string;
  /** وسم «20/09 – 26/09» */
  label: string;
  start: string;
  end: string;
  total: number;
  created: number;
  updated: number;
  deleted: number;
  /** عدد الكيانات المختلفة التي لمسها الأسبوع */
  entityCount: number;
  /** عدد الفاعلين المختلفين في الأسبوع */
  actorCount: number;
}

/** أصغر شكل يحتاجه حساب الاتجاهات — AdminAlert يحققه بالكامل. */
export interface TrendEventLike {
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: string;
  entityName: string;
  actorId?: string;
  actorName: string;
  eventAt: string;
}

/** يبني سلسلة أحدث N أسابيع (الأحدث أولاً كما يعرضها الأرشيف). */
export function buildActivityTrendSeries(
  events: TrendEventLike[],
  opts: { weeks?: number; now?: Date } = {},
): TrendPoint[] {
  const weeks = opts.weeks ?? 8;
  const currentStart = startOfWeek(opts.now ?? new Date());

  const buckets: TrendPoint[] = [];
  for (let i = 0; i < weeks; i++) {
    const start = new Date(currentStart.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    buckets.push({
      key: start.toISOString().slice(0, 10),
      label: weekLabelFor(start),
      start: start.toISOString(),
      end: end.toISOString(),
      total: 0,
      created: 0,
      updated: 0,
      deleted: 0,
      entityCount: 0,
      actorCount: 0,
    });
  }

  const rangeStart = Date.parse(buckets[buckets.length - 1].start);
  const entitiesPerWeek = new Map<string, Set<string>>();
  const actorsPerWeek = new Map<string, Set<string>>();

  for (const event of events) {
    const at = Date.parse(event.eventAt);
    if (!Number.isFinite(at) || at < rangeStart) continue;
    const bucket = buckets.find((b) => at >= Date.parse(b.start) && at < Date.parse(b.end));
    if (!bucket) continue;

    bucket.total += 1;
    if (event.action === 'created') bucket.created += 1;
    else if (event.action === 'updated') bucket.updated += 1;
    else if (event.action === 'deleted') bucket.deleted += 1;

    const entityKey = `${event.entityType}:${event.entityId ?? event.entityName}`;
    let entitySet = entitiesPerWeek.get(bucket.key);
    if (!entitySet) {
      entitySet = new Set();
      entitiesPerWeek.set(bucket.key, entitySet);
    }
    entitySet.add(entityKey);
    if (event.actorId) {
      let actorSet = actorsPerWeek.get(bucket.key);
      if (!actorSet) {
        actorSet = new Set();
        actorsPerWeek.set(bucket.key, actorSet);
      }
      actorSet.add(event.actorId);
    }
  }

  for (const bucket of buckets) {
    bucket.entityCount = entitiesPerWeek.get(bucket.key)?.size ?? 0;
    bucket.actorCount = actorsPerWeek.get(bucket.key)?.size ?? 0;
  }

  return buckets;
}

/** فرق أسبوع عن سابقه (السابق زمنياً)، أو null إذا لا يوجد أسبوع سابق. */
export function weekDelta(point: TrendPoint, series: TrendPoint[]): number | null {
  // السلسلة الأحدث أولاً: الأسبوع السابق زمنياً في الموضع التالي
  const index = series.indexOf(point);
  const previous = series[index + 1];
  if (!previous) return null;
  return point.total - previous.total;
}

/** صياغة الفرق بالعربية مع اتجاهه: «+5 أحداث عن الأسبوع السابق» أو «ارتفاع/انخفاض» بحسب العدد. */
export function formatDelta(delta: number | null): string {
  if (delta === null) return '';
  if (delta === 0) return 'مطابق للأسبوع السابق';
  const abs = Math.abs(delta);
  if (abs === 1) return `${delta > 0 ? '+' : '−'}حدثاً واحداً عن الأسبوع السابق`;
  if (abs === 2) return `${delta > 0 ? '+' : '−'}حدثان عن الأسبوع السابق`;
  if (abs <= 10) return `${delta > 0 ? '+' : '−'}${abs} أحداث عن الأسبوع السابق`;
  return `${delta > 0 ? '+' : '−'}${abs} حدثاً عن الأسبوع السابق`;
}

// ─────────────── الأكثر نشاطاً وتغييراً ───────────────

export interface TopActor {
  id: string;
  name: string;
  count: number;
  created: number;
  updated: number;
  deleted: number;
}

export interface TopEntity {
  key: string;
  /** معرّف الكيان إن وُجد — لفتح صفحته */
  id?: string;
  entityType: ActivityEntityType;
  name: string;
  count: number;
  created: number;
  updated: number;
  deleted: number;
}

export interface TopEntities {
  actors: TopActor[];
  entities: TopEntity[];
}

/** يرتّب أكثر الموظفين نشاطاً وأكثر الكيانات تعديلاً داخل النافذة الزمنية. */
export function buildTopEntities(
  events: TrendEventLike[],
  opts: { weeks?: number; now?: Date; limit?: number } = {},
): TopEntities {
  const weeks = opts.weeks ?? 8;
  const limit = opts.limit ?? 5;
  const windowStart = startOfWeek(opts.now ?? new Date()).getTime() - (weeks - 1) * 7 * 24 * 60 * 60 * 1000;

  const actors = new Map<string, TopActor>();
  const entities = new Map<string, TopEntity>();

  for (const event of events) {
    const at = Date.parse(event.eventAt);
    if (!Number.isFinite(at) || at < windowStart) continue;

    if (event.actorId) {
      let actor = actors.get(event.actorId);
      if (!actor) {
        actor = {
          id: event.actorId,
          name: event.actorName,
          count: 0,
          created: 0,
          updated: 0,
          deleted: 0,
        };
        actors.set(event.actorId, actor);
      }
      actor.count += 1;
      actor[event.action] += 1;
    }

    const key = `${event.entityType}:${event.entityId ?? event.entityName}`;
    let entity = entities.get(key);
    if (!entity) {
      entity = {
        key,
        id: event.entityId,
        entityType: event.entityType,
        name: event.entityName,
        count: 0,
        created: 0,
        updated: 0,
        deleted: 0,
      };
      entities.set(key, entity);
    }
    entity.count += 1;
    entity[event.action] += 1;
  }

  return {
    actors: [...actors.values()].sort((a, b) => b.count - a.count).slice(0, limit),
    entities: [...entities.values()].sort((a, b) => b.count - a.count).slice(0, limit),
  };
}

// ─────────────── تصدير CSV ───────────────

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** يبني CSV لجدول الأسابيع (صف لكل أسبوع بإحصاءاته وفرقه). */
export function trendToCsv(series: TrendPoint[], tops: TopEntities): string {
  const header = [
    'الأسبوع',
    'من',
    'إلى',
    'الإجمالي',
    'إضافات',
    'تعديلات',
    'حذف',
    'الكيانات المتأثرة',
    'الفاعلون',
    'الفرق عن السابق',
  ];

  const rows = series.map((point) => {
    const delta = weekDelta(point, series);
    const startDate = new Date(point.start);
    const endDate = new Date(point.end);
    endDate.setDate(endDate.getDate() - 1);
    return [
      point.label,
      `${startDate.getFullYear()}/${startDate.getMonth() + 1}/${startDate.getDate()}`,
      `${endDate.getFullYear()}/${endDate.getMonth() + 1}/${endDate.getDate()}`,
      point.total,
      point.created,
      point.updated,
      point.deleted,
      point.entityCount,
      point.actorCount,
      delta === null ? '' : formatDelta(delta),
    ]
      .map(csvCell)
      .join(',');
  });

  const actorHeader = ['', '', '', '', 'أكثر الموظفين نشاطاً', '', '', '', '', ''];
  const actorRows = tops.actors.map((a) =>
    ['', '', '', '', `${a.name} (${a.count})`, '', '', '', '', ''].map(csvCell).join(','),
  );
  const entityHeader = ['', '', '', '', 'أكثر الكيانات تغييراً', '', '', '', '', ''];
  const entityRows = tops.entities.map((e) =>
    ['', '', '', '', `${e.name} (${e.count})`, '', '', '', '', ''].map(csvCell).join(','),
  );

  return [
    header.map(csvCell).join(','),
    ...rows,
    '',
    actorHeader.map(csvCell).join(','),
    ...actorRows,
    '',
    entityHeader.map(csvCell).join(','),
    ...entityRows,
  ].join('\r\n');
}
