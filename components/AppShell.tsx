'use client';

import { useState } from 'react';
import { RouterProvider, useRouter, type View } from '@/components/RouterContext';
import { ProfileProvider, useProfile } from '@/components/ProfileContext';
import { signOut } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import {
  LayoutDashboard,
  Store as StoreIcon,
  ShoppingBag,
  Users,
  KeyRound,
  BarChart3,
  TrendingUp,
  Shield,
  User as UserIcon,
  LogOut,
  Menu,
  Moon,
  Sun,
  X,
  Bell,
  HardDriveDownload,
} from 'lucide-react';
import { AlertsBell, AlertsProvider, useAlerts } from '@/components/notifications/AlertsProvider';
import { canAccessView } from '@/lib/permissions';
import dynamic from 'next/dynamic';

function ScreenFallback() {
  return (
    <div className="anim-fade flex flex-col items-center justify-center gap-3 py-20">
      <span className="w-6 h-6 rounded-full border-2 border-[var(--border-light)] border-t-[var(--primary)] animate-spin" />
      <span className="text-[12px] text-[var(--text-secondary)]">جاري تحميل الشاشة...</span>
    </div>
  );
}

const AlertsPage = dynamic(() => import('@/components/notifications/AlertsPage'), { ssr: false, loading: () => <ScreenFallback /> });
const AlertsArchivePage = dynamic(() => import('@/components/notifications/AlertsArchivePage'), { ssr: false, loading: () => <ScreenFallback /> });
const HomePage = dynamic(() => import('@/components/HomePage'), { ssr: false, loading: () => <ScreenFallback /> });
const StoresList = dynamic(() => import('@/components/stores/StoresList'), { ssr: false, loading: () => <ScreenFallback /> });
const StoreForm = dynamic(() => import('@/components/stores/StoreForm'), { ssr: false, loading: () => <ScreenFallback /> });
const StoreDetails = dynamic(() => import('@/components/stores/StoreDetails'), { ssr: false, loading: () => <ScreenFallback /> });
const StoreQrPage = dynamic(() => import('@/components/stores/StoreQrPage'), { ssr: false, loading: () => <ScreenFallback /> });
const BranchesPage = dynamic(() => import('@/components/branches/BranchesPage'), { ssr: false, loading: () => <ScreenFallback /> });
const BranchForm = dynamic(() => import('@/components/branches/BranchForm'), { ssr: false, loading: () => <ScreenFallback /> });
const BranchDetails = dynamic(() => import('@/components/branches/BranchDetails'), { ssr: false, loading: () => <ScreenFallback /> });
const ProductsPage = dynamic(() => import('@/components/products/ProductsPage'), { ssr: false, loading: () => <ScreenFallback /> });
const ProductForm = dynamic(() => import('@/components/products/ProductForm'), { ssr: false, loading: () => <ScreenFallback /> });
const ProductDetails = dynamic(() => import('@/components/products/ProductDetails'), { ssr: false, loading: () => <ScreenFallback /> });
const AccountListPage = dynamic(() => import('@/components/accounts/AccountListPage'), { ssr: false, loading: () => <ScreenFallback /> });
const AdminAccountsPage = dynamic(() => import('@/components/accounts/AdminAccountsPage'), { ssr: false, loading: () => <ScreenFallback /> });
const ActivitiesList = dynamic(() => import('@/components/activities/ActivitiesList'), { ssr: false, loading: () => <ScreenFallback /> });
const ActivityTrendsPage = dynamic(() => import('@/components/activities/ActivityTrendsPage'), { ssr: false, loading: () => <ScreenFallback /> });
const UserReport = dynamic(() => import('@/components/activities/UserReport'), { ssr: false, loading: () => <ScreenFallback /> });
const ProfilePage = dynamic(() => import('@/components/profile/ProfilePage'), { ssr: false, loading: () => <ScreenFallback /> });
const BackupPage = dynamic(() => import('@/components/backup/BackupPage'), { ssr: false, loading: () => <ScreenFallback /> });

export default function AppShell({ profile }: { profile: Profile }) {
  return (
    <ProfileProvider profile={profile}>
      <RouterProvider initial={{ name: 'home' }}>
        <AlertsProvider>
          <ShellInner />
        </AlertsProvider>
      </RouterProvider>
    </ProfileProvider>
  );
}

