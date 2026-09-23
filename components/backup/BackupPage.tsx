'use client';

import { useEffect, useState } from 'react';
import { useProfile } from '@/components/ProfileContext';
import { Button, InfoCard, PageHeader } from '@/components/ui/controls';
import { formatDateTime, relativeTime } from '@/lib/utils';
import { toastError, toastSuccess } from '@/lib/toast';
import {
  fetchLastBackupAt,
  readLocalLastBackupAt,
  runDatabaseBackup,
  writeLastBackupAt,
  type BackupResult,
} from '@/lib/data/backup';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudUpload,
  Database,
  HardDriveDownload,
  History,
  Hourglass,
  ShieldAlert,
} from 'lucide-react';

/**
 * إنشاء نسخة احتياطية يدوية: دالة الحافة تصدّر كل جداول public إلى CSV وترفعها
 * إلى Google Drive. لا يعرض التطبيق محتوى النسخة، بل تاريخ آخر نسخة ناجحة فقط —
 * يُقرأ من الخادم (system_metadata) فتظهر القيمة نفسها لكل المديرين على كل
 * الأجهزة، مع كاش المتصفح كقيمة ابتدائية واحتياط.
 */
export default function BackupPage() {
  const profile = useProfile();
  const [running, setRunning] = useState(false);
  // ذاكرة الجهاز تُقرأ فورًا كقيمة ابتدائية (آمنة على الخادم: null بلا window)،
  // ثم تُفضَّل القيمة المركزية الأحدث من system_metadata.
  const [lastBackupAt, setLastBackupAt] = useState<Date | null>(() => readLocalLastBackupAt(profile.id));
  const [result, setResult] = useState<BackupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const run = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const backup = await runDatabaseBackup();
      setResult(backup);
      setLastBackupAt(backup.completedAt);
      writeLastBackupAt(profile.id, backup.completedAt);
      toastSuccess(
        backup.tablesExported > 0
          ? `تم إنشاء النسخة الاحتياطية ورفعها إلى Google Drive (${backup.tablesExported} جدولًا)`
          : 'تم إنشاء النسخة الاحتياطية ورفعها إلى Google Drive',
      );
    } catch (e: unknown) {
      const message = typeof e === 'string' ? e : 'تعذّر إنشاء النسخة الاحتياطية';
      setError(message);
      toastError(message, 6000);
    } finally {
      setRunning(false);
    }
  };

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

      {result && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--primary-surface)] p-4 mb-5">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-[var(--primary)] mt-0.5" />
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-[var(--text)]">تمت العملية بنجاح</p>
              <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                {result.tablesExported > 0
                  ? `تم تصدير ${result.tablesExported} جدولًا ورفع الملفات إلى Google Drive.`
                  : 'تم رفع ملفات النسخة الاحتياطية إلى Google Drive.'}
              </p>
              {result.files.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {result.files.map((file) => (
                    <div
                      key={file.filename || file.table}
                      className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface)] px-3 py-2"
                    >
                      <span className="text-[12px] font-semibold text-[var(--text)] truncate">
                        {file.table || file.filename}
                      </span>
                      <span className="text-[11px] text-[var(--text-secondary)] shrink-0">
                        {file.rowCount} صف
                      </span>
                    </div>
                  ))}
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
            قد تستغرق العملية بعض الوقت حسب حجم البيانات، أبقِ الصفحة مفتوحة حتى انتهائها.
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
