'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/components/RouterContext';
import type { Profile } from '@/lib/types';
import { roleLabels } from '@/lib/constants';
import { countAllStores, fetchStores } from '@/lib/data/stores';
import { countAllProducts } from '@/lib/data/products';
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
  ChevronLeft,
} from 'lucide-react';
import { Avatar, Chip } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modals';

export default function HomePage({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [showTutorial, setShowTutorial] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const isManager = profile.role === 'manager';
  const isMerchant = profile.role === 'merchant';

  // الإجماليات الكلية للمتاجر والمنتجات — تُعرض في صفحة الترحيب للجميع
  const [totals, setTotals] = useState<{ stores: number | null; products: number | null }>({ stores: null, products: null });
  /** عدد متاجر التاجر ومعرّف متجره — لإخفاء "إضافة متجر" فور امتلاكه متجره الواحد */
  const [ownStoreCount, setOwnStoreCount] = useState<number | null>(null);
  const [ownStoreId, setOwnStoreId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let ownIds: string[] = [];
        const [s, p] = await Promise.all([
          countAllStores({ createdBy: isMerchant ? profile.id : undefined }),
          (async () => {
            ownIds = isMerchant ? await fetchOwnStoreIds(profile.id) : [];
            return countAllProducts({ storeIds: isMerchant ? ownIds : undefined });
          })(),
        ]);
        if (cancelled) return;
        setTotals({ stores: s, products: p });
        if (isMerchant) {
          setOwnStoreCount(s);
          setOwnStoreId(ownIds[0] ?? null);
        }
      } catch {
        if (!cancelled) setTotals({ stores: null, products: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isManager, isMerchant, profile.id]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="anim-enter relative overflow-hidden rounded-[20px] border border-[var(--primary)]/18 bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] flex items-center gap-4">
        <div
          className="absolute inset-0 opacity-70 [background-image:radial-gradient(420px_180px_at_92%_-20%,var(--primary-surface),transparent_70%)]"
          aria-hidden="true"
        />
        <div className="relative shrink-0">
          <Avatar name={profile.fullName} size={52} />
        </div>
        <div className="relative min-w-0">
          <h1 className="text-[19px] font-bold tracking-[-0.01em] text-[var(--text)]">مرحباً، {profile.fullName}</h1>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <Chip tone="primary" label={roleLabels[profile.role]} />
            {totals.stores === null ? (
              <span className="skeleton h-[22px] w-20 rounded-full" aria-hidden="true" />
            ) : (
              <Chip tone="accent" label={`المتاجر: ${totals.stores}`} />
            )}
            {totals.products === null ? (
              <span className="skeleton h-[22px] w-24 rounded-full" aria-hidden="true" />
            ) : (
              <Chip tone="purple" label={`المنتجات: ${totals.products}`} />
            )}
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
          {/* إنشاء المتاجر متاح للموظف دون صلاحية تعديل (كما في الموبايل)،
              أما التاجر فيُنشئ متجره الواحد فقط ثم تُستبدل البطاقة بإدارة الفروع */}
          {(!isMerchant || ownStoreCount === 0) && (
            <QuickCard
              icon={<Plus className="w-5 h-5" />}
              title="إضافة متجر"
              subtitle="إنشاء متجر جديد"
              onClick={() => router.push({ name: 'store-form' })}
            />
          )}
          {isMerchant && ownStoreCount !== null && ownStoreCount > 0 && ownStoreId && (
            <QuickCard
              icon={<Building2 className="w-5 h-5" />}
              title="إضافة فرع"
              subtitle="إضافة فرع لمتجرك"
              onClick={() => router.push({ name: 'branches', storeId: ownStoreId })}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => setShowTutorial(true)}
          className="card card-hover anim-enter group flex items-center gap-3 p-4 text-start"
        >
          <span className="grid place-items-center w-10 h-10 rounded-[12px] bg-[var(--purple-light)] text-[var(--purple)] border border-[var(--purple)]/20 shrink-0 transition-transform duration-[var(--dur-2)] ease-[var(--ease-spring)] group-hover:scale-105">
            <BookOpen className="w-5 h-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold text-[var(--text)]">شرح الاستخدام</span>
            <span className="block text-[12px] text-[var(--text-secondary)]">تعلّم الخطوات الأساسية</span>
          </span>
        </button>
        <button
          onClick={() => setShowAbout(true)}
          className="card card-hover anim-enter group flex items-center gap-3 p-4 text-start"
        >
          <span className="grid place-items-center w-10 h-10 rounded-[12px] bg-[var(--accent-surface)] text-[var(--accent)] border border-[var(--accent)]/20 shrink-0 transition-transform duration-[var(--dur-2)] ease-[var(--ease-spring)] group-hover:scale-105">
            <Info className="w-5 h-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold text-[var(--text)]">عن متجر تراك</span>
            <span className="block text-[12px] text-[var(--text-secondary)]">معلومات عن التطبيق</span>
          </span>
        </button>
      </div>

      {showTutorial && (
        <Modal open onClose={() => setShowTutorial(false)} title="شرح الاستخدام">
          <div className="space-y-4">
            {tutorialSteps.map((s, i) => (
              <div key={i} className="anim-enter flex items-start gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--input)] p-3.5">
                <span className="grid place-items-center w-7 h-7 rounded-full bg-[image:var(--primary-gradient)] text-[var(--on-primary)] text-[13px] font-bold shrink-0 tnum">
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
              className="btn-brand w-full py-2.5 rounded-[12px] text-[13px] font-semibold flex items-center justify-center gap-2"
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
          <div className="mt-4 flex items-start gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--input)] p-3.5">
            <span className="grid place-items-center w-9 h-9 rounded-[11px] bg-[var(--primary-surface)] text-[var(--primary-dark)] dark:text-[var(--brand-700)] border border-[var(--primary)]/18">
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

/** معرفات متاجر التاجر — للحد من عدّاد منتجاته بمتاجره فقط */
async function fetchOwnStoreIds(profileId: string): Promise<string[]> {
  const { fetchStores } = await import('@/lib/data/stores');
  const res = await fetchStores({ page: 0, pageSize: 200, createdBy: profileId });
  return res.items.map((s) => s.id);
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
      className="card card-hover anim-enter group flex items-center gap-3 p-4 text-start"
    >
      <span className="grid place-items-center w-10 h-10 rounded-[12px] bg-[var(--primary-surface)] text-[var(--primary-dark)] dark:text-[var(--brand-700)] border border-[var(--primary)]/18 shrink-0 transition-transform duration-[var(--dur-2)] ease-[var(--ease-spring)] group-hover:scale-105">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold text-[var(--text)]">{title}</span>
        <span className="block text-[12px] text-[var(--text-secondary)] truncate">{subtitle}</span>
      </span>
      <ChevronLeft className="w-4 h-4 shrink-0 text-[var(--text-muted)] transition-[transform,color] duration-[var(--dur-2)] ease-[var(--ease-out)] group-hover:translate-x-[-3px] group-hover:text-[var(--primary)]" aria-hidden="true" />
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