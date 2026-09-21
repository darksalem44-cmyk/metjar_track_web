'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { resolveImageUrl, uploadImageObject, buildImagePath, isStoredPath } from '@/lib/supabase';
import { Image as ImageIcon, Plus, X, Loader2, Search } from 'lucide-react';
import { Modal } from './modals';

function getExt(name: string): string {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1] : 'jpg';
}

/** صورة مسقطة من مسار تخزين أو رابط مباشر. */
export function ResolvedImage({
  src,
  alt,
  className,
  onLoad,
}: {
  src?: string;
  alt?: string;
  className?: string;
  onLoad?: () => void;
}) {
  const resolved = useImageResolver(src);
  const [failed, setFailed] = useState(false);

  if (!src || !resolved || failed) {
    return (
      <div className={cn('grid place-items-center bg-[var(--surface-variant)]', className)}>
        {resolved === undefined ? (
          <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
        ) : (
          <ImageIcon className="w-6 h-6 text-[var(--text-muted)]" />
        )}
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt ?? ''}
      loading="lazy"
      onLoad={onLoad}
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
}

/** يحوّل أي مسار إلى رابط صورة قابل للعرض. */
export function useImageResolver(src?: string): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    resolveImageUrl(src).then((url) => {
      if (alive) setResolved(url || src);
    });
    return () => {
      alive = false;
    };
  }, [src]);
  return resolved;
}

function Thumb({
  src,
  alt,
  onRemove,
  onOpen,
  uploading,
}: {
  src: string;
  alt?: string;
  onRemove?: () => void;
  onOpen?: () => void;
  uploading?: boolean;
}) {
  return (
    <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface-variant)]">
      <button type="button" onClick={onOpen} className={cn('block w-full h-full', onOpen && 'cursor-zoom-in')}>
        <ResolvedImage src={src} alt={alt} className="w-full h-full" />
      </button>
      {uploading && (
        <div className="absolute inset-0 grid place-items-center bg-black/40">
          <Loader2 className="w-5 h-5 animate-spin text-white" />
        </div>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 end-1 grid place-items-center w-6 h-6 rounded-full bg-black/60 text-white hover:bg-black/80"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function ImagePicker({
  value,
  onChange,
  folder,
  label,
  max = 5,
  className,
  hint,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  folder: string;
  label?: string;
  max?: number;
  className?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      try {
        const entries = Array.from(files);
        const slots = max - value.length;
        for (let i = 0; i < entries.length && i < slots; i++) {
          const file = entries[i];
          const path = buildImagePath(folder, getExt(file.name));
          const done = await uploadImageObject(path, file);
          value.push(done);
        }
        onChange([...value]);
      } catch (e: any) {
        console.error(e);
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [value, onChange, folder, max],
  );

  const canAdd = value.length < max;

  return (
    <div className={cn('space-y-2', className)}>
      {label && <p className="text-[12px] font-semibold text-[var(--text-secondary)]">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {value.map((p) => (
          <Thumb
            key={p}
            src={p}
            onOpen={() => setViewer(p)}
            onRemove={() => onChange(value.filter((x) => x !== p))}
          />
        ))}
        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-24 h-24 rounded-xl border-2 border-dashed border-[var(--border-light)] grid place-items-center text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
          </button>
        )}
      </div>
      {hint && <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Modal open={!!viewer} onClose={() => setViewer(null)} title="الصورة">
        {viewer && (
          <div className="rounded-xl overflow-hidden">
            <ResolvedImage src={viewer} alt="" className="w-full max-h-[70vh] object-contain bg-[var(--surface-variant)]" />
          </div>
        )}
      </Modal>
    </div>
  );
}

export function SingleImagePicker({
  value,
  onChange,
  folder,
  label,
  hint,
}: {
  value?: string;
  onChange: (next?: string) => void;
  folder: string;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState(false);

  const handleFile = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const path = buildImagePath(folder, getExt(file.name));
        const done = await uploadImageObject(path, file);
        onChange(done);
      } catch (e: any) {
        console.error(e);
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [folder, onChange],
  );

  return (
    <div className="space-y-2">
      {label && <p className="text-[12px] font-semibold text-[var(--text-secondary)]">{label}</p>}
      {value ? (
        <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-[var(--border)]">
          <button type="button" onClick={() => setViewer(true)} className="block w-full h-full">
            <ResolvedImage src={value} alt="" className="w-full h-full" />
          </button>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute top-1 end-1 grid place-items-center w-6 h-6 rounded-full bg-black/60 text-white hover:bg-black/80"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-32 h-32 rounded-xl border-2 border-dashed border-[var(--border-light)] grid place-items-center text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors disabled:opacity-50 flex-col gap-1"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
          {!uploading && <span className="text-[11px]">إضافة صورة</span>}
        </button>
      )}
      {hint && <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files)}
      />
      <Modal open={viewer} onClose={() => setViewer(false)} title="الصورة">
        {value && (
          <div className="flex items-center justify-center">
            <ResolvedImage src={value} alt="" className="max-h-[70vh] object-contain rounded-xl" />
          </div>
        )}
      </Modal>
    </div>
  );
}

export function ImageRow({
  value,
  onOpen,
}: {
  value: string[];
  onOpen: (index: number) => void;
}) {
  if (value.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto py-1">
      {value.map((p, i) => (
        <button key={i} type="button" onClick={() => onOpen(i)} className="w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-[var(--border)]">
          <ResolvedImage src={p} alt="" className="w-full h-full" />
        </button>
      ))}
    </div>
  );
}

export { isStoredPath, ImageIcon };