function ShellInner() {
  const profile = useProfile();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const view = router.stack[router.stack.length - 1];

  const go = (v: View) => {
    setDrawerOpen(false);
    router.reset(v);
  };

  const logout = async () => {
    if (!window.confirm('هل أنت متأكد من تسجيل الخروج؟')) return;
    await signOut();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen">
      <Sidebar profile={profile} view={view} go={go} logout={logout} />
      {drawerOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="modal-scrim absolute inset-0" onClick={() => setDrawerOpen(false)} />
          <div className="anim-slide absolute inset-y-0 right-0 w-[284px] bg-[var(--surface)] border-s border-[var(--border)] shadow-[var(--shadow-lg)] overflow-y-auto">
            <SidebarContent profile={profile} view={view} go={go} logout={logout} onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pr-[272px]">
        <MobileHeader onMenu={() => setDrawerOpen(true)} />
        <main className="mx-auto max-w-[1500px] px-4 py-5 lg:px-8 lg:py-7 pb-24 lg:pb-10">
          <div key={view.name + viewIndex(view)}>
            <ViewRenderer profile={profile} view={view} />
          </div>
        </main>
        <MobileTabBar view={view} go={go} />
      </div>
    </div>
  );
}

function viewIndex(v: View): string {
  switch (v.name) {
    case 'store-details':
    case 'store-qr':
      return v.storeId;
    case 'store-form':
      return v.storeId ?? '';
    case 'branches':
      return v.storeId;
    case 'branch-form':
    case 'branch-details':
      return v.storeId + (v.branchId ?? '');
    case 'products':
      return v.scope.type + (v.scope.type === 'all' ? '' : v.scope.type === 'store' ? v.scope.storeId : v.scope.storeId + v.scope.branchId);
    case 'product-form':
      return v.storeId + (v.productId ?? '');
    case 'product-details':
      return v.productId;
    case 'user-report':
      return v.actorId;
    default:
      return '';
  }
}

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  view: View;
}

function navItems(profile: Profile): NavItem[] {
  const items: NavItem[] = [
    { key: 'home', label: 'الرئيسية', icon: <LayoutDashboard className="w-4.5 h-4.5" />, view: { name: 'home' } },
    { key: 'stores', label: profile.role === 'merchant' ? 'متاجري' : 'المتاجر', icon: <StoreIcon className="w-4.5 h-4.5" />, view: { name: 'stores-list' } },
    { key: 'products', label: 'المنتجات', icon: <ShoppingBag className="w-4.5 h-4.5" />, view: { name: 'products', scope: { type: 'all' } } },
  ];
  if (profile.role === 'manager') {
    items.push(
      { key: 'merchants', label: 'التجار', icon: <StoreIcon className="w-4.5 h-4.5" />, view: { name: 'merchants' } },
      { key: 'employees', label: 'الموظفون', icon: <Users className="w-4.5 h-4.5" />, view: { name: 'employees' } },
      { key: 'accounts', label: 'إدارة الحسابات', icon: <KeyRound className="w-4.5 h-4.5" />, view: { name: 'accounts' } },
      { key: 'backup', label: 'النسخ الاحتياطي', icon: <HardDriveDownload className="w-4.5 h-4.5" />, view: { name: 'backup' } },
      { key: 'activities', label: 'النشاطات', icon: <BarChart3 className="w-4.5 h-4.5" />, view: { name: 'activities', type: 'merchants' } },
      { key: 'activity-trends', label: 'اتجاهات النشاط', icon: <TrendingUp className="w-4.5 h-4.5" />, view: { name: 'activity-trends' } },
      { key: 'alerts', label: 'التنبيهات', icon: <Bell className="w-4.5 h-4.5" />, view: { name: 'alerts' } },
    );
  }
  return items;
}

function activeKey(view: View): string | null {
  switch (view.name) {
    case 'home':
      return 'home';
    case 'stores-list':
    case 'store-details':
    case 'store-form':
    case 'store-qr':
      return 'stores';
    case 'branches':
    case 'branch-form':
    case 'branch-details':
      return 'stores';
    case 'products':
    case 'product-form':
    case 'product-details':
      return 'products';
    case 'merchants':
    case 'activities':
      return view.name === 'activities' ? 'activities' : 'merchants';
    case 'employees':
      return 'employees';
    case 'accounts':
      return 'accounts';
    case 'alerts':
    case 'alerts-archive':
      return 'alerts';
    case 'activity-trends':
      return 'activity-trends';
    case 'backup':
      return 'backup';
    case 'user-report':
    case 'profile':
      return null;
    default:
      return null;
  }
}

