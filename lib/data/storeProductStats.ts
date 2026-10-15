import { supabase } from '@/lib/supabase';
import { translateError } from '@/lib/constants';
import type { Row } from './base';

/** حجم دفعة الجلب — يطابق الحد الأقصى الافتراضي لصفوف PostgREST في الطلب الواحد. */
const BATCH_SIZE = 1000;

export interface StoreProductStats {
  storeId: string;
  storeName: string;
  total: number;
  /** منتجات بسعر 0 أو بلا سعر. */
  unpriced: number;
  priced: number;
}

/** يجلب كل الصفوف على دفعات متتالية حتى تنفد النتائج. */
async function fetchAllRows(build: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await build(from, from + BATCH_SIZE - 1);
    if (error) throw translateError(error);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < BATCH_SIZE) return rows;
  }
}

/**
 * إحصائية المنتجات لكل متجر حي (غير محذوف ناعماً): الإجمالي، غير المسعّرة، المسعّرة.
 * تُجمّع على المتصفح من عمودين فقط (store_id, price) لتبقى الحمولة خفيفة،
 * وتظهر المتاجر التي لا منتجات لها بأصفار.
 */
export async function fetchStoreProductStats(): Promise<StoreProductStats[]> {
  const [stores, products] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase.from('stores').select('id, name').is('deleted_at', null).order('id').range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from('products')
        .select('store_id, price, stores!inner(id)')
        .is('stores.deleted_at', null)
        .order('id')
        .range(from, to),
    ),
  ]);

  const stats = new Map<string, StoreProductStats>();
  for (const s of stores) {
    stats.set(s.id, { storeId: s.id, storeName: s.name ?? '', total: 0, unpriced: 0, priced: 0 });
  }
  for (const p of products) {
    const entry = stats.get(p.store_id);
    if (!entry) continue;
    entry.total += 1;
    if (Number(p.price ?? 0) > 0) entry.priced += 1;
    else entry.unpriced += 1;
  }
  return [...stats.values()];
}

/** يحوّل تاريخ حقل الإدخال (YYYY-MM-DD) إلى بداية أو نهاية ذلك اليوم بالتوقيت المحلي بصيغة ISO. */
function dayBoundary(day: string, end: boolean): string {
  const [y, m, d] = day.split('-').map(Number);
  return (end ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d)).toISOString();
}

/** شرط PostgREST لعمود زمني ضمن المدى (الطرفان اختياريان). */
function rangeCondition(column: string, from?: string, to?: string): string {
  const parts = [
    from ? `${column}.gte."${dayBoundary(from, false)}"` : '',
    to ? `${column}.lte."${dayBoundary(to, true)}"` : '',
  ].filter(Boolean);
  return parts.length === 1 ? parts[0] : `and(${parts.join(',')})`;
}

/**
 * معرّفات المتاجر التي أُضيف أو عُدّل فيها منتج واحد على الأقل ضمن المدى الزمني
 * (from/to بصيغة YYYY-MM-DD، ويكفي أحدهما).
 */
export async function fetchStoreIdsWithProductActivity(range: { from?: string; to?: string }): Promise<Set<string>> {
  const { from, to } = range;
  if (!from && !to) return new Set();
  const condition = `${rangeCondition('created_at', from, to)},${rangeCondition('updated_at', from, to)}`;
  const rows = await fetchAllRows((start, end) =>
    supabase
      .from('products')
      .select('store_id, stores!inner(id)')
      .is('stores.deleted_at', null)
      .or(condition)
      .order('id')
      .range(start, end),
  );
  return new Set(rows.map((r) => r.store_id as string));
}
