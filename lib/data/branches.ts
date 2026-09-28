import { supabase } from '@/lib/supabase';
import type { Branch, CustomFields } from '@/lib/types';
import type { Row } from './base';
import { translateError } from '@/lib/constants';
import { cacheBump } from '@/lib/cache';

/** الأعمدة التي يقرؤها mapBranch — بدل سحب كل أعمدة الجدول. */
const BRANCH_SELECT =
  'id, store_id, name, branch_code, category, phone, latitude, longitude, address, notes, cover_image_urls, ' +
  'signage_image_url, open_at, close_at, is_active, shamcash_wallet_id, shamcash_qr_image_url, paymera_wallet_id, ' +
  'paymera_qr_image_url, custom_fields, created_by, created_at, updated_at';

export function mapBranch(row: Row): Branch {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    branchCode: row.branch_code ?? undefined,
    category: row.category ?? undefined,
    phone: row.phone ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    address: row.address ?? undefined,
    notes: row.notes ?? undefined,
    coverImageUrls: row.cover_image_urls ?? [],
    signageImageUrl: row.signage_image_url ?? undefined,
    openAt: row.open_at ?? '',
    closeAt: row.close_at ?? undefined,
    isActive: row.is_active !== false,
    shamcashWalletId: row.shamcash_wallet_id ?? undefined,
    shamcashQrImageUrl: row.shamcash_qr_image_url ?? undefined,
    paymeraWalletId: row.paymera_wallet_id ?? undefined,
    paymeraQrImageUrl: row.paymera_qr_image_url ?? undefined,
    customFields: row.custom_fields ?? {},
    createdBy: row.created_by ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchBranchesByStore(storeId: string): Promise<Branch[]> {
  const { data, error } = await supabase
    .from('branches')
    .select(BRANCH_SELECT)
    .eq('store_id', storeId)
    .is('deleted_at', null)
    .order('name');
  if (error) throw translateError(error);
  return (data ?? []).map(mapBranch);
}

export async function fetchBranchById(id: string): Promise<Branch | null> {
  const { data, error } = await supabase.from('branches').select(BRANCH_SELECT).eq('id', id).is('deleted_at', null).single();
  if (error || !data) return null;
  return mapBranch(data);
}

export interface BranchInput {
  storeId: string;
  name: string;
  branchCode?: string;
  category?: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  coverImageUrls: string[];
  signageImageUrl?: string;
  openAt: string;
  closeAt?: string;
  isActive: boolean;
  shamcashWalletId?: string;
  shamcashQrImageUrl?: string;
  paymeraWalletId?: string;
  paymeraQrImageUrl?: string;
  customFields: CustomFields;
  userLatitude?: number;
  userLongitude?: number;
}

export async function createBranch(input: BranchInput, createdBy: string): Promise<Branch> {
  const row = {
    store_id: input.storeId,
    name: input.name,
    branch_code: input.branchCode || null,
    category: input.category || null,
    phone: input.phone || null,
    address: input.address || null,
    notes: input.notes || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    cover_image_urls: input.coverImageUrls,
    signage_image_url: input.signageImageUrl || null,
    open_at: input.openAt || null,
    close_at: input.closeAt || null,
    shamcash_wallet_id: input.shamcashWalletId || null,
    shamcash_qr_image_url: input.shamcashQrImageUrl || null,
    paymera_wallet_id: input.paymeraWalletId || null,
    paymera_qr_image_url: input.paymeraQrImageUrl || null,
    user_latitude: input.userLatitude ?? null,
    user_longitude: input.userLongitude ?? null,
    custom_fields: input.customFields,
    is_active: input.isActive,
    created_by: createdBy,
  };
  const { data, error } = await supabase.from('branches').insert(row).select(BRANCH_SELECT).single();
  if (error) throw translateError(error);
  cacheBump('stores');
  cacheBump('branches');
  return mapBranch(data);
}

export async function updateBranch(id: string, input: BranchInput): Promise<Branch> {
  const row = {
    name: input.name,
    branch_code: input.branchCode || null,
    category: input.category || null,
    phone: input.phone || null,
    address: input.address || null,
    notes: input.notes || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    cover_image_urls: input.coverImageUrls,
    signage_image_url: input.signageImageUrl || null,
    open_at: input.openAt || null,
    close_at: input.closeAt || null,
    shamcash_wallet_id: input.shamcashWalletId || null,
    shamcash_qr_image_url: input.shamcashQrImageUrl || null,
    paymera_wallet_id: input.paymeraWalletId || null,
    paymera_qr_image_url: input.paymeraQrImageUrl || null,
    user_latitude: input.userLatitude ?? null,
    user_longitude: input.userLongitude ?? null,
    custom_fields: input.customFields,
    is_active: input.isActive,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('branches').update(row).eq('id', id).select(BRANCH_SELECT).single();
  if (error) throw translateError(error);
  cacheBump('stores');
  cacheBump('branches');
  return mapBranch(data);
}

/** استدعاء RPC للحذف (تعطيل ناعم) مع تأكيد اسم الفرع. */
export async function deleteBranch(branchId: string, confirmationName: string): Promise<void> {
  const { error } = await supabase.rpc('delete_branch_with_confirmation', {
    p_branch_id: branchId,
    p_confirmation_name: confirmationName,
  });
  if (error) throw translateError(error);
  cacheBump('stores');
  cacheBump('branches');
}

export async function assignBranchCode(branchId: string, code: string): Promise<void> {
  const { error } = await supabase.from('branches').update({ branch_code: code }).eq('id', branchId);
  if (error) throw translateError(error);
  cacheBump('branches');
}

export function generateBranchCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buffer = new Uint32Array(5);
  crypto.getRandomValues(buffer);
  const suffix = Array.from(buffer, (v) => alphabet[v % alphabet.length]).join('');
  return `BR-${suffix}`;
}