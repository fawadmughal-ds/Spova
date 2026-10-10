'use client';

import { forwardRef, useImperativeHandle, useRef, useState, type DragEvent } from 'react';
import { CloudUpload, FileImage, FileText, TriangleAlert, Upload } from 'lucide-react';
import { KYC_MAX_BYTES, KYC_MIME_TYPES, type KycDocumentDto, type KycGroup } from '@spova/shared';
import { upload } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { friendlyError } from './api-error';

export interface UploadZoneHandle {
  /** opens the native file picker */
  open: () => void;
}

export const fmtBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const ACCEPT = KYC_MIME_TYPES.join(',');

/** Drag-and-drop / click-to-pick upload for one KYC document. Validates type and size before the request leaves the browser. */
export const UploadZone = forwardRef<UploadZoneHandle, { group: KycGroup; docType: string; disabled?: boolean; onUploaded: (doc: KycDocumentDto) => void; className?: string; /** `button`: a plain "Upload" pill instead of the drop zone */ variant?: 'zone' | 'button' }>(
  function UploadZone({ group, docType, disabled, onUploaded, className, variant = 'zone' }, ref) {
    const input = useRef<HTMLInputElement>(null);
    const [drag, setDrag] = useState(false);
    const [busy, setBusy] = useState<{ name: string; size: number; image: boolean } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({ open: () => input.current?.click() }), []);

    const validate = (file: File) => {
      if (!(KYC_MIME_TYPES as readonly string[]).includes(file.type)) return 'Only JPG, PNG, WEBP or PDF files are accepted.';
      if (file.size > KYC_MAX_BYTES) return `This file is ${fmtBytes(file.size)}. The limit is 10 MB.`;
      if (file.size === 0) return 'This file is empty.';
      return null;
    };

    const send = async (file: File) => {
      setError(null);
      const problem = validate(file);
      if (problem) {
        setError(problem);
        return;
      }
      setBusy({ name: file.name, size: file.size, image: file.type.startsWith('image/') });
      try {
        const fd = new FormData();
        fd.set('group', group);
        fd.set('docType', docType);
        fd.set('file', file, file.name);
        const doc = await upload<KycDocumentDto>('/me/kyc/documents', fd);
        onUploaded(doc);
      } catch (e) {
        const f = friendlyError(e);
        setError(f.body ? `${f.title}. ${f.body}` : f.title);
      } finally {
        setBusy(null);
        if (input.current) input.current.value = '';
      }
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDrag(false);
      if (disabled || busy) return;
      const file = e.dataTransfer.files?.[0];
      if (file) void send(file);
    };

    const errorBox = error && (
      <div className="animate-pop-in mt-2 flex items-start gap-2 rounded-xl bg-down/10 px-3 py-2 text-xs text-down ring-1 ring-inset ring-down/30">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{error}</span>
      </div>
    );

    if (variant === 'button') {
      return (
        <div className={className}>
          <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} disabled={disabled} onChange={(e) => e.target.files?.[0] && void send(e.target.files[0])} />
          <button
            type="button"
            disabled={disabled || !!busy}
            onClick={() => input.current?.click()}
            className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-[#0b1220] px-6 text-[15px] font-medium text-[#ffffff] transition-[background-color,transform] hover:bg-[#1c2538] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Spinner className="h-4" tone="current" /> : <Upload className="h-5 w-5" />} {busy ? 'Uploading…' : 'Upload'}
          </button>
          {errorBox}
        </div>
      );
    }

    return (
      <div className={className}>
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled || undefined}
          data-drag={drag ? 'true' : undefined}
          onClick={() => !disabled && !busy && input.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled && !busy) {
              e.preventDefault();
              input.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled && !busy) setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={cn(
            'upload-zone group/zone relative flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-5 text-center transition-[border-color,background-color,transform] duration-300',
            disabled ? 'cursor-not-allowed border-white/[0.08] opacity-60' : 'cursor-pointer border-white/15 hover:border-brand-400/50 hover:bg-brand-400/[0.04]',
            drag && 'scale-[1.01] border-brand-400 bg-brand-400/[0.07]',
            'focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-400/15',
          )}
        >
          <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} disabled={disabled} onChange={(e) => e.target.files?.[0] && void send(e.target.files[0])} />
          {busy ? (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-400/10 text-brand-300 ring-1 ring-inset ring-brand-400/20">
                {busy.image ? <FileImage className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
              </span>
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <Spinner className="h-3.5" /> Uploading {busy.name}
              </div>
              <div className="font-mono text-[11px] text-ink-500">{fmtBytes(busy.size)} · encrypted in transit</div>
              <span className="absolute inset-x-6 bottom-3 h-0.5 overflow-hidden rounded-full bg-white/[0.08]">
                <span className="upload-progress block h-full w-1/3 rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
              </span>
            </>
          ) : (
            <>
              <span
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-500 ease-spring',
                  drag ? 'scale-110 bg-brand-400/15 text-brand-300' : 'bg-white/[0.04] text-ink-400 group-hover/zone:-translate-y-0.5 group-hover/zone:text-brand-300',
                )}
              >
                <CloudUpload className="h-5 w-5" />
              </span>
              <div className="text-sm text-ink-100">
                {drag ? (
                  <span className="font-medium text-brand-300">Drop to upload</span>
                ) : (
                  <>
                    <span className="font-medium text-brand-300">Choose a file</span> or drag it here
                  </>
                )}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">JPG · PNG · WEBP · PDF · max 10 MB</div>
            </>
          )}
        </div>
        {error && (
          <div className="animate-pop-in mt-2 flex items-start gap-2 rounded-xl bg-down/10 px-3 py-2 text-xs text-down ring-1 ring-inset ring-down/30">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  },
);
