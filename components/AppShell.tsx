'use client';

import { useEffect, useState } from 'react';
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
import AlertsPage from '@/components/notifications/AlertsPage';
import AlertsArchivePage from '@/components/notifications/AlertsArchivePage';
import HomePage from '@/components/HomePage';
import StoresList from '@/components/stores/StoresList';
import StoreForm from '@/components/stores/StoreForm';
import StoreDetails from '@/components/stores/StoreDetails';
import StoreQrPage from '@/components/stores/StoreQrPage';
import BranchesPage from '@/components/branches/BranchesPage';
import BranchForm from '@/components/branches/BranchForm';
import BranchDetails from '@/components/branches/BranchDetails';
import ProductsPage from '@/components/products/ProductsPage';
import ProductForm from '@/components/products/ProductForm';
import ProductDetails from '@/components/products/ProductDetails';
import AccountListPage from '@/components/accounts/AccountListPage';
import AdminAccountsPage from '@/components/accounts/AdminAccountsPage';
import ActivitiesList from '@/components/activities/ActivitiesList';
import ActivityTrendsPage from '@/components/activities/ActivityTrendsPage';
import UserReport from '@/components/activities/UserReport';
import ProfilePage from '@/components/profile/ProfilePage';
import BackupPage from '@/components/backup/BackupPage';

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
  const theme = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const view = router.stack[router.stack.length - 1];

  useEffect(() => {
    setDrawerOpen(false);
  }, [view]);

  const go = (v: View) => {
    router.reset(v);
  };

  const logout = async () => {
    if (!window.confirm('هل أنت متأكد من تسجيل الخروج؟')) return;
    await signOut();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[var(--surface-main)]">
      <Sidebar profile={profile} view={view} go={go} logout={logout} />
      {drawerOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[280px] bg-[var(--surface)] border-l border-[var(--border)] overflow-y-auto">
            <SidebarContent profile={profile} view={view} go={go} logout={logout} onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pr-[264px]">
        <MobileHeader profile={profile} onMenu={() => setDrawerOpen(true)} />
        <main className="px-4 py-4 lg:px-8 lg:py-6 pb-24 lg:pb-8">
          <div key={view.name + JSON.stringify(viewIndex(view))}>
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
    case 'merchant-form':
    case 'activities':
      return view.name === 'activities' ? 'activities' : 'merchants';
    case 'employees':
    case 'employee-form':
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
    <aside className="hidden lg:flex fixed inset-y-0 right-0 w-[264px] flex-col border-l border-[var(--border)] bg-[var(--surface)] z-40">
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
      <div className="flex items-center gap-2 px-4 h-16 border-b border-[var(--border)] shrink-0">
        <img src="/icons/Icon-192.png?v=3" alt="متجر تراك" className="w-9 h-9 rounded-xl shrink-0" />
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-[var(--text)] leading-tight">متجر تراك</p>
          <p className="text-[10px] text-[var(--text-secondary)]">لوحة التحكم</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="mr-auto grid place-items-center w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-variant)]">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => go(item.view)}
            className={cn(
              'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors',
              active === item.key
                ? 'bg-[var(--primary-surface)] text-[var(--primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-variant)] hover:text-[var(--text)]',
            )}
          >
            {item.icon}
            <span className="flex-1 text-start">{item.label}</span>
            {item.key === 'alerts' && unread > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--error)] text-white text-[10px] font-bold grid place-items-center">
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
            'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors',
            active === null && view.name === 'profile'
              ? 'bg-[var(--primary-surface)] text-[var(--primary)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-variant)] hover:text-[var(--text)]',
          )}
        >
          <UserIcon className="w-4.5 h-4.5" />
          <span className="min-w-0 flex-1 truncate">{profile.fullName}</span>
        </button>
        <button
          onClick={theme.toggle}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-variant)] hover:text-[var(--text)] transition-colors"
        >
          {theme.theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          {theme.theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الليلي'}
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
        >
          <LogOut className="w-4.5 h-4.5" />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

function MobileHeader({ profile, onMenu }: { profile: Profile; onMenu: () => void }) {
  const router = useRouter();
  return (
    <header className="lg:hidden sticky top-0 z-50 flex items-center gap-3 px-4 h-14 border-b border-[var(--border)] bg-[var(--surface)]">
      <button onClick={onMenu} className="grid place-items-center w-9 h-9 rounded-xl border border-[var(--border)] text-[var(--text-secondary)]">
        <Menu className="w-4.5 h-4.5" />
      </button>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <img src="/icons/Icon-192.png?v=3" alt="متجر تراك" className="w-7 h-7 rounded-lg shrink-0" />
        <p className="text-[14px] font-bold text-[var(--text)] truncate">متجر تراك</p>
      </div>
      <AlertsBell />
      <button onClick={() => router.reset({ name: 'profile' })} className="grid place-items-center w-9 h-9 rounded-xl border border-[var(--border)] text-[var(--text-secondary)]">
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
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex items-stretch border-t border-[var(--border)] bg-[var(--surface)]">
      {MOBILE_TABS.map((item) => (
        <button
          key={item.key}
          onClick={() => go(item.view)}
          className={cn(
            'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors',
            active === item.key ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)]',
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
    case 'employee-form':
      return <AccountListPage role="employee" />;
    case 'merchants':
    case 'merchant-form':
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