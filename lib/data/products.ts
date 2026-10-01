import { supabase } from '@/lib/supabase';
import type { Product, CurrencyCode } from '@/lib/types';
import { translateError } from '@/lib/constants';
import { resolvePage, type Row, type PageParams, type PageResult } from './base';
import { cacheBump, cacheKey, cacheGet } from '@/lib/cache';

/** مدة صلاحية عدّاد الإجمالي الكلي داخل التخزين المحلي قبل إعادة حسابه (60 ثانية). */
const COUNT_TTL_MS = 60 * 1000;

/** الأعمدة التي يقرؤها mapProduct — تمنع سحب JSON كامل لكل منتج في كل صفحة. */
const PRODUCT_SELECT =
  'id, store_id, branch_id, name, price, currency, images_url, description, category, is_best_seller, created_by, created_at, updated_at';

export function mapProduct(row: Row): Product {
  return {
    id: row.id,
    storeId: row.store_id,
    branchId: row.branch_id ?? undefined,
    name: row.name,
    price: row.price ?? 0,
    currency: (row.currency ?? 'SYP') as CurrencyCode,
    imageUrls: row.images_url ?? [],
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    isBestSeller: !!row.is_best_seller,
    createdBy: row.created_by ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ProductListParams extends PageParams {
  search?: string;
  storeIds?: string[];
  storeId?: string;
  branchId?: string;
}

/**
 * ربط داخلي مع جدول المتاجر: يفلتر المنتجات التابعة لمتاجر محذوفة ناعماً
 * (deleted_at != null) فيبقى القوائم والعدّ متطابقين مع تطبيق الموبايل —
 * الذي يقرأ منتجات كل متجر عبر سجل المتجر الحي فقط.
 */
const LIVE_STORE_EMBED = 'stores!inner(id)';

export async function fetchAllProducts(params: ProductListParams): Promise<PageResult<Product>> {
  const { page, pageSize, search, storeIds, storeId, branchId } = params;
  // ملاحظة: جدول products لا يحتوي deleted_at (الحذف نهائي مباشرة)،
  // لكن حذف المتجر ناعم، لذا نستثني منتجات المتاجر المحذوفة عبر الربط أعلاه.
  let query = supabase
    .from('products')
    .select(`${PRODUCT_SELECT}, ${LIVE_STORE_EMBED}`)
    .is('stores.deleted_at', null)
    .order('created_at', { ascending: false });

  if (search?.trim()) {
    query = query.ilike('name', `%${search.trim()}%`);
  }
  if (storeId?.trim()) {
    query = query.eq('store_id', storeId);
  }
  if (branchId?.trim()) {
    query = query.eq('branch_id', branchId);
  }
  if (storeIds && storeIds.length > 0) {
    query = query.in('store_id', storeIds);
  }

  const rangeStart = page * pageSize;
  const { data, error } = await query.range(rangeStart, rangeStart + pageSize);
  if (error) throw translateError(error);
  return resolvePage((data ?? []).map(mapProduct), page, pageSize);
}

export async function fetchProductsByStore(storeId: string, limit = 100): Promise<Product[]> {
  // أمان إضافي: لو حُذف المتجر ناعماً لا تُعاد منتجاته حتى من شاشة قديمة
  const { data, error } = await supabase
    .from('products')
    .select(`${PRODUCT_SELECT}, ${LIVE_STORE_EMBED}`)
    .eq('store_id', storeId)
    .is('stores.deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw translateError(error);
  return (data ?? []).map(mapProduct);
}

export async function fetchProductsByBranch(branchId: string, limit = 100): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw translateError(error);
  return (data ?? []).map(mapProduct);
}

export async function fetchProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('id', id).single();
  if (error || !data) return null;
  return mapProduct(data);
}

export async function countProductsByStore(storeId: string): Promise<number> {
  const { count, error } = await supabase
    .from('products')
    .select(`${LIVE_STORE_EMBED}`, { count: 'exact', head: true })
    .eq('store_id', storeId)
    .is('stores.deleted_at', null);
  if (error) return 0;
  return count ?? 0;
}

/** عدد المنتجات الكلي (بعد فلاتر اختيارية مطابقة لفلتر القائمة). كاش قصير 60 ثانية. */
export async function countAllProducts(filter?: {
  search?: string;
  storeIds?: string[];
  storeId?: string;
  branchId?: string;
}): Promise<number> {
  const search = filter?.search ?? '';
  const storeIds = filter?.storeIds ?? [];
  const storeId = filter?.storeId ?? '';
  const branchId = filter?.branchId ?? '';
  const key = `count:${cacheKey(
    'products',
    `all:q:${search}:sids:${[...storeIds].sort().join(',')}:sid:${storeId}:bid:${branchId}`,
  )}`;
  const cached = cacheGet<{ at: number; value: number }>(key);
  const now = Date.now();
  if (cached && now - cached.at < COUNT_TTL_MS) return cached.value;
  // الربط الداخلي يستثني منتجات المتاجر المحذوفة ناعماً من العدّ أيضاً
  let query = supabase
    .from('products')
    .select(LIVE_STORE_EMBED, { count: 'exact', head: true })
    .is('stores.deleted_at', null);
  if (search.trim()) query = query.ilike('name', `%${search.trim()}%`);
  if (storeId.trim()) query = query.eq('store_id', storeId);
  if (branchId.trim()) query = query.eq('branch_id', branchId);
  if (storeIds.length > 0) query = query.in('store_id', storeIds);
  const { count, error } = await query;
  if (error) return cached?.value ?? 0;
  const value = count ?? 0;
  try {
    localStorage.setItem(key, JSON.stringify({ at: now, value }));
  } catch {
    // التخزين ممتلئ أو غير متاح — تجاهل
  }
  return value;
}

export interface ProductInput {
  storeId: string;
  branchId?: string;
  name: string;
  price: number;
  currency: CurrencyCode;
  imageUrls: string[];
  description?: string;
  category?: string;
  isBestSeller: boolean;
}

export async function createProduct(input: ProductInput, createdBy: string): Promise<Product> {
  const row = {
    store_id: input.storeId,
    branch_id: input.branchId || null,
    name: input.name,
    price: input.price,
    currency: input.currency,
    images_url: input.imageUrls,
    description: input.description || null,
    category: input.category || null,
    is_best_seller: input.isBestSeller,
    created_by: createdBy,
  };
  const { data, error } = await supabase.from('products').insert(row).select(PRODUCT_SELECT).single();
  if (error) throw translateError(error);
  cacheBump('products');
  return mapProduct(data);
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const row = {
    store_id: input.storeId,
    branch_id: input.branchId || null,
    name: input.name,
    price: input.price,
    currency: input.currency,
    images_url: input.imageUrls,
    description: input.description || null,
    category: input.category || null,
    is_best_seller: input.isBestSeller,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('products').update(row).eq('id', id).select(PRODUCT_SELECT).single();
  if (error) throw translateError(error);
  cacheBump('products');
  return mapProduct(data);
}

export async function deleteProduct(productId: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) throw translateError(error);
  cacheBump('products');
}