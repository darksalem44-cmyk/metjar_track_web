import { supabase } from '@/lib/supabase';

/** اسم دالة الحافة التي تصدّر جداول public إلى CSV وترفعها إلى Google Drive. */
export const BACKUP_FUNCTION = 'full-backup-with-storage';

/** كاش الاحتياط: تاريخ آخر نسخة يُحفظ لكل مستخدم على هذا المتصفح (لا تُحفظ الجداول). */
const lastBackupKey = (userId: string) => `mt_backup_last_${userId}`;

interface BackupResponse {
  success?: unknown;
  mode?: unknown;
  tables_exported?: unknown;
  files?: unknown;
  error?: unknown;
  message?: unknown;
}

/** يقتطع النصوص الطويلة القادمة من الخادم حتى تبقى صالحة للعرض. */
function truncate(value: string, max = 180): string {
  const text = value.trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * يحوّل نص فشل الدالة إلى رسالة عربية واحدة مفهومة.
 *
 * فشل الرفع يصل كنص إنجليزي متعدد الأسطر يحمل JSON كاملاً من Google Drive،
 * وهذا لا يصلح للعرض — لذلك تُلتقط الحالات المعروفة وتُترجم، ويُقتطع غيرها.
 */
export function readableBackupError(raw: unknown): string {
  const compact = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!compact) return 'تعذّر إنشاء النسخة الاحتياطية';

  if (/storageQuotaExceeded|do not have storage quota/i.test(compact)) {
    return 'فشل رفع النسخة إلى Google Drive: حساب الخدمة بلا مساحة تخزين. '
      + 'ضع المجلد داخل Shared Drive وأضف حساب الخدمة كعضو فيه، أو ارفع بحساب مستخدم حقيقي.';
  }

  if (/insufficientFilePermissions|does not have sufficient permissions/i.test(compact)) {
    return 'فشل رفع النسخة إلى Google Drive: حساب الخدمة لا يملك صلاحية الكتابة في المجلد المحدد.';
  }

  if (/invalid_grant|Invalid Credentials|invalid_client/i.test(compact)) {
    return 'فشل رفع النسخة إلى Google Drive: بيانات اعتماد Google غير صالحة.';
  }

  if (/File not found|notFound/i.test(compact)) {
    return 'فشل رفع النسخة إلى Google Drive: المجلد المحدد غير موجود أو غير مشترك مع حساب الخدمة.';
  }

  if (/Google Drive/i.test(compact)) {
    const message = /"message"\s*:\s*"([^"]+)"/.exec(compact)?.[1];
    return message
      ? `فشل رفع النسخة إلى Google Drive: ${truncate(message, 140)}`
      : 'فشل رفع النسخة الاحتياطية إلى Google Drive.';
  }

  return truncate(compact);
}

/** حالة HTTP للخطأ: 0 يعني فشل نقل (لم يصل الطلب إلى الدالة). */
function functionStatus(error: unknown): number {
  const context = (error as { context?: { status?: unknown } } | null)?.context;
  const status = context?.status;
  return typeof status === 'number' ? status : 0;
}

/** جسم استجابة الخطأ إن أمكن قراءته، وإلا null. */
async function functionBody(error: unknown): Promise<BackupResponse | null> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!context || typeof (context as Response).clone !== 'function') return null;

  const response = context as Response;
  try {
    return (await response.clone().json()) as BackupResponse;
  } catch {
    try {
      const text = await response.clone().text();
      return text ? { error: text } : null;
    } catch {
      return null;
    }
  }
}

