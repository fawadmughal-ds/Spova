'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, X } from 'lucide-react';
import QRCode from 'qrcode';
import type { KycGroup } from '@spova/shared';
import { Spinner } from '@/components/ui';

/**
 * "Mobile Device": a QR code that opens this documents section on the phone, so the client can
 * photograph the document with the phone camera instead of scanning it on the computer.
 */
export function MobileUploadQr({ group, docType, title, onClose }: { group: KycGroup; docType: string; title: string; onClose: () => void }) {
  const [png, setPng] = useState<string | null>(null);
  const [link, setLink] = useState('');

  useEffect(() => {
    const url = `${window.location.origin}/app/documents?group=${encodeURIComponent(group)}&type=${encodeURIComponent(docType)}`;
    setLink(url);
    QRCode.toDataURL(url, { width: 232, margin: 1, color: { dark: '#0b1220', light: '#ffffff' } })
      .then(setPng)
      .catch(() => setPng(null));
  }, [group, docType]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="light-scope fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal aria-label="Upload from a mobile device" className="animate-pop-in relative w-full rounded-t-2xl bg-paper p-6 text-white shadow-lift sm:max-w-sm sm:rounded-2xl">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-ink-400 hover:bg-ink-900 hover:text-white">
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Smartphone className="h-5 w-5 text-brand-500" /> Mobile Device
        </div>
        <p className="mt-1 text-sm text-ink-300">
          Scan the code with your phone. It opens <strong className="text-white">{title}</strong> there, so you can take a photo of the document with the camera. Sign in on the phone if asked.
        </p>
        <div className="mx-auto mt-5 flex h-[248px] w-[248px] items-center justify-center rounded-2xl border border-ink-800 bg-white p-2">
          {png ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={png} alt="QR code" width={232} height={232} />
          ) : (
            <Spinner className="h-5" />
          )}
        </div>
        <p className="mt-4 break-all text-center font-mono text-[11px] text-ink-400">{link}</p>
      </div>
    </div>,
    document.body,
  );
}
