'use client';

import { Volume2, VolumeX, Inbox } from 'lucide-react';
import { useAlerts } from '@/components/notifications/AlertsProvider';
import { playAlertSound } from '@/lib/alert-sound';
import { Toggle } from '@/components/ui/controls';

interface NotificationPrefsCardProps {
  /** عرض مضغوط داخل المودال (بلا هوامش خارجية زائدة) */
  compact?: boolean;
}

function Row({
  icon,
  title,
  hint,
  checked,
  disabled,
  onChange,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="card rounded-[12px] p-3 flex items-start gap-3">
      <span className="grid place-items-center w-8 h-8 rounded-[10px] bg-[var(--primary-surface-light)] text-[var(--primary)] shrink-0">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-[var(--text)]">{title}</p>
        <p className="text-[10.5px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">{hint}</p>
        {children}
      </div>
      <Toggle size="sm" checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}

/**
 * إعدادات الإشعار اللحظي عند وصول تنبيه جديد.
 * معروضة في مودال «قواعد التنبيهات» وفي صفحة الملف الشخصي (للمدير).
 *
 * هذه الإعدادات لا توقف عدّاد الجرس ولا قائمة التنبيهات — تتحكم فقط
 * في هل يصلك تنبيه مرئي/مسموع خارج الصفحة.
 */
export default function NotificationPrefsCard({ compact = false }: NotificationPrefsCardProps) {
  const { settings, saveLive, primeSound } = useAlerts();
  const live = settings.live;

  // معطّل مؤقتاً مع بطاقة إشعار النظام — يُستخدم عند إظهارها مجدداً.
  // لاستعادته: احذف الكومنتين أدناه، وأعد في الأعلى الاستيرادات والحالة:
  //   import { useEffect, useState } من 'react'
  //   import { BellRing } من 'lucide-react'
  //   import { requestSystemPermission, showSystemNotification,
  //            systemNotificationsSupported, systemPermission,
  //            systemPermissionHints, type SystemPermission } من '@/lib/push'
  //   import { toast, toastError } من '@/lib/toast'
  //   import { Button, Toggle } من '@/components/ui/controls'
  //   const [permission, setPermission] = useState<SystemPermission>('unsupported');
  //   useEffect(() => { const f = requestAnimationFrame(() => setPermission(systemPermission()));
  //                    return () => cancelAnimationFrame(f); }, [live.system]);
  //   const supported = systemNotificationsSupported();
  //   const [busy, setBusy] = useState(false);
  /*
  const toggleSystem = async (next: boolean) => {
    setBusy(true);
    try {
      if (!next) {
        saveLive({ system: false });
        toast('تم إيقاف إشعار النظام — عدّاد الجرس ما زال يعمل', 'info');
        return;
      }
      const result = await requestSystemPermission();
      setPermission(result);
      if (result === 'granted') {
        saveLive({ system: true });
        toast('تم تفعيل إشعارات النظام على هذا الجهاز', 'success');
      } else if (result === 'denied') {
        saveLive({ system: false });
        toastError('المتصفح رفض الإشعارات — اسمح بها من إعدادات الموقع في المتصفح');
      } else if (result === 'unsupported') {
        saveLive({ system: false });
        toastError('المتصفح أو الجهاز لا يدعم إشعارات النظام');
      } else {
        saveLive({ system: false });
        toast('لم يُمنح الإذن بعد', 'info');
      }
    } finally {
      setBusy(false);
    }
  };
  */

  const toggleSound = (next: boolean) => {
    if (next) {
      // فتح سياق الصوت يجب أن يحدث داخل نقرة المستخدم وإلا رفضه المتصفح.
      // primeSound هي unlockAlertSound نفسها وتصل عبر سياق التنبيهات.
      primeSound();
      saveLive({ sound: true });
      // نغمة تجريبية تتأكد للمستخدم أن الصوت يعمل فعلاً قبل أن يخرج من الإعدادات
      playAlertSound('info');
    } else {
      saveLive({ sound: false });
    }
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
      {/*
        بطاقة إشعار النظام مخفية من الواجهة بطلب من المستخدم.
        الكود خلفها يعمل ويبقى فعّالاً: `live.system` ما زال محفوظاً في التخزين
        ومحكوماً في announceAlerts، فالإشعارات تُرسل تلقائياً بلا مفتاح ظاهر.
        لإظهارها لاحقاً: اتبع التعليمات أعلى toggleSystem.
      */}
      {/* <Row
        icon={<BellRing className="w-4 h-4" />}
        title="إشعار النظام عند كل تنبيه"
        hint={
          supported
            ? systemPermissionHints[permission]
            : systemPermissionHints.unsupported
        }
        checked={live.system && permission === 'granted'}
        disabled={!supported || busy}
        onChange={(next) => void toggleSystem(next)}
      >
        {permission === 'denied' && supported && (
          <p className="text-[10.5px] text-[var(--error)] mt-1.5">
            الإذن مرفوض للموقع — غيّره من أيقونة القفل في شريط العنوان.
          </p>
        )}
        {permission === 'granted' && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => {
              primeSound();
              void showTestNotification();
            }}
          >
            <Inbox className="w-4 h-4" />
            تجربة الإشعار
          </Button>
        )}
      </Row> */}

      <Row
        icon={<Inbox className="w-4 h-4" />}
        title="تنبيه داخل التطبيق"
        hint="شريط صغير يظهر أعلى الشاشة عند وصول حدث حساس"
        checked={live.toast}
        onChange={(next) => saveLive({ toast: next })}
      />

      <Row
        icon={live.sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        title="صوت التنبيه"
        hint="نغمة قصيرة تختلف حسب الخطورة، واهتزاز على الجوال"
        checked={live.sound}
        onChange={toggleSound}
      />

      {/* <p className="text-[10.5px] text-[var(--text-muted)] leading-relaxed px-1">
        هذه الإعدادات محفوظة في هذا المتصفح فقط، ولا توقف عدّاد الجرس ولا تخفي التنبيهات.
      </p> */}
    </div>
  );
}

/** إشعار نظام تجريبي للتحقق من أن الإذن يعمل فعلاً. معطّل مع البطاقة أعلاه. */
/*
async function showTestNotification(): Promise<void> {
  const shown = await showSystemNotification({
    title: 'تجربة إشعار النظام',
    body: 'هكذا سيصلك تنبيه عند كل حدث حساس جديد.',
    tag: 'mt-alert-test',
    url: '/alerts',
  });
  if (shown) toast('تم إرسال الإشعار التجريبي', 'success');
  else toastError('تعذّر عرض الإشعار — تأكد من سماح المتصفح بالإشعارات');
}
*/