/** رسالة الخطأ العربية لحالة فشل الاستدعاء. */
async function invokeErrorMessage(error: unknown): Promise<string> {
  const status = functionStatus(error);

  // فشل النقل (لا توجد استجابة أصلاً).
  if (status === 0) return 'تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت وحاول مرة أخرى';

  // حالات المصادقة/الصلاحية تُعرض بنص التطبيق لأن الرد عليها يأتي إنجليزياً.
  if (status === 401) return 'انتهت صلاحية الجلسة. سجّل الدخول مرة أخرى ثم أعد المحاولة';
  if (status === 403) return 'ليس لديك صلاحية إنشاء نسخة احتياطية. هذه العملية متاحة للمديرين فقط';
  if (status === 404) return 'خدمة النسخ الاحتياطي غير متاحة حالياً';

  // أي حالة أخرى: نص الدالة أوضح من رسالة عامة (مثل فشل الرفع إلى Drive).
  const body = await functionBody(error);
  const raw = typeof body?.error === 'string'
    ? body.error
    : typeof body?.message === 'string'
      ? body.message
      : '';
  if (raw.trim()) return readableBackupError(raw);

  return status >= 500
    ? 'حدث خطأ في الخادم. حاول مرة أخرى لاحقاً'
    : 'تعذّر إنشاء النسخة الاحتياطية';
}

/** جدول الإعدادات المركزي على الخادم ومفتاحه الخاص بوقت آخر نسخة ناجحة. */
const METADATA_TABLE = 'system_metadata';
const LAST_BACKUP_METADATA_KEY = 'last_backup_time';

/** يحوّل قيمة وقت قادمة من القاعدة إلى Date، أو null إن لم تصلح. */
function parseTimestamp(raw: unknown): Date | null {
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Date.parse(raw.trim());
    if (Number.isFinite(parsed)) return new Date(parsed);
  }
  return null;
}

/**
 * يجلب «آخر نسخة احتياطية» المركزية من جدول system_metadata — القيمة نفسها
 * التي يراها كل المديرين على كل الأجهزة، ويكتبها الخادم بعد كل نسخة ناجحة
 * (يدوية أو أسبوعية مجدولة). تُرجع null عند غياب الصف أو تعذّر القراءة
 * (فشل شبكة أو حجب RLS) حتى لا تكسر الصفحة.
 */
export async function fetchLastBackupAt(): Promise<Date | null> {
  try {
    const { data, error } = await supabase
      .from(METADATA_TABLE)
      .select('value, updated_at')
      .eq('key', LAST_BACKUP_METADATA_KEY)
      .maybeSingle();
    if (error || !data) return null;

    const row = data as { value?: unknown; updated_at?: unknown };
    // value يحمل تاريخ آخر نسخة؛ وإن تعذّر قراءته فـ updated_at تقريب كافٍ.
    return parseTimestamp(row.value) ?? parseTimestamp(row.updated_at);
  } catch {
    return null;
  }
}

/** تاريخ آخر نسخة ناجحة في ذاكرة هذا المتصفح (احتياط عند تعذّر قراءة الخادم). */
export function readLocalLastBackupAt(userId: string): Date | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(lastBackupKey(userId));
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

/** يحفظ تاريخ آخر نسخة ناجحة في ذاكرة المتصفح (يُستبدل في كل نجاح). */
export function writeLastBackupAt(userId: string, at: Date): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(lastBackupKey(userId), at.toISOString());
  } catch {
    // التخزين المحلي غير متاح — لا يؤثر على نجاح النسخة نفسها
  }
}

// ─────────────── نمط المهمة: بدء فوري + استطلاع حالة ───────────────

/** مراحل مهمة النسخ كما يبلغ عنها الخادم. */
export type BackupJobPhase = 'pending' | 'running' | 'completed' | 'failed';

/** حالة مهمة نسخ احتياطي كما تعيدها كل دورة استطلاع. */
export interface BackupJob {
  id: string;
  phase: BackupJobPhase;
  /** عدد العناصر (الجداول) التي عالجها الخادم حتى الآن. */
  processedItems: number;
  /** إجمالي العناصر المطلوب معالجتها (0 إن لم يبلّغ عنه الخادم بعد). */
  totalItems: number;
  /** عدد العناصر التي تعذّر رفعها (لا يظهر إلا عند اكتمال المهمة ببعض الأخطاء). */
  failedItems: number;
  /** نص الخطأ من الخادم عند فشل المهمة. */
  error?: string;
}

