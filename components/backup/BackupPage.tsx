'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfile } from '@/components/ProfileContext';
import { Button, InfoCard, PageHeader } from '@/components/ui/controls';
import { formatDateTime, relativeTime } from '@/lib/utils';
import { toastError, toastSuccess } from '@/lib/toast';
import {
  fetchJobStatus,
  fetchLastBackupAt,
  readLocalLastBackupAt,
  startBackupJob,
  writeLastBackupAt,
  type BackupJob,
} from '@/lib/data/backup';
import {
  AlertTriangle,
  Clock,
  CloudUpload,
  Database,
  HardDriveDownload,
  History,
  Hourglass,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

/** فترة الاستطلاع: كل 5 ثوانٍ كما في نمط المهمة على الخادم. */
const POLL_INTERVAL_MS = 5_000;
/** عدد أخطاء الاستطلاع المتتالية المسموح بها قبل إعلان فشل المتابعة. */
const MAX_CONSECUTIVE_POLL_ERRORS = 3;

/**
 * إنشاء نسخة احتياطية يدوية بنمط المهمة: يبدأ الضغط مهمة على الخادم فورًا،
 * ثم تُستطلع حالتها كل 5 ثوانٍ حتى اكتمالها أو فشلها — مع بطاقة تقدم مباشرة
 * (processed_items / total_items من الخادم). لا يعرض التطبيق محتوى النسخة،
 * بل تاريخ آخر نسخة ناجحة فقط — يُقرأ من الخادم (system_metadata) فتظهر
 * القيمة نفسها لكل المديرين على كل الأجهزة، مع كاش المتصفح كقيمة ابتدائية.
 */
export default function BackupPage() {
  const profile = useProfile();
  const [running, setRunning] = useState(false);
  /** المهمة الجارية: تُحدَّث في كل دورة استطلاع لتحريك شريط التقدم. */
  const [job, setJob] = useState<BackupJob | null>(null);
  // ذاكرة الجهاز تُقرأ فورًا كقيمة ابتدائية (آمنة على الخادم: null بلا window)،
  // ثم تُفضَّل القيمة المركزية الأحدث من system_metadata.
  const [lastBackupAt, setLastBackupAt] = useState<Date | null>(() => readLocalLastBackupAt(profile.id));
  const [error, setError] = useState<string | null>(null);

  // مراجع المؤقتات والعدادات — تُقرأ داخل مؤقّت الاستطلاع دون إعادة جدولته.
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollErrorsRef = useRef(0);
  const pollInFlightRef = useRef(false);
  /** نسخة متزامنة من running داخل الدوال غير المتزامنة (تفادي الإغلاق القديم). */
  const runningRef = useRef(false);
  const profileRef = useRef(profile);

  /** يغيّر حالة التشغيل ونسختها المرجعية معًا. */
  const setRunningState = useCallback((value: boolean) => {
    runningRef.current = value;
    setRunning(value);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // إيقاف مؤقت الاستطلاع عند مغادرة الصفحة — المهمة تكمل على الخادم وحدها.
  useEffect(() => stopPolling, [stopPolling]);

  // نسخة الملف الشخصي تتحدث بعد التصيير (وليس أثناءه) ليلتقطها الاستطلاع.
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  /**
   * حلقة الاستطلاع: كل 5 ثوانٍ تُقرأ حالة المهمة وتُحدَّث الواجهة.
   * حتى 3 أخطاء متتالية (شبكة متقطعة) تُتسامح قبل إعلان الفشل — النجاح
   * يعيد العداد إلى الصفر. الاكتمال يوقف الحلقة ويحفظ تاريخ النسخة؛
   * والفشل يعرض خطأ الخادم كما هو. دورة واحدة فقط في الطريق في كل لحظة.
   */
  const startPolling = useCallback((jobId: string) => {
    stopPolling();
    pollTimerRef.current = setInterval(async () => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        const status = await fetchJobStatus(jobId);
        pollErrorsRef.current = 0;
        setJob(status);

        if (status.phase === 'completed') {
          const at = new Date();
          stopPolling();
          setLastBackupAt(at);
          writeLastBackupAt(profileRef.current.id, at);
          setRunningState(false);
          const message =
            status.failedItems > 0
              ? `تم إنشاء النسخة الاحتياطية ورفعها إلى Google Drive — مع ${status.failedItems} عنصرًا تعذّر رفعه`
              : 'تم إنشاء النسخة الاحتياطية ورفعها إلى Google Drive';
          toastSuccess(message);
        } else if (status.phase === 'failed') {
          stopPolling();
          const message = status.error || 'فشلت المهمة على الخادم';
          setError(message);
          toastError(message, 6000);
          setRunningState(false);
        }
      } catch {
        pollErrorsRef.current += 1;
        if (pollErrorsRef.current >= MAX_CONSECUTIVE_POLL_ERRORS) {
          stopPolling();
          const message = 'انقطع الاتصال بالخادم أثناء متابعة النسخة الاحتياطية';
          setError(message);
          toastError(message, 6000);
          setRunningState(false);
        }
      } finally {
        pollInFlightRef.current = false;
      }
    }, POLL_INTERVAL_MS);
  }, [setRunningState, stopPolling]);

  /** يبدأ المهمة على الخادم ثم يشغّل حلقة الاستطلاع. النقر المزدوج ممنوع. */
  const run = useCallback(() => {
    if (runningRef.current) return;

    const start = async () => {
      setRunningState(true);
      setError(null);
      setJob(null);
      pollErrorsRef.current = 0;

      try {
        const newJobId = await startBackupJob();
        // المهمة بدأت: ننتقل لعرض التقدم فورًا قبل أول استجابة حالة.
        setJob({
          id: newJobId,
          phase: 'running',
          processedItems: 0,
          totalItems: 0,
          failedItems: 0,
        });
        startPolling(newJobId);
      } catch (e: unknown) {
        const message = typeof e === 'string' ? e : 'تعذّر إنشاء النسخة الاحتياطية';
        setError(message);
        toastError(message, 6000);
        setRunningState(false);
      }
    };

    start();
  }, [setRunningState, startPolling]);

  // القيمة المركزية تُجلب بعد أول عرض: الأحدث بينها وبين الكاش يفوز — فقد يكون
  // كاش هذا الجهاز أحدث إن فشل الخادم في كتابة الجدول بعد نسخة سابقة.
  useEffect(() => {
    let cancelled = false;
    fetchLastBackupAt().then((central) => {
      if (cancelled || !central) return;
      setLastBackupAt((prev) =>
        prev && prev.getTime() > central.getTime() ? prev : central,
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (profile.role !== 'manager') {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="النسخ الاحتياطي" />
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--warning)] bg-[var(--warning-surface)] text-[var(--warning)] p-4">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-bold">هذه الصفحة متاحة للمديرين فقط</p>
            <p className="text-[12px] mt-1 opacity-90">
              إنشاء النسخ الاحتياطية يحتاج صلاحية إدارية، وسيُرفض أي طلب من غير المدير على الخادم.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const lastBackupLabel = lastBackupAt
    ? `${formatDateTime(lastBackupAt)} • ${relativeTime(lastBackupAt)}`
    : 'لا توجد نسخة سابقة';

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="النسخ الاحتياطي"
        subtitle="نسخة كاملة من بيانات المتجر إلى Google Drive"
      />

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-[var(--primary-surface-light)] text-[var(--primary)]">
            <CloudUpload className="w-4 h-4" />
          </span>
          <p className="text-[13px] font-bold text-[var(--text)]">ماذا تُنسخ؟</p>
        </div>
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
          تُصدَّر كل جداول قاعدة البيانات العامة والحسابات وسجل النشاطات إلى ملفات CSV، وتُرفع
          مباشرة إلى مجلد Google Drive المحدد. لا يُخزِّن التطبيق أي جزء من هذه البيانات.
        </p>
      </div>

      <div className="mb-5">
        <InfoCard
          icon={<History className="w-4 h-4" />}
          label="آخر نسخة احتياطية"
          value={lastBackupLabel}
        />
      </div>

      <Button
        className="w-full mb-4"
        icon={<HardDriveDownload className="w-4 h-4" />}
        loading={running}
        onClick={run}
      >
        {running ? 'جارٍ إنشاء النسخة الاحتياطية…' : 'إنشاء نسخة احتياطية'}
      </Button>

      {job && running && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--primary-surface)] p-4 mb-5">
          <div className="flex items-start gap-2.5">
            <Loader2 className="w-5 h-5 shrink-0 animate-spin text-[var(--primary)] mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-[var(--text)]">جارٍ إنشاء النسخة الاحتياطية…</p>
              <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                {job.totalItems > 0
                  ? `تمت معالجة ${job.processedItems} من ${job.totalItems} عنصرًا`
                  : 'بانتظار أول تقرير تقدّم من الخادم…'}
              </p>
              {job.totalItems > 0 && (
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-variant)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.round((job.processedItems / job.totalItems) * 100))}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-[var(--error)] bg-[var(--error-surface)] p-4 mb-5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 text-[var(--error)] mt-0.5" />
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-[var(--text)]">
                لم تكتمل النسخة الاحتياطية
              </p>
              <p className="text-[12px] text-[var(--text-secondary)] mt-1 break-words">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-start gap-2.5">
          <Clock className="w-4 h-4 shrink-0 text-[var(--text-muted)] mt-0.5" />
          <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
            النسخ الاحتياطي الأسبوعي يعمل تلقائيًا على الخادم كل يوم أحد — هذا الزر للنسخ الفوري
            عند الحاجة فقط.
          </p>
        </div>
        <div className="flex items-start gap-2.5">
          <Hourglass className="w-4 h-4 shrink-0 text-[var(--text-muted)] mt-0.5" />
          <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
            قد تستغرق العملية بعض الوقت حسب حجم البيانات. تكمل المهمة على الخادم حتى لو أغلقت
            الصفحة، ويظهر التقدم المباشر هنا أثناء وجودك فيها.
          </p>
        </div>
        <div className="flex items-start gap-2.5">
          <Database className="w-4 h-4 shrink-0 text-[var(--text-muted)] mt-0.5" />
          <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
            تاريخ آخر نسخة يُقرأ من الخادم مباشرة  
          </p>
        </div>
      </div>
    </div>
  );
}