function Sidebar({ profile, view, go, logout }: { profile: Profile; view: View; go: (v: View) => void; logout: () => void }) {
  return (
    <aside className="glass hidden lg:flex fixed inset-y-0 right-0 w-[264px] flex-col border-s border-[var(--border)] z-40">
      <SidebarContent profile={profile} view={view} go={go} logout={logout} />
    </aside>
  );
}

function SidebarContent({
  profile,
  view,
  go,
  logout,
  onClose,
}: {
  profile: Profile;
  view: View;
  go: (v: View) => void;
  logout: () => void;
  onClose?: () => void;
}) {
  const theme = useTheme();
  const items = navItems(profile);
  const active = activeKey(view);
  const { unread } = useAlerts();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-[var(--border)] shrink-0">
        <img
          src="/icons/Icon-192.png?v=3"
          alt="متجر تراك"
          className="w-9 h-9 rounded-[12px] shrink-0 ring-1 ring-[var(--primary)]/18 shadow-[var(--shadow-xs)]"
        />
        <div className="min-w-0">
          <p className="text-[14px] font-bold tracking-[-0.01em] text-[var(--text)] leading-tight">متجر تراك</p>
          <p className="text-[10px] text-[var(--text-secondary)]">لوحة التحكم</p>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="إغلاق القائمة" className="ms-auto grid place-items-center w-8 h-8 rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-variant)] hover:text-[var(--text)] active:scale-90 transition-[background-color,color,transform]">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => go(item.view)}
            aria-current={active === item.key ? 'page' : undefined}
            className={cn(
              'relative w-full flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[13px] font-semibold transition-[background-color,color,box-shadow,transform] duration-[var(--dur-1)] ease-[var(--ease-out)] active:scale-[0.99]',
              active === item.key
                ? 'bg-[var(--primary-surface)] text-[var(--primary-dark)] dark:text-[var(--brand-700)] shadow-[var(--shadow-xs)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-variant)] hover:text-[var(--text)]',
            )}
          >
            {active === item.key && (
              <span
                className="absolute start-[3px] top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-[image:var(--primary-gradient)]"
                aria-hidden="true"
              />
            )}
            <span className={cn('shrink-0 transition-colors', active === item.key && 'text-[var(--primary)]')}>
              {item.icon}
            </span>
            <span className="flex-1 text-start">{item.label}</span>
            {item.key === 'alerts' && unread > 0 && (
              <span className="min-w-[19px] h-[19px] px-1 rounded-full bg-[var(--error)] text-white text-[10px] font-bold grid place-items-center shadow-[var(--shadow-xs)] tnum">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="border-t border-[var(--border)] p-3 space-y-1 shrink-0">
        <button
          onClick={() => go({ name: 'profile' })}
          className={cn(
            'relative w-full flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[13px] font-semibold transition-[background-color,color,box-shadow,transform] duration-[var(--dur-1)] ease-[var(--ease-out)] active:scale-[0.99]',
            view.name === 'profile'
              ? 'bg-[var(--primary-surface)] text-[var(--primary-dark)] dark:text-[var(--brand-700)] shadow-[var(--shadow-xs)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-variant)] hover:text-[var(--text)]',
          )}
        >
          {view.name === 'profile' && (
            <span
              className="absolute start-[3px] top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-[image:var(--primary-gradient)]"
              aria-hidden="true"
            />
          )}
          <UserIcon className="w-4.5 h-4.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{profile.fullName}</span>
        </button>
        <button
          onClick={theme.toggle}
          className="w-full flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[13px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-variant)] hover:text-[var(--text)] active:scale-[0.99] transition-[background-color,color,transform]"
        >
          {theme.theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          {theme.theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الليلي'}
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 active:scale-[0.99] transition-[background-color,color,transform]"
        >
          <LogOut className="w-4.5 h-4.5" />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

function MobileHeader({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  return (
    <header className="glass lg:hidden sticky top-0 z-50 flex items-center gap-3 px-4 h-14 border-b border-[var(--border)]">
      <button onClick={onMenu} aria-label="فتح القائمة" className="grid place-items-center w-9 h-9 rounded-[12px] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-variant)] hover:text-[var(--text)] active:scale-95 transition-[background-color,color,border-color,transform]">
        <Menu className="w-4.5 h-4.5" />
      </button>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <img src="/icons/Icon-192.png?v=3" alt="متجر تراك" className="w-7 h-7 rounded-[9px] shrink-0 ring-1 ring-[var(--primary)]/18" />
        <p className="text-[14px] font-bold tracking-[-0.01em] text-[var(--text)] truncate">متجر تراك</p>
      </div>
      <AlertsBell />
      <button onClick={() => router.reset({ name: 'profile' })} aria-label="الحساب الشخصي" className="grid place-items-center w-9 h-9 rounded-[12px] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-variant)] hover:text-[var(--text)] active:scale-95 transition-[background-color,color,border-color,transform]">
        <UserIcon className="w-4.5 h-4.5" />
      </button>
    </header>
  );
}

const MOBILE_TABS: NavItem[] = [
  { key: 'home', label: 'الرئيسية', icon: <LayoutDashboard className="w-5 h-5" />, view: { name: 'home' } },
  { key: 'stores', label: 'المتاجر', icon: <StoreIcon className="w-5 h-5" />, view: { name: 'stores-list' } },
  { key: 'products', label: 'المنتجات', icon: <ShoppingBag className="w-5 h-5" />, view: { name: 'products', scope: { type: 'all' } } },
];

function MobileTabBar({ view, go }: { view: View; go: (v: View) => void }) {
  const active = activeKey(view);
  return (
    <nav className="glass lg:hidden fixed bottom-0 inset-x-0 z-50 flex items-stretch gap-1 p-2 border-t border-[var(--border)]">
      {MOBILE_TABS.map((item) => (
        <button
          key={item.key}
          onClick={() => go(item.view)}
          aria-current={active === item.key ? 'page' : undefined}
          className={cn(
            'flex-1 flex flex-col items-center gap-1 rounded-[14px] py-2 text-[10px] font-semibold transition-[background-color,color,transform] duration-[var(--dur-1)] ease-[var(--ease-out)] active:scale-[0.97]',
            active === item.key
              ? 'bg-[var(--primary-surface)] text-[var(--primary)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-variant)]',
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function ViewRenderer({ profile, view }: { profile: Profile; view: View }) {
  if (!canAccessView(profile, view)) {
    return (
      <div className="card anim-enter mx-auto max-w-md p-8 text-center">
        <div className="grid place-items-center w-14 h-14 mx-auto rounded-full bg-[var(--warning-surface)] text-[var(--warning)] border border-[var(--warning)]/25">
          <Shield className="w-6 h-6" />
        </div>
        <p className="text-[14px] font-bold text-[var(--text)] mt-4">لا تملك صلاحية الوصول إلى هذه الشاشة</p>
        <p className="text-[12px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">تواصل مع المدير إذا كنت تحتاج هذه الصفحة.</p>
      </div>
    );
  }
  switch (view.name) {
    case 'home':
      return <HomePage profile={profile} />;
    case 'stores-list':
      return <StoresList />;
    case 'store-details':
      return <StoreDetails storeId={view.storeId} />;
    case 'store-form':
      return <StoreForm storeId={view.storeId} />;
    case 'store-qr':
      return <StoreQrPage storeId={view.storeId} />;
    case 'branches':
      return <BranchesPage storeId={view.storeId} />;
    case 'branch-form':
      return <BranchForm storeId={view.storeId} branchId={view.branchId} />;
    case 'branch-details':
      return <BranchDetails storeId={view.storeId} branchId={view.branchId} />;
    case 'products':
      return <ProductsPage scope={view.scope} />;
    case 'product-form':
      return <ProductForm storeId={view.storeId} productId={view.productId} />;
    case 'product-details':
      return <ProductDetails productId={view.productId} />;
    case 'employees':
      return <AccountListPage role="employee" />;
    case 'merchants':
      return <AccountListPage role="merchant" />;
    case 'accounts':
      return <AdminAccountsPage />;
    case 'activities':
      return <ActivitiesList />;
    case 'activity-trends':
      return <ActivityTrendsPage />;
    case 'user-report':
      return <UserReport actorId={view.actorId} role={view.role} actorName={view.actorName ?? ''} actorEmail={view.actorEmail ?? ''} />;
    case 'alerts':
      return <AlertsPage />;
    case 'alerts-archive':
      return <AlertsArchivePage />;
    case 'backup':
      return <BackupPage />;
    case 'profile':
      return <ProfilePage />;
    default:
      return null;
  }
}