interface StartJobResponse {
  job_id?: unknown;
  id?: unknown;
  job?: { id?: unknown };
  error?: unknown;
  message?: unknown;
}

interface JobStatusResponse {
  job?: {
    status?: unknown;
    processed_items?: unknown;
    total_items?: unknown;
    failed_items?: unknown;
    error?: unknown;
  };
  error?: unknown;
  message?: unknown;
}

/** يستخرج معرّف المهمة من أشكال الاستجابة المدعومة: job_id، أو id، أو job.id. */
function jobIdFromStartResponse(body: StartJobResponse): string | null {
  const direct = body.job_id ?? body.id ?? body.job?.id;
  return typeof direct === 'string' && direct.trim() ? direct.trim() : null;
}

/** يقرأ عدداً صحيحاً من رقم أو نص، وصفر عند غيابه. */
function intOr(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

/**
 * يحوّل نص الحالة إلى مرحلة معروفة.
 * `completed_with_errors` هي اكتمال ببعض الأخطاء (تُعرض كنسخة ناجحة مع تنبيه بعدد
 * العناصر الفاشلة)، و`in_progress`/`processing` تعني أن المهمة تعمل بالفعل.
 * أي قيمة جديدة غير متوقعة تُعد قيد التشغيل حتى لا تعلق الواجهة.
 */
function jobPhase(raw: unknown): BackupJobPhase {
  switch (raw) {
    case 'pending':
    case 'queued':
    case 'job_pending':
      return 'pending';
    case 'completed':
    case 'success':
    case 'done':
    case 'completed_with_errors':
      return 'completed';
    case 'failed':
    case 'error':
    case 'job_failed':
      return 'failed';
    default:
      return 'running';
  }
}

/**
 * يبدأ مهمة النسخ الاحتياطي على الخادم ويعيد معرّفها فوراً دون انتظار اكتمالها.
 *
 * لا يُرسل `user_id` ولا `role`: الدالة تقرأ الهوية من JWT وتتحقق من كون
 * المستخدم مديراً فعّالاً في `public.profiles` بنفسها.
 * يرمي رسالة عربية عند الفشل، بما فيها غياب الجلسة أو غياب job_id في الرد.
 */
export async function startBackupJob(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw 'يجب تسجيل الدخول أولاً';

  const { data, error } = await supabase.functions.invoke(BACKUP_FUNCTION, {
    body: { action: 'start', source: 'web' },
  });

  if (error) throw await invokeErrorMessage(error);

  const body = (data ?? {}) as StartJobResponse;
  const jobId = jobIdFromStartResponse(body);
  if (!jobId) {
    throw readableBackupError(body.error ?? body.message ?? 'لم يُعد الخادم معرّف المهمة');
  }
  return jobId;
}

/** يقرأ حالة مهمة جارية من الخادم (تُستدعى في كل دورة استطلاع). */
export async function fetchJobStatus(jobId: string): Promise<BackupJob> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw 'يجب تسجيل الدخول أولاً';

  const { data, error } = await supabase.functions.invoke(BACKUP_FUNCTION, {
    body: { action: 'status', job_id: jobId },
  });

  if (error) throw await invokeErrorMessage(error);

  const body = (data ?? {}) as JobStatusResponse;
  const job = body.job && typeof body.job === 'object' ? body.job : {};
  return {
    id: jobId,
    phase: jobPhase(job.status),
    processedItems: intOr(job.processed_items),
    totalItems: intOr(job.total_items),
    failedItems: intOr(job.failed_items),
    error: typeof job.error === 'string' && job.error.trim() ? job.error : undefined,
  };
}
