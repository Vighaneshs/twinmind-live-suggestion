import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, useSession } from '../store/session';
import {
  DEFAULT_CHAT_PROMPT,
  DEFAULT_DETAIL_PROMPT,
  DEFAULT_LEDGER_PROMPT,
  DEFAULT_SUGGESTION_PROMPT,
  DEFAULT_WEB_QUERY_PROMPT,
} from '../lib/prompts';
import { testApiKey } from '../lib/groq';
import { fetchConfig } from '../lib/web';
import type { ReasoningEffort, Settings } from '../lib/types';

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

const EFFORTS: ReasoningEffort[] = ['low', 'medium', 'high'];

export default function SettingsModal() {
  const open = useSession((s) => s.settingsOpen);
  const setOpen = useSession((s) => s.setSettingsOpen);
  const settings = useSession((s) => s.settings);
  const updateSettings = useSession((s) => s.updateSettings);
  const resetSettings = useSession((s) => s.resetSettings);
  const pushToast = useSession((s) => s.pushToast);

  const [local, setLocal] = useState<Settings>(settings);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>('idle');
  const [tavilyEnabled, setTavilyEnabled] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setLocal(settings);
      setKeyStatus('idle');
      void fetchConfig().then((cfg) => setTavilyEnabled(cfg.tavilyEnabled));
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
            <Field label="Ledger model (Janitor)" hint="Cheap model; runs every N chunks.">
              <input
                className={inputCls}
                value={local.ledgerModel}
                onChange={(e) => patch({ ledgerModel: e.target.value })}
              />
            </Field>
            <Field label="Scout model (web queries)" hint="Tiny classifier call.">
              <input
                className={inputCls}
                value={local.scoutModel}
                onChange={(e) => patch({ scoutModel: e.target.value })}
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
            <Field label="Detail / chat context (chars)">
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
            <Field label="Recent window (seconds)" hint="Verbatim recent block.">
              <input
                type="number"
                min={10}
                max={600}
                className={inputCls}
                value={local.recentWindowSeconds}
                onChange={(e) =>
                  patch({
                    recentWindowSeconds: Math.max(10, Number(e.target.value) || 120),
                  })
                }
              />
            </Field>
            <Field label="Recently-said window (seconds)" hint="Primary trigger block.">
              <input
                type="number"
                min={5}
                max={120}
                className={inputCls}
                value={local.recentlySaidSeconds}
                onChange={(e) =>
                  patch({
                    recentlySaidSeconds: Math.max(5, Number(e.target.value) || 30),
                  })
                }
              />
            </Field>
            <Field label="Ledger update every N chunks" hint="Janitor cadence.">
              <input
                type="number"
                min={1}
                max={20}
                className={inputCls}
                value={local.ledgerUpdateChunks}
                onChange={(e) =>
                  patch({
                    ledgerUpdateChunks: Math.max(1, Number(e.target.value) || 3),
                  })
                }
              />
            </Field>
            <Field label="Density threshold" hint="Min score to allow an auto-refresh.">
              <input
                type="number"
                min={0}
                max={5}
                className={inputCls}
                value={local.densityThreshold}
                onChange={(e) =>
                  patch({
                    densityThreshold: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </Field>
            <Field label="Suggestion reasoning effort">
              <select
                className={inputCls}
                value={local.suggestionReasoningEffort}
                onChange={(e) =>
                  patch({ suggestionReasoningEffort: e.target.value as ReasoningEffort })
                }
              >
                {EFFORTS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Detail / chat reasoning effort">
              <select
                className={inputCls}
                value={local.detailReasoningEffort}
                onChange={(e) =>
                  patch({ detailReasoningEffort: e.target.value as ReasoningEffort })
                }
              >
                {EFFORTS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label="Web search (Tavily)"
            hint={
              tavilyEnabled
                ? 'Backend has TAVILY_API_KEY. Enable to augment detail answers.'
                : 'Backend has no TAVILY_API_KEY — web search is disabled server-side.'
            }
          >
            <label className="flex items-center gap-2 text-sm text-brand-900">
              <input
                type="checkbox"
                checked={local.enableWebSearch && tavilyEnabled}
                disabled={!tavilyEnabled}
                onChange={(e) => patch({ enableWebSearch: e.target.checked })}
                className="h-4 w-4"
              />
              Augment detail answers with web sources
            </label>
          </Field>

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
          <PromptField
            label="Ledger / Janitor prompt"
            value={local.ledgerPrompt}
            onChange={(v) => patch({ ledgerPrompt: v })}
            onReset={() => patch({ ledgerPrompt: DEFAULT_LEDGER_PROMPT })}
          />
          <PromptField
            label="Web-query scout prompt"
            value={local.webQueryPrompt}
            onChange={(v) => patch({ webQueryPrompt: v })}
            onReset={() => patch({ webQueryPrompt: DEFAULT_WEB_QUERY_PROMPT })}
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
