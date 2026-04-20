import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, useSession } from '../store/session';
import {
  DEFAULT_CHAT_PROMPT,
  DEFAULT_DETAIL_PROMPT,
  DEFAULT_SUGGESTION_PROMPT,
} from '../lib/prompts';
import { testApiKey } from '../lib/groq';
import type { Settings } from '../lib/types';

type KeyStatus = 'idle' | 'testing' | 'ok' | 'bad';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold text-brand-900">{label}</div>
      {hint && <div className="mb-1.5 text-[11px] text-brand-700/60">{hint}</div>}
      {children}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-mist-200 bg-white px-3 py-2 text-sm text-brand-900 placeholder:text-brand-700/40 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export default function SettingsModal() {
  const open = useSession((s) => s.settingsOpen);
  const setOpen = useSession((s) => s.setSettingsOpen);
  const settings = useSession((s) => s.settings);
  const updateSettings = useSession((s) => s.updateSettings);
  const resetSettings = useSession((s) => s.resetSettings);
  const pushToast = useSession((s) => s.pushToast);

  const [local, setLocal] = useState<Settings>(settings);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>('idle');

  useEffect(() => {
    if (open) {
      setLocal(settings);
      setKeyStatus('idle');
    }
  }, [open, settings]);

  if (!open) return null;

  const patch = (p: Partial<Settings>) => setLocal((l) => ({ ...l, ...p }));

  const save = () => {
    updateSettings(local);
    pushToast('Settings saved.', 'success');
    setOpen(false);
  };

  const test = async () => {
    if (!local.apiKey) return;
    setKeyStatus('testing');
    try {
      const ok = await testApiKey(local.apiKey);
      setKeyStatus(ok ? 'ok' : 'bad');
    } catch {
      setKeyStatus('bad');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-mist-200 bg-white shadow-card">
        <header className="flex items-center justify-between border-b border-mist-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-brand-900">Settings</h2>
            <p className="text-[11px] text-brand-700/60">
              Stored in your browser. Nothing sent to us.
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md px-2 py-1 text-brand-700/60 hover:bg-mist-50 hover:text-brand-900"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <Field
            label="Groq API key"
            hint="Your key is kept only in this browser's localStorage."
          >
            <div className="flex gap-2">
              <input
                type="password"
                value={local.apiKey}
                onChange={(e) => {
                  patch({ apiKey: e.target.value });
                  setKeyStatus('idle');
                }}
                placeholder="gsk_…"
                className={inputCls + ' flex-1'}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                onClick={() => void test()}
                disabled={!local.apiKey || keyStatus === 'testing'}
                className="rounded-lg border border-mist-200 bg-white px-3 py-2 text-sm font-medium text-brand-700 transition hover:border-brand-500/60 hover:bg-mist-50 disabled:opacity-40"
              >
                {keyStatus === 'testing' ? 'Testing…' : 'Test key'}
              </button>
            </div>
            {keyStatus === 'ok' && (
              <div className="mt-1.5 text-xs font-medium text-emerald-700">✓ Key works.</div>
            )}
            {keyStatus === 'bad' && (
              <div className="mt-1.5 text-xs font-medium text-rose-700">
                ✗ Groq rejected that key.
              </div>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Transcription model">
              <input
                className={inputCls}
                value={local.transcriptionModel}
                onChange={(e) => patch({ transcriptionModel: e.target.value })}
              />
            </Field>
            <Field label="Suggestion model">
              <input
                className={inputCls}
                value={local.suggestionModel}
                onChange={(e) => patch({ suggestionModel: e.target.value })}
              />
            </Field>
            <Field label="Chat / detail model">
              <input
                className={inputCls}
                value={local.chatModel}
                onChange={(e) => patch({ chatModel: e.target.value })}
              />
            </Field>
            <Field label="Chunk length (seconds)">
              <input
                type="number"
                min={10}
                max={120}
                className={inputCls}
                value={local.chunkSeconds}
                onChange={(e) =>
                  patch({ chunkSeconds: Math.max(5, Number(e.target.value) || 30) })
                }
              />
            </Field>
            <Field label="Suggestion refresh (seconds)">
              <input
                type="number"
                min={10}
                max={300}
                className={inputCls}
                value={local.refreshIntervalSec}
                onChange={(e) =>
                  patch({
                    refreshIntervalSec: Math.max(5, Number(e.target.value) || 30),
                  })
                }
              />
            </Field>
            <Field label="Suggestion context (chars)">
              <input
                type="number"
                min={500}
                className={inputCls}
                value={local.suggestionContextChars}
                onChange={(e) =>
                  patch({
                    suggestionContextChars:
                      Math.max(200, Number(e.target.value) || 4000),
                  })
                }
              />
            </Field>
            <Field label="Detailed-answer / chat context (chars)">
              <input
                type="number"
                min={500}
                className={inputCls}
                value={local.detailContextChars}
                onChange={(e) =>
                  patch({
                    detailContextChars:
                      Math.max(200, Number(e.target.value) || 12000),
                  })
                }
              />
            </Field>
          </div>

          <PromptField
            label="Live suggestion prompt"
            value={local.suggestionPrompt}
            onChange={(v) => patch({ suggestionPrompt: v })}
            onReset={() => patch({ suggestionPrompt: DEFAULT_SUGGESTION_PROMPT })}
          />
          <PromptField
            label="Detailed-answer (on-click) prompt"
            value={local.detailPrompt}
            onChange={(v) => patch({ detailPrompt: v })}
            onReset={() => patch({ detailPrompt: DEFAULT_DETAIL_PROMPT })}
          />
          <PromptField
            label="Chat prompt"
            value={local.chatPrompt}
            onChange={(v) => patch({ chatPrompt: v })}
            onReset={() => patch({ chatPrompt: DEFAULT_CHAT_PROMPT })}
          />
        </div>

        <footer className="flex items-center justify-between border-t border-mist-200 bg-mist-50/60 px-5 py-3">
          <button
            onClick={() => {
              resetSettings();
              setLocal({ ...DEFAULT_SETTINGS, apiKey: local.apiKey });
              pushToast('Settings reset to defaults.', 'info');
            }}
            className="text-xs text-brand-700/60 hover:text-brand-700"
          >
            Reset all to defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-full border border-mist-200 bg-white px-4 py-1.5 text-sm text-brand-700 hover:bg-mist-50"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="rounded-full bg-brand-700 px-5 py-1.5 text-sm font-medium text-white shadow-soft hover:bg-brand-800"
            >
              Save
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function PromptField({
  label,
  value,
  onChange,
  onReset,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs font-semibold text-brand-900">{label}</div>
        <button
          onClick={onReset}
          className="text-[11px] text-brand-700/60 hover:text-brand-500"
        >
          Reset to default
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        className="w-full resize-y rounded-lg border border-mist-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-brand-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      />
    </div>
  );
}
