export type UserRole = 'employee' | 'merchant' | 'manager';
export type CurrencyCode = 'SYP' | 'USD' | 'TRY';
export type ActivityAction = 'created' | 'updated' | 'deleted';
export type ActivityEntityType = 'store' | 'branch' | 'product';
export type ActivityActorRole = 'all' | 'manager' | 'merchant' | 'employee';
export type PeriodKey = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom';
export type AccountFilter = 'all' | 'active' | 'disabled' | 'withPermissions';
export type AccountTypeFilter = 'merchant' | 'employee';

export interface Profile {
  id: string;
  email?: string;
  fullName: string;
  role: UserRole;
  createdAt?: string;
  canEdit: boolean;
  canDelete: boolean;
  isActive: boolean;
}

export interface Store {
  id: string;
  name: string;
  category?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  openAt: string;
  closeAt?: string;
  notes?: string;
  isBranch: boolean;
  commercialRegister?: string;
  coverImageUrls: string[];
  signageImageUrl?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isMainBranch?: boolean;
  shamcashWalletId?: string;
  shamcashQrImageUrl?: string;
  paymeraWalletId?: string;
  paymeraQrImageUrl?: string;
  userLatitude?: number;
  userLongitude?: number;
  actualDistance?: number;
  customFields: Record<string, any>;
  deletedAt?: string;
}

export interface Branch {
  id: string;
  storeId: string;
  storeName?: string;
  name: string;
  branchCode?: string;
  category?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
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
  customFields: Record<string, any>;
  deletedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  storeId: string;
  branchId?: string;
  name: string;
  price: number;
  currency: CurrencyCode;
  imageUrls: string[];
  description?: string;
  category?: string;
  isBestSeller: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  storeName?: string;
  branchName?: string;
}

export interface ActivityEvent {
  id: string;
  actorId?: string;
  actorRole?: ActivityActorRole;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: string;
  entityName?: string;
  eventAt: string;
  details: Record<string, any>;
}

export interface ActorWithProfile {
  id: string;
  // دور الحساب الفعلي — لا يكون 'all' أبداً (الـ RPC يفلتر بهذا الدور)
  role: UserRole;
  email?: string;
  fullName: string;
  canEdit: boolean;
  canDelete: boolean;
  isActive: boolean;
  createdAt?: string;
}

export interface ActorSummary {
  actor_id: string;
  total: number;
  created: number;
  updated: number;
  deleted: number;
  stores: number;
  branches: number;
  products: number;
}

export interface DailyPoint {
  day: string;
  created: number;
  updated: number;
  deleted: number;
  total: number;
}

export interface ActivityEventGroup {
  label: string;
  events: ActivityEvent[];
}