'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { ActivityActorRole } from '@/lib/types';

export type View =
  | { name: 'home' }
  | { name: 'stores-list' }
  | { name: 'store-details'; storeId: string }
  | { name: 'store-form'; storeId?: string }
  | { name: 'store-qr'; storeId: string }
  | { name: 'branches'; storeId: string }
  | { name: 'branch-form'; storeId: string; branchId?: string }
  | { name: 'branch-details'; storeId: string; branchId: string }
  | {
      name: 'products';
      scope: { type: 'all' } | { type: 'store'; storeId: string } | { type: 'branch'; storeId: string; branchId: string };
    }
  | { name: 'product-form'; storeId: string; productId?: string }
  | { name: 'product-details'; productId: string }
  | { name: 'employees' }
  | { name: 'employee-form' }
  | { name: 'merchants' }
  | { name: 'merchant-form' }
  | { name: 'accounts' }
  | { name: 'activities'; type: 'merchants' | 'employees' }
  | { name: 'user-report'; actorId: string; role: ActivityActorRole; actorName?: string; actorEmail?: string }
  | { name: 'profile' };

export interface RouterContextValue {
  stack: View[];
  push: (view: View) => void;
  pop: () => void;
  replace: (view: View) => void;
  reset: (view: View) => void;
  canPop: boolean;
}

const RouterContext = createContext<RouterContextValue | null>(null);

export function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used within RouterProvider');
  return ctx;
}

export function useRouterOrNull(): RouterContextValue | null {
  return useContext(RouterContext);
}

// ─────────────── تحويل بين View ومسار URL ───────────────

export function viewToPath(view: View): string {
  switch (view.name) {
    case 'home':
      return '/';
    case 'stores-list':
      return '/stores';
    case 'store-form':
      return view.storeId ? `/stores/${view.storeId}/edit` : '/stores/new';
    case 'store-details':
      return `/stores/${view.storeId}`;
    case 'store-qr':
      return `/stores/${view.storeId}/qr`;
    case 'branches':
      return `/stores/${view.storeId}/branches`;
    case 'branch-form':
      return view.branchId
        ? `/stores/${view.storeId}/branches/${view.branchId}/edit`
        : `/stores/${view.storeId}/branches/new`;
    case 'branch-details':
      return `/stores/${view.storeId}/branches/${view.branchId}`;
    case 'products':
      if (view.scope.type === 'store') return `/products/store/${view.scope.storeId}`;
      if (view.scope.type === 'branch') return `/products/branch/${view.scope.storeId}/${view.scope.branchId}`;
      return '/products';
    case 'product-form':
      return view.productId
        ? `/products/${view.productId}/edit?store=${view.storeId}`
        : `/products/new?store=${view.storeId}`;
    case 'product-details':
      return `/products/${view.productId}`;
    case 'employees':
    case 'employee-form':
      return '/employees';
    case 'merchants':
    case 'merchant-form':
      return '/merchants';
    case 'accounts':
      return '/accounts';
    case 'activities':
      return view.type === 'employees' ? '/activities?type=employees' : '/activities';
    case 'user-report': {
      const params = new URLSearchParams();
      params.set('role', view.role);
      if (view.actorName) params.set('name', view.actorName);
      if (view.actorEmail) params.set('email', view.actorEmail);
      return `/activities/${view.actorId}?${params.toString()}`;
    }
    case 'profile':
      return '/profile';
    default:
      return '/';
  }
}

