import { supabase } from '@/lib/supabase';
import type { Product, CurrencyCode } from '@/lib/types';
import { translateError } from '@/lib/constants';
import { resolvePage, type PageParams, type PageResult } from './base';

export function mapProduct(row: any): Product {
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

export async function fetchAllProducts(params: ProductListParams): Promise<PageResult<Product>> {
  const { page, pageSize, search, storeIds, storeId, branchId } = params;
  // ملاحظة: جدول products لا يحتوي deleted_at (الحذف نهائي مباشرة)
  let query = supabase
    .from('products')
    .select()
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
  const { data, error } = await supabase
    .from('products')
    .select()
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw translateError(error);
  return (data ?? []).map(mapProduct);
}

export async function fetchProductsByBranch(branchId: string, limit = 100): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select()
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw translateError(error);
  return (data ?? []).map(mapProduct);
}

export async function fetchProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase.from('products').select().eq('id', id).single();
  if (error || !data) return null;
  return mapProduct(data);
}

export async function countProductsByStore(storeId: string): Promise<number> {
  const { count, error } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId);
  if (error) return 0;
  return count ?? 0;
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
  const { data, error } = await supabase.from('products').insert(row).select().single();
  if (error) throw translateError(error);
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
  const { data, error } = await supabase.from('products').update(row).eq('id', id).select().single();
  if (error) throw translateError(error);
  return mapProduct(data);
}

export async function deleteProduct(productId: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) throw translateError(error);
}