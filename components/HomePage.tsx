'use client';

import { useState } from 'react';
import { useRouter } from '@/components/RouterContext';
import type { Profile } from '@/lib/types';
import { roleLabels } from '@/lib/constants';
import {
  Store,
  Plus,
  Info,
  BookOpen,
  Check,
  Users,
  Building2,
  ShoppingBag,
  KeyRound,
  BarChart3,
  X,
} from 'lucide-react';
import { Avatar, Chip } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modals';

export default function HomePage({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [showTutorial, setShowTutorial] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const isManager = profile.role === 'manager';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={profile.fullName} size={52} />
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold text-[var(--text)]">مرحباً، {profile.fullName}</h1>
          <div className="mt-1">
            <Chip tone="primary" label={roleLabels[profile.role]} />
          </div>
        </div>
      </div>

      {isManager ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickCard
            icon={<Building2 className="w-5 h-5" />}
            title="المتاجر"
            subtitle="استعراض وإدارة جميع المتاجر"
            onClick={() => router.push({ name: 'stores-list' })}
          />
          <QuickCard
            icon={<Users className="w-5 h-5" />}
            title="التجار"
            subtitle="إدارة حسابات التجار والصلاحيات"
            onClick={() => router.push({ name: 'merchants' })}
          />
          <QuickCard
            icon={<ShoppingBag className="w-5 h-5" />}
            title="الموظفون"
            subtitle="إدارة حسابات الموظفين"
            onClick={() => router.push({ name: 'employees' })}
          />
          <QuickCard
            icon={<KeyRound className="w-5 h-5" />}
            title="إدارة الحسابات"
            subtitle="إعادة تعيين كلمات المرور"
            onClick={() => router.push({ name: 'accounts' })}
          />
          <QuickCard
            icon={<BarChart3 className="w-5 h-5" />}
            title="أنشطة التجار"
            subtitle="متابعة سجل نشاطات التجار"
            onClick={() => router.push({ name: 'activities', type: 'merchants' })}
          />
          <QuickCard
            icon={<BarChart3 className="w-5 h-5" />}
            title="أنشطة الموظفين"
            subtitle="متابعة سجل نشاطات الموظفين"
            onClick={() => router.push({ name: 'activities', type: 'employees' })}
          />
          <QuickCard
            icon={<Store className="w-5 h-5" />}
            title="لوحة المتاجر المباشرة"
            subtitle="عرض قائمة المتاجر والبحث"
            onClick={() => router.push({ name: 'stores-list' })}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickCard
            icon={<Store className="w-5 h-5" />}
            title={profile.role === 'merchant' ? 'متاجري' : 'استعراض المتاجر'}
            subtitle="عرض وإدارة المتاجر"
            onClick={() => router.push({ name: 'stores-list' })}
          />
          {profile.canEdit || profile.role === 'merchant' ? (
            <QuickCard
              icon={<Plus className="w-5 h-5" />}
              title="إضافة متجر"
              subtitle="إنشاء متجر جديد"
              onClick={() => router.push({ name: 'store-form' })}
            />
          ) : (
            <QuickCard
              icon={<Info className="w-5 h-5" />}
              title="شرح الاستخدام"
              subtitle="كيفية استخدام التطبيق"
              onClick={() => setShowTutorial(true)}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => setShowTutorial(true)}
          className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-start hover:border-[var(--primary-light)] transition-colors"
        >
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-[var(--purple-light)] text-[var(--purple)]">
            <BookOpen className="w-5 h-5" />
          </span>
          <span>
            <span className="block text-[14px] font-bold text-[var(--text)]">شرح الاستخدام</span>
            <span className="block text-[12px] text-[var(--text-secondary)]">تعلّم الخطوات الأساسية</span>
          </span>
        </button>
        <button
          onClick={() => setShowAbout(true)}
          className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-start hover:border-[var(--primary-light)] transition-colors"
        >
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-[var(--accent-surface)] text-[var(--accent)]">
            <Info className="w-5 h-5" />
          </span>
          <span>
            <span className="block text-[14px] font-bold text-[var(--text)]">عن متجر تراك</span>
            <span className="block text-[12px] text-[var(--text-secondary)]">معلومات عن التطبيق</span>
          </span>
        </button>
      </div>

      {showTutorial && (
        <Modal open onClose={() => setShowTutorial(false)} title="شرح الاستخدام">
          <div className="space-y-4">
            {tutorialSteps.map((s, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
                <span className="grid place-items-center w-7 h-7 rounded-full bg-[var(--primary-surface)] text-[var(--primary)] text-[13px] font-bold shrink-0">
                  {i + 1}
                </span>
                <div>
                  <p className="text-[13px] font-bold text-[var(--text)]">{s.title}</p>
                  <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mt-0.5">{s.body}</p>
                </div>
              </div>
            ))}
            <button
              onClick={() => setShowTutorial(false)}
              className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-[13px] font-semibold flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              فهمت، شكراً
            </button>
          </div>
        </Modal>
      )}

      {showAbout && (
        <Modal open onClose={() => setShowAbout(false)} title="عن متجر تراك">
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
            متجر تراك منصة سورية تهدف إلى تقديم حل شامل لإدارة المتاجر والفروع والمنتجات، مع إمكانية تتبع
            نشاطات أصحاب المتاجر والموظفين وإدارة حساباتهم وصلاحياتهم بكل سهولة.
          </p>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-[var(--primary-surface)] text-[var(--primary)]">
              <Store className="w-5 h-5" />
            </span>
            <div>
              <p className="text-[13px] font-bold text-[var(--text)]">النسخة</p>
              <p className="text-[12px] text-[var(--text-secondary)]">متجر تراك — الويب</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function QuickCard({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-start hover:border-[var(--primary-light)] hover:shadow-sm transition-all"
    >
      <span className="grid place-items-center w-10 h-10 rounded-xl bg-[var(--primary-surface-light)] text-[var(--primary)] shrink-0">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-bold text-[var(--text)]">{title}</span>
        <span className="block text-[12px] text-[var(--text-secondary)] truncate">{subtitle}</span>
      </span>
    </button>
  );
}

const tutorialSteps = [
  {
    title: 'إضافة متجر جديد',
    body: 'من قائمة المتاجر اضغط على «إضافة متجر» واملأ بيانات المتجر: الاسم، النشاط التجاري، الهاتف، العنوان، وموقع المتجر على الخريطة.',
  },
  {
    title: 'تعبئة بيانات المتجر',
    body: 'يمكنك إضافة الفئة (نشاط المتجر)، السجل التجاري، ساعات العمل، لافتة المتجر، صور إضافية، محافظ الدفع (شام كاش/بيميرا)، وأي بيانات مخصصة.',
  },
  {
    title: 'إضافة فروع',
    body: 'افتح المتجر ثم انتقل إلى تبويب «الفروع» وأضف فرعاً جديداً باسم ورمز وموقع، أو عدّل الفروع الموجودة.',
  },
  {
    title: 'إضافة منتجات',
    body: 'افتح المتجر أو الفرع ثم انتقل إلى تبويب «المنتجات» لإضافة منتجات جديدة مع الصور والسعر والعملة.',
  },
  {
    title: 'مشاركة رمز QR',
    body: 'من صفحة المتجر يمكنك فتح رمز الاستجابة السريعة ومشاركته مع عملائك للوصول المباشر إلى بيانات متجرك.',
  },
];