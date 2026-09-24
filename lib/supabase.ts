import { createClient } from '@supabase/supabase-js';
import { AppConstants } from './constants';

export const supabase = createClient(
  AppConstants.supabaseUrl,
  AppConstants.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ─────────────── Storage helpers (bucket: store-images) ───────────────

const bucket = AppConstants.imageBucket;

export async function uploadImageObject(
  path: string,
  file: File,
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function deleteImageObjects(paths: string[]): Promise<void> {
  const valid = paths.filter(Boolean);
  if (valid.length === 0) return;
  const { error } = await supabase.storage.from(bucket).remove(valid);
  if (error) throw error;
}

/** التعامل مع أيصورة برمجية: path كامل أو URL مباشر. */
export function normalizeImagePath(value?: string | null): string {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('blob:')) {
    return value;
  }
  return value;
}

export async function resolveImageUrl(value?: string | null): Promise<string> {
  const path = normalizeImagePath(value);
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('blob:')) return path;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data) return '';
  return data.signedUrl;
}

export async function resolveImageUrls(paths: string[]): Promise<string[]> {
  const cleaned = paths.filter(Boolean);
  if (cleaned.length === 0) return [];
  return Promise.all(cleaned.map((p) => resolveImageUrl(p)));
}

/** يبني مساراً فريداً لصورة داخل مجلد محدد. */
export function buildImagePath(folder: string, ext: string): string {
  const random = Math.random().toString(36).slice(2, 12);
  const sanitizedExt = ext.startsWith('.') ? ext : `.${ext}`;
  return `${folder}${Date.now()}_${random}${sanitizedExt}`;
}

/** يفحص ما إذا كان المسار يشير إلى صورة مخزنة في Supabase Storage. */
export function isStoredPath(value?: string | null): boolean {
  const path = normalizeImagePath(value);
  return !!path && !path.startsWith('http') && !path.startsWith('blob:');
}

/** ترشيح قائمة مسارات والاحتفاظ فقط بالمسارات الصالحة المخزنة. */
export function filterStoredPaths(paths: (string | undefined | null)[]): string[] {
  return paths.filter((p): p is string => isStoredPath(p));
}