'use client';

import { useState, useEffect } from 'react';
import { supabase, signOut } from '@/lib/supabase';
import { getProfile, subscribeProfile } from '@/lib/data/profiles';
import { toastError } from '@/lib/toast';
import type { Profile } from '@/lib/types';
import AuthPage from '@/components/auth/AuthPage';
import AppShell from '@/components/AppShell';
import { CenteredSpinner } from '@/components/ui/controls';

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<'loading' | 'auth' | 'app'>('loading');

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let disposed = false;

    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setState('auth');
        return;
      }

      const p = await getProfile(session.user.id);
      if (!p) {
        await supabase.auth.signOut();
        setState('auth');
        return;
      }

      if (!p.isActive) {
        await signOut();
        setState('auth');
        return;
      }

      setProfile(p);
      setState('app');

      unsub?.();
      const maybeUnsub = subscribeProfile(p.id, async (updated) => {
        setProfile((prev) => (prev ? { ...prev, fullName: updated.full_name ?? prev.fullName, canEdit: !!updated.can_edit, canDelete: !!updated.can_delete, isActive: updated.is_active !== false } : prev));
        if (updated.is_active === false) {
          toastError('تم تعطيل حسابك من قبل الإدارة');
          await signOut();
          window.location.href = '/';
        }
      });
      if (disposed) {
        maybeUnsub();
        return;
      }
      unsub = maybeUnsub;
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        unsub?.();
        unsub = undefined;
        setProfile(null);
        setState('auth');
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadSession();
      }
    });

    return () => {
      disposed = true;
      unsub?.();
      subscription.unsubscribe();
    };
  }, []);

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-main)]">
        <CenteredSpinner label="جاري التحميل..." />
      </div>
    );
  }

  if (state === 'auth') {
    return <AuthPage />;
  }

  if (!profile) return null;

  return <AppShell profile={profile} />;
}