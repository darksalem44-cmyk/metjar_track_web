import { supabase } from '@/lib/supabase';
import type { Store, Profile } from '@/lib/types';
import { translateError } from '@/lib/constants';
import { resolvePage, type PageParams, type PageResult } from './base';

export interface StoreListParams extends PageParams {
  search?: string;
  createdBy?: string;
}

function mapStore(row: any): Store {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? undefined,
    phone: row.phone ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    address: row.address ?? undefined,
    openAt: row.open_at ?? '',
    closeAt: row.close_at ?? undefined,
    notes: row.notes ?? undefined,
    isBranch: !!row.is_branch,
    commercialRegister: row.commercial_register ?? undefined,
    coverImageUrls: row.cover_image_urls ?? [],
    signageImageUrl: row.signage_image_url ?? undefined,
    createdBy: row.created_by ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isMainBranch: !!row.is_main_branch,
    shamcashWalletId: row.shamcash_wallet_id ?? undefined,
    shamcashQrImageUrl: row.shamcash_qr_image_url ?? undefined,
    paymeraWalletId: row.paymera_wallet_id ?? undefined,
    paymeraQrImageUrl: row.paymera_qr_image_url ?? undefined,
    userLatitude: row.user_latitude ?? undefined,
    userLongitude: row.user_longitude ?? undefined,
    actualDistance: row.actual_distance ?? undefined,
    customFields: row.custom_fields ?? {},
  };
}

export async function fetchStores(params: StoreListParams): Promise<PageResult<Store>> {
  const { page, pageSize, search, createdBy } = params;
  let query = supabase
    .from('stores')
    .select()
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (search?.trim()) {
    query = query.ilike('name', `%${search.trim()}%`);
  }
  if (createdBy?.trim()) {
    query = query.eq('created_by', createdBy);
  }

  const rangeStart = page * pageSize;
  const { data, error } = await query.range(rangeStart, rangeStart + pageSize);
  if (error) throw translateError(error);
  return resolvePage((data ?? []).map(mapStore), page, pageSize);
}

export async function fetchStoreById(id: string): Promise<Store | null> {
  const { data, error } = await supabase.from('stores').select().eq('id', id).single();
  if (error || !data) return null;
  return mapStore(data);
}

export interface StoreInput {
  name: string;
  category?: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  openAt: string;
  closeAt?: string;
  notes?: string;
  commercialRegister?: string;
  coverImageUrls: string[];
  signageImageUrl?: string;
  shamcashWalletId?: string;
  shamcashQrImageUrl?: string;
  paymeraWalletId?: string;
  paymeraQrImageUrl?: string;
  customFields: Record<string, any>;
  userLatitude?: number;
  userLongitude?: number;
}

export async function createStore(input: StoreInput, createdBy: string): Promise<Store> {
  const row = {
    name: input.name,
    category: input.category || null,
    phone: input.phone || null,
    address: input.address || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    open_at: input.openAt || null,
    close_at: input.closeAt || null,
    notes: input.notes || null,
    is_branch: false,
    commercial_register: input.commercialRegister || null,
    cover_image_urls: input.coverImageUrls,
    signage_image_url: input.signageImageUrl || null,
    shamcash_wallet_id: input.shamcashWalletId || null,
    shamcash_qr_image_url: input.shamcashQrImageUrl || null,
    paymera_wallet_id: input.paymeraWalletId || null,
    paymera_qr_image_url: input.paymeraQrImageUrl || null,
    custom_fields: input.customFields,
    user_latitude: input.userLatitude ?? null,
    user_longitude: input.userLongitude ?? null,
    created_by: createdBy,
  };
  const { data, error } = await supabase.from('stores').insert(row).select().single();
  if (error) throw translateError(error);
  return mapStore(data);
}

export async function updateStore(id: string, input: StoreInput): Promise<Store> {
  const row = {
    name: input.name,
    category: input.category || null,
    phone: input.phone || null,
    address: input.address || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    open_at: input.openAt || null,
    close_at: input.closeAt || null,
    notes: input.notes || null,
    commercial_register: input.commercialRegister || null,
    cover_image_urls: input.coverImageUrls,
    signage_image_url: input.signageImageUrl || null,
    shamcash_wallet_id: input.shamcashWalletId || null,
    shamcash_qr_image_url: input.shamcashQrImageUrl || null,
    paymera_wallet_id: input.paymeraWalletId || null,
    paymera_qr_image_url: input.paymeraQrImageUrl || null,
    custom_fields: input.customFields,
    user_latitude: input.userLatitude ?? null,
    user_longitude: input.userLongitude ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('stores').update(row).eq('id', id).select().single();
  if (error) throw translateError(error);
  return mapStore(data);
}

export async function deleteStore(storeId: string, confirmationName: string): Promise<void> {
  const { error } = await supabase.rpc('delete_store_with_confirmation', {
    p_store_id: storeId,
    p_confirmation_name: confirmationName,
  });
  if (error) throw translateError(error);
}

export async function getCreatorNames(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  const perCall = unique.slice(0, 200);
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', perCall);
  if (error) return {};
  const result: Record<string, string> = {};
  for (const row of data ?? []) result[row.id] = row.full_name ?? '';
  return result;
}

export function canEditStore(profile: Profile): boolean {
  return profile.role === 'manager' || profile.canEdit;
}

export function canDeleteStore(profile: Profile): boolean {
  return profile.role === 'manager' || profile.canDelete;
}