export function pathToView(pathname: string, search: string): View | null {
  const q = new URLSearchParams(search);
  const s = pathname.split('/').filter(Boolean);
  const at = (i: number) => s[i];

  if (s.length === 0) return { name: 'home' };

  if (s[0] === 'stores') {
    if (s.length === 1) return { name: 'stores-list' };
    if (s.length === 2) return at(1) === 'new' ? { name: 'store-form' } : { name: 'store-details', storeId: at(1)! };
    if (s.length === 3 && at(2) === 'edit') return { name: 'store-form', storeId: at(1)! };
    if (s.length === 3 && at(2) === 'qr') return { name: 'store-qr', storeId: at(1)! };
    if (s.length === 3 && at(2) === 'branches') return { name: 'branches', storeId: at(1)! };
    if (s.length === 4 && at(3) === 'new') return { name: 'branch-form', storeId: at(1)! };
    if (s.length === 4) return { name: 'branch-details', storeId: at(1)!, branchId: at(3)! };
    if (s.length === 5 && at(4) === 'edit') return { name: 'branch-form', storeId: at(1)!, branchId: at(3)! };
    return null;
  }

  if (s[0] === 'products') {
    if (s.length === 1) return { name: 'products', scope: { type: 'all' } };
    if (s.length === 2 && at(1) === 'new') {
      const storeId = q.get('store') ?? '';
      return storeId ? { name: 'product-form', storeId } : null;
    }
    if (s.length === 2) return { name: 'product-details', productId: at(1)! };
    if (s.length === 3 && at(1) === 'store') return { name: 'products', scope: { type: 'store', storeId: at(2)! } };
    if (s.length === 3 && at(2) === 'edit') {
      const storeId = q.get('store') ?? '';
      return storeId ? { name: 'product-form', storeId, productId: at(1)! } : null;
    }
    if (s.length === 4 && at(1) === 'branch') return { name: 'products', scope: { type: 'branch', storeId: at(2)!, branchId: at(3)! } };
    return null;
  }

  if (s[0] === 'employees' && s.length === 1) return { name: 'employees' };
  if (s[0] === 'merchants' && s.length === 1) return { name: 'merchants' };
  if (s[0] === 'accounts' && s.length === 1) return { name: 'accounts' };
  if (s[0] === 'profile' && s.length === 1) return { name: 'profile' };

  if (s[0] === 'activities') {
    if (s.length === 1) {
      return { name: 'activities', type: q.get('type') === 'employees' ? 'employees' : 'merchants' };
    }
    if (s.length === 2) {
      return {
        name: 'user-report',
        actorId: at(1)!,
        role: (q.get('role') ?? 'merchant') as ActivityActorRole,
        actorName: q.get('name') ?? undefined,
        actorEmail: q.get('email') ?? undefined,
      };
    }
    return null;
  }

  return null;
}

// ─────────────── المزوّد مع مزامنة سجل المتصفح ───────────────

const HISTORY_KEY = 'mtStack';

export function RouterProvider({ initial, children }: { initial: View; children: React.ReactNode }) {
  const [stack, setStack] = useState<View[]>(() => {
    if (typeof window === 'undefined') return [initial];
    const v = pathToView(window.location.pathname, window.location.search);
    return [v ?? initial];
  });
  const stackRef = useRef(stack);

  const apply = useCallback((next: View[]) => {
    stackRef.current = next;
    setStack(next);
  }, []);

  const push = useCallback(
    (view: View) => {
      const next = [...stackRef.current, view];
      apply(next);
      window.history.pushState({ [HISTORY_KEY]: next }, '', viewToPath(view));
    },
    [apply],
  );

  const pop = useCallback(() => {
    // زر الرجوع في التطبيق = زر الرجوع في المتصفح (يعيد كامل المكدس السابق)
    if (stackRef.current.length > 1) window.history.back();
  }, []);

  const replace = useCallback(
    (view: View) => {
      const next = [...stackRef.current.slice(0, -1), view];
      apply(next);
      window.history.replaceState({ [HISTORY_KEY]: next }, '', viewToPath(view));
    },
    [apply],
  );

  const reset = useCallback(
    (view: View) => {
      // التنقل من الشريط الجانبي يبدأ مكدساً جديداً كإدخال تاريخ جديد
      const next = [view];
      apply(next);
      window.history.pushState({ [HISTORY_KEY]: next }, '', viewToPath(view));
    },
    [apply],
  );

  useEffect(() => {
    // وسّم الإدخال الحالي بحالة المكدس حتى يجد زر الرجوع/التقدم الحالة دائماً
    if (!window.history.state?.[HISTORY_KEY]) {
      window.history.replaceState({ [HISTORY_KEY]: stackRef.current }, '');
    }

    const onPop = (e: PopStateEvent) => {
      const st = (e.state as Record<string, View[] | undefined> | null)?.[HISTORY_KEY];
      if (Array.isArray(st) && st.length > 0) {
        apply(st);
      } else {
        const v = pathToView(window.location.pathname, window.location.search) ?? { name: 'home' };
        apply([v]);
      }
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [apply]);

  const canPop = stack.length > 1;

  const value = useMemo(
    () => ({ stack, push, pop, replace, reset, canPop }),
    [stack, push, pop, replace, reset, canPop],
  );

  useEffect(() => {
    if (stack.length > 0) window.scrollTo({ top: 0 });
  }, [stack]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}
