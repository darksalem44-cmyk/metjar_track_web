'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/components/RouterContext';
import { useProfile } from '@/components/ProfileContext';
import { fetchStoreById } from '@/lib/data/stores';
import { toastError } from '@/lib/toast';
import { PageHeader, CenteredSpinner, EmptyState } from '@/components/ui/controls';
import { QrDisplay, qrUrlFromCommercialRegister } from '@/components/ui/qr';
import { FileText, Store } from 'lucide-react';

export default function StoreQrPage({ storeId }: { storeId: string }) {
  const router = useRouter();
  const profile = useProfile();
  const [url, setUrl] = useState('');
  const [storeName, setStoreName] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasRegister, setHasRegister] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await fetchStoreById(storeId);
      if (!s) {
        toastError('تعذر العثور على المتجر');
        router.pop();
        return;
      }
      setStoreName(s.name);
      const u = qrUrlFromCommercialRegister(s.commercialRegister);
      if (u) {
        setUrl(u);
        setHasRegister(true);
      }
      setLoading(false);
    })();
  }, [storeId, router]);

  if (loading) return <CenteredSpinner label="جاري تجهيز رمز QR..." />;

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="رمز QR" subtitle={storeName} onBack={() => router.pop()} />
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 flex flex-col items-center">
        {hasRegister ? (
          <QrDisplay url={url} withActions />
        ) : (
          <EmptyState
            icon={<Store className="w-6 h-6" />}
            title="لا يتوفر رمز QR"
            subtitle="أضف السجل التجاري للمتجر لإنشاء رمز QR خاص به"
            action={
              <button
                onClick={() => router.push({ name: 'store-form', storeId })}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--primary)]"
              >
                <FileText className="w-3.5 h-3.5" />
                تعديل بيانات المتجر
              </button>
            }
          />
        )}
        {hasRegister && (
          <p className="mt-4 text-[12px] text-[var(--text-secondary)] text-center leading-relaxed">
            شارك هذا الرمز مع عملائك للوصول المباشر إلى بيانات متجرك.
          </p>
        )}
      </div>
    </div>
  );
}