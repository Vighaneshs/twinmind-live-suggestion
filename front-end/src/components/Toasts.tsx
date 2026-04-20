import { useSession } from '../store/session';

const KIND_CLS: Record<string, string> = {
  info: 'bg-white text-brand-900 border-mist-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

export default function Toasts() {
  const toasts = useSession((s) => s.toasts);
  const dismiss = useSession((s) => s.dismissToast);
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-2.5 text-sm shadow-card ${
            KIND_CLS[t.kind] ?? KIND_CLS.info
          }`}
        >
          <span className="max-w-xs">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="text-xs opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
