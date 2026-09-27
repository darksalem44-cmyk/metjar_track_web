/**
 * كاش بسيط للصفحات (stale-while-revalidate):
 * أول فتح يجلب من الشبكة ويخزّن النسخة، وأي فتح لاحق يعرض النسخة المحفوظة فوراً
 * ثم يجلب البيانات الجديدة في الخلفية ويحدّث الواجهة عند وصولها.
 *
 * الإبطال بأسلوب الأجيال: أي إضافة/تعديل/حذف يرفع رقم جيل النطاق (stores مثلاً)،
 * فتُقرأ المفاتيح القديمة كمفقودة في الفتح التالي — بلا حاجة لمسح كل إدخال يدوياً.
 */

const PREFIX = 'mt_page_cache_';
const GEN_PREFIX = 'mt_cache_gen_';
const VERSION = 'v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // نسخة أقدم من يوم تُتجاهل
const MAX_ENTRIES = 80; // حد أقصى للإدخالات مع حذف الأقدم عند التجاوز

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function fullKey(key: string): string {
  return `${PREFIX}${VERSION}:${key}`;
}

/** يقرأ نسخة مخزنة أو null إن لم توجد أو انتهت صلاحيتها. */
export function cacheGet<T>(key: string): T | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(fullKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; data?: T };
    if (!parsed || typeof parsed.at !== 'number') return null;
    if (Date.now() - parsed.at > MAX_AGE_MS) {
      storage.removeItem(fullKey(key));
      return null;
    }
    return (parsed.data ?? null) as T | null;
  } catch {
    return null;
  }
}

/** يخزّن نسخة مع طابع زمني، ويقلّم الإدخالات الأقدم عند تجاوز الحد. */
export function cacheSet<T>(key: string, data: T): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(fullKey(key), JSON.stringify({ at: Date.now(), data }));
    pruneOldEntries(storage);
  } catch {
    // التخزين ممتلئ أو غير متاح — الكاش تحسين اختياري ولا يُفشل التحميل
  }
}

function pruneOldEntries(storage: Storage): void {
  try {
    const entries: { key: string; at: number }[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      try {
        const parsed = JSON.parse(storage.getItem(k) ?? '') as { at?: number };
        entries.push({ key: k, at: parsed?.at ?? 0 });
      } catch {
        entries.push({ key: k, at: 0 });
      }
    }
    if (entries.length <= MAX_ENTRIES) return;
    entries.sort((a, b) => a.at - b.at);
    for (const entry of entries.slice(0, entries.length - MAX_ENTRIES)) {
      storage.removeItem(entry.key);
    }
  } catch {
    // التقليم تحسين اختياري
  }
}

export function cacheRemove(key: string): void {
  safeStorage()?.removeItem(fullKey(key));
}

/** يرفع جيل النطاق — كل مفاتيح النطاق المخزنة تصبح قديمة ولا تُعرض بعدها. */
export function cacheBump(domain: string): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(`${GEN_PREFIX}${domain}`, String(Date.now()));
  } catch {
    // تجاهل
  }
}

/** جيل النطاق الحالي (جزء من مفتاح الكاش). */
export function cacheGeneration(domain: string): string {
  const storage = safeStorage();
  if (!storage) return '0';
  try {
    return storage.getItem(`${GEN_PREFIX}${domain}`) ?? '0';
  } catch {
    return '0';
  }
}

/** يبني مفتاح كاش مضمناً جيل النطاق — يُستخدم عند التحميل في الصفحات. */
export function cacheKey(domain: string, suffix: string): string {
  return `${domain}:${cacheGeneration(domain)}:${suffix}`;
}

/**
 * يجلب البيانات بنمط الكاش أولاً:
 * - إن وُجدت نسخة مخزنة تُطبّق فوراً (المصدر 'cache').
 * - تجلب النسخة الجديدة من الشبكة وتُخزّن وتُطبّق عند وصولها (المصدر 'network').
 * - فشل الشبكة مع وجود نسخة مخزنة يُبقي المعروض ولا يرمي خطأ.
 * - فشل الشبكة بلا نسخة مخزنة يرمي الخطأ ليُظهره الصفحة كالمعتاد.
 */
export async function cachedLoad<T>(
  key: string,
  fetcher: () => Promise<T>,
  apply: (data: T, source: 'cache' | 'network') => void,
): Promise<void> {
  const cached = cacheGet<T>(key);
  if (cached !== null) apply(cached, 'cache');
  try {
    const data = await fetcher();
    cacheSet(key, data);
    apply(data, 'network');
  } catch (error) {
    if (cached === null) throw error;
    // مع نسخة معروضة: فشل التحديث الخلفي لا يُفشل الصفحة
  }
}
