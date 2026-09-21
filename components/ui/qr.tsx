'use client';

import { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Share2 } from 'lucide-react';
import { Button, Chip } from './controls';
import { CopyButton } from './accountUtils';
import { toastError } from '@/lib/toast';

export function qrUrlFromCommercialRegister(commercialRegister?: string): string {
  if (!commercialRegister) return '';
  return `https://trendsy.com/public/qr/${commercialRegister.replaceAll('/', '-')}`;
}

export function QrDisplay({
  url,
  withActions,
}: {
  url: string;
  withActions?: boolean;
}) {
  const encoded = useMemo(() => url, [url]);

  const download = () => {
    const svg = document.getElementById('store-qr-svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'qr.svg';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'رمز QR المتجر', url });
        return;
      } catch {
        // ignore
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toastError('تم نسخ الرابط');
    } catch {
      toastError('تعذر المشاركة');
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-[200px] h-[200px] p-3 bg-white rounded-2xl border border-[var(--border)]">
        <QRCodeSVG
          id="store-qr-svg"
          value={encoded}
          size={176}
          marginSize={1}
          level="L"
          imageSettings={{
            src: '',
            height: 36,
            width: 36,
            excavate: false,
          }}
        />
      </div>
      <Chip tone="neutral" label="رمز الاستجابة السريعة لمتجرك" />
      {withActions && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <CopyButton text={url} />
          <Button variant="surface" size="sm" onClick={download} icon={<Download className="w-3.5 h-3.5" />}>
            تنزيل
          </Button>
          <Button variant="surface" size="sm" onClick={share} icon={<Share2 className="w-3.5 h-3.5" />}>
            مشاركة
          </Button>
        </div>
      )}
    </div>
  );
}