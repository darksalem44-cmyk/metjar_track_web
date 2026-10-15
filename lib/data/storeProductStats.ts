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
