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

function isDirect(path: string): boolean {
  return path.startsWith('http') || path.startsWith('blob:');
}

export async function resolveImageUrl(value?: string | null): Promise<string> {
  const path = normalizeImagePath(value);
  if (!path) return '';
  if (isDirect(path)) return path;
  return queueSigning(path);
}

const SIGN_TTL_SECONDS = 3600;
const SIGN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const SIGN_CHUNK = 50;

const signedCache = new Map<string, { url: string; validUntil: number }>();
const signQueue = new Map<string, Set<(url: string) => void>>();
let signFlushTimer: ReturnType<typeof setTimeout> | null = null;

function freshSignedUrl(path: string): string | null {
  const hit = signedCache.get(path);
  if (!hit || hit.validUntil <= Date.now()) {
    signedCache.delete(path);
    return null;
  }
  return hit.url;
}

async function signChunk(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, SIGN_TTL_SECONDS);
  if (error || !data) return out;
  const validUntil = Date.now() + SIGN_TTL_SECONDS * 1000 - SIGN_REFRESH_MARGIN_MS;
  data.forEach((row, i) => {
    const path = (row as { path?: string }).path ?? paths[i];
    if (row.signedUrl && path) {
      signedCache.set(path, { url: row.signedUrl, validUntil });
      out.set(path, row.signedUrl);
    }
  });
  return out;
}

/** يوقّع دفعة مسارات: من الكاش أولاً ثم بطلب واحد لكل مجموعة ناقصة. */
export async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const out = new Map<string, string>();
  const missing: string[] = [];
  for (const path of unique) {
    const hit = freshSignedUrl(path);
    if (hit) out.set(path, hit);
    else missing.push(path);
  }
  for (let i = 0; i < missing.length; i += SIGN_CHUNK) {
    const fresh = await signChunk(missing.slice(i, i + SIGN_CHUNK));
    fresh.forEach((url, path) => out.set(path, url));
  }
  return out;
}

/** يجمع كل الطلبات الواردة في نفس الدورة في طلب توقيع واحد. */
function queueSigning(path: string): Promise<string> {
  const hit = freshSignedUrl(path);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const waiters = signQueue.get(path) ?? new Set();
    waiters.add(resolve);
    signQueue.set(path, waiters);
    if (!signFlushTimer) signFlushTimer = setTimeout(flushSigning, 0);
  });
}

async function flushSigning(): Promise<void> {
  signFlushTimer = null;
  const entries = [...signQueue.entries()];
  signQueue.clear();
  const missing = entries.map(([path]) => path).filter((p) => !freshSignedUrl(p));
  const signed = await signPaths(missing);
  for (const [path, waiters] of entries) {
    const url = signed.get(path) ?? freshSignedUrl(path) ?? path;
    for (const resolve of waiters) resolve(url);
  }
}

/** يبني مساراً فريداً لصورة داخل مجلد محدد. */
export function buildImagePath(folder: string, ext: string): string {
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
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