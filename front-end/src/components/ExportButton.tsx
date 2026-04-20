import { useEffect, useRef, useState } from 'react';
import { useSession } from '../store/session';
import { buildExportJSON, buildExportTxt, downloadFile } from '../lib/export';

export default function ExportButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const doExport = (format: 'json' | 'txt') => {
    const { transcript, batches, chat, pushToast } = useSession.getState();
    if (!transcript.length && !batches.length && !chat.length) {
      pushToast('Nothing to export yet.', 'info');
      setOpen(false);
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (format === 'json') {
      downloadFile(
        `twinmind-session-${stamp}.json`,
        buildExportJSON(transcript, batches, chat),
        'application/json',
      );
    } else {
      downloadFile(
        `twinmind-session-${stamp}.txt`,
        buildExportTxt(transcript, batches, chat),
        'text/plain',
      );
    }
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="pill px-4 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-white"
      >
        Export ▾
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-44 overflow-hidden rounded-xl border border-mist-200 bg-white shadow-card">
          <button
            onClick={() => doExport('json')}
            className="block w-full px-4 py-2.5 text-left text-sm text-brand-900 hover:bg-mist-50"
          >
            Download JSON
          </button>
          <button
            onClick={() => doExport('txt')}
            className="block w-full px-4 py-2.5 text-left text-sm text-brand-900 hover:bg-mist-50"
          >
            Download TXT
          </button>
        </div>
      )}
    </div>
  );
}
