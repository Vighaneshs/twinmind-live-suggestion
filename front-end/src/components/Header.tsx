import { useSession } from '../store/session';
import ExportButton from './ExportButton';

export default function Header() {
  const setSettingsOpen = useSession((s) => s.setSettingsOpen);
  const hasKey = useSession((s) => Boolean(s.settings.apiKey));
  const recording = useSession((s) => s.recording);

  return (
    <header className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex items-baseline">
          <span className="text-xl font-semibold tracking-tight text-brand-700">
            Vigh
            <span className="mx-0.5 inline-block h-1.5 w-1.5 translate-y-[-2px] rounded-full bg-accent-500" />
            s assistant
          </span>
        </div>
        {recording && (
          <span className="ml-2 flex items-center gap-1.5 rounded-full bg-red-500/90 px-2.5 py-1 text-[11px] font-medium text-white shadow-soft">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Recording
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!hasKey && (
          <span className="rounded-full bg-amber-100/90 px-3 py-1.5 text-[11px] font-medium text-amber-800 shadow-soft">
            No API key set
          </span>
        )}
        <ExportButton />
        <button
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          className="pill px-4 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-white"
        >
          ⚙ Settings
        </button>
      </div>
    </header>
  );
}
