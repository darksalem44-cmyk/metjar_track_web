'use client';

import { Button } from '@/components/ui/controls';
import { TextField } from '@/components/ui/fields';
import { SingleImagePicker } from '@/components/ui/images';
import { Wallet } from 'lucide-react';

export function WalletFields({
  walletId,
  qrImage,
  onWalletId,
  onQrImage,
  walletName,
  imageFolder,
}: {
  walletId?: string;
  qrImage?: string;
  onWalletId: (v: string) => void;
  onQrImage: (v?: string) => void;
  walletName: string;
  imageFolder: string;
}) {
  return (
    <div className="card anim-enter space-y-3 p-4">
      <div className="flex items-center gap-2 pb-1 mb-1 border-b border-[var(--border)]">
        <span className="grid place-items-center w-7 h-7 rounded-[10px] bg-[var(--primary-surface)] text-[var(--primary-dark)] dark:text-[var(--accent-text)] border border-[var(--primary)]/18">
          <Wallet className="w-4 h-4" />
        </span>
        <h4 className="text-[14px] font-bold text-[var(--text)]">{walletName}</h4>
      </div>
      <TextField
        label="معرّف المحفظة"
        value={walletId ?? ''}
        onChange={(e) => onWalletId(e.target.value)}
        placeholder="رقم المحفظة / المعرف"
        hint="يُعرض للعملاء للتحويل"
      />
      <SingleImagePicker
        label="صورة رمز QR للمحفظة"
        value={qrImage}
        onChange={onQrImage}
        folder={imageFolder}
        hint="صورة رمز الاستجابة السريعة للمحفظة"
      />
    </div>
  );
}

export function CustomFieldsEditor({
  fields,
  onChange,
}: {
  fields: { label: string; value: string }[];
  onChange: (next: { label: string; value: string }[]) => void;
}) {
  const update = (i: number, key: 'label' | 'value', v: string) => {
    const next = [...fields];
    next[i] = { ...next[i], [key]: v };
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {fields.map((f, i) => (
        <div key={i} className="flex items-start gap-2">
          <TextField
            placeholder="العنوان"
            value={f.label}
            onChange={(e) => update(i, 'label', e.target.value)}
            className="flex-1"
          />
          <TextField
            placeholder="القيمة"
            value={f.value}
            onChange={(e) => update(i, 'value', e.target.value)}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(fields.filter((_, x) => x !== i))}
            className="mt-1 text-[var(--error)]"
          >
            حذف
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...fields, { label: '', value: '' }])}
        className="w-full border-dashed hover:border-solid"
      >
        + إضافة حقل مخصص
      </Button>
    </div>
  );
}