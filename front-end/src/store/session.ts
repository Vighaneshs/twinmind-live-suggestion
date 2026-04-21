import { create } from 'zustand';
import type {
  ChatMessage,
  DensitySignal,
  Settings,
  SuggestionBatch,
  Toast,
  TranscriptChunk,
} from '../lib/types';
import {
  DEFAULT_CHAT_PROMPT,
  DEFAULT_DETAIL_PROMPT,
  DEFAULT_LEDGER_PROMPT,
  DEFAULT_SUGGESTION_PROMPT,
  DEFAULT_WEB_QUERY_PROMPT,
} from '../lib/prompts';

const SETTINGS_KEY = 'twinmind.settings.v2';

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  suggestionModel: 'openai/gpt-oss-120b',
  chatModel: 'openai/gpt-oss-120b',
  ledgerModel: 'openai/gpt-oss-20b',
  scoutModel: 'openai/gpt-oss-20b',
  transcriptionModel: 'whisper-large-v3',
  suggestionPrompt: DEFAULT_SUGGESTION_PROMPT,
  detailPrompt: DEFAULT_DETAIL_PROMPT,
  chatPrompt: DEFAULT_CHAT_PROMPT,
  ledgerPrompt: DEFAULT_LEDGER_PROMPT,
  webQueryPrompt: DEFAULT_WEB_QUERY_PROMPT,
  suggestionContextChars: 4000,
  detailContextChars: 12000,
  refreshIntervalSec: 30,
  chunkSeconds: 30,
  ledgerUpdateChunks: 3,
  densityThreshold: 0,
  recentWindowSeconds: 120,
  recentlySaidSeconds: 30,
  enableWebSearch: true,
  suggestionReasoningEffort: 'low',
  detailReasoningEffort: 'high',
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

type SessionState = {
  transcript: TranscriptChunk[];
  batches: SuggestionBatch[];
  chat: ChatMessage[];
  ledger: string;
  ledgerUpdatedAt: number;
  ledgerUpdatedAtChunkIdx: number;
  lastDensitySignal: DensitySignal | null;
  lastSkippedRefresh: boolean;
  settings: Settings;
  recording: boolean;
  refreshing: boolean;
  settingsOpen: boolean;
  toasts: Toast[];

  appendTranscript: (chunk: TranscriptChunk) => void;
  prependBatch: (batch: SuggestionBatch) => void;
  addChat: (msg: ChatMessage) => void;
  appendChatDelta: (id: string, delta: string) => void;
  setChatStatus: (id: string, status: string | undefined) => void;
  setChatSources: (id: string, sources: ChatMessage['webSources']) => void;
  finishChat: (id: string) => void;

  setRecording: (v: boolean) => void;
  setRefreshing: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;

  setLedger: (ledger: string) => void;
  setDensity: (sig: DensitySignal, skipped: boolean) => void;

  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;

  pushToast: (message: string, kind?: Toast['kind']) => void;
  dismissToast: (id: string) => void;
};

export const useSession = create<SessionState>((set, get) => ({
  transcript: [],
  batches: [],
  chat: [],
  ledger: '',
  ledgerUpdatedAt: 0,
  ledgerUpdatedAtChunkIdx: 0,
  lastDensitySignal: null,
  lastSkippedRefresh: false,
  settings: loadSettings(),
  recording: false,
  refreshing: false,
  settingsOpen: false,
  toasts: [],

  appendTranscript: (chunk) =>
    set((s) => ({ transcript: [...s.transcript, chunk] })),

  prependBatch: (batch) => set((s) => ({ batches: [batch, ...s.batches] })),

  addChat: (msg) => set((s) => ({ chat: [...s.chat, msg] })),

  appendChatDelta: (id, delta) =>
    set((s) => ({
      chat: s.chat.map((m) =>
        m.id === id
          ? { ...m, content: m.content + delta, status: undefined }
          : m,
      ),
    })),

  setChatStatus: (id, status) =>
    set((s) => ({
      chat: s.chat.map((m) => (m.id === id ? { ...m, status } : m)),
    })),

  setChatSources: (id, sources) =>
    set((s) => ({
      chat: s.chat.map((m) => (m.id === id ? { ...m, webSources: sources } : m)),
    })),

  finishChat: (id) =>
    set((s) => ({
      chat: s.chat.map((m) =>
        m.id === id ? { ...m, streaming: false, status: undefined } : m,
      ),
    })),

  setRecording: (v) => set({ recording: v }),
  setRefreshing: (v) => set({ refreshing: v }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),

  setLedger: (ledger) =>
    set(() => ({
      ledger,
      ledgerUpdatedAt: Date.now(),
      ledgerUpdatedAtChunkIdx: get().transcript.length,
    })),

  setDensity: (sig, skipped) =>
    set({ lastDensitySignal: sig, lastSkippedRefresh: skipped }),

  updateSettings: (patch) => {
    const next = { ...get().settings, ...patch };
    saveSettings(next);
    set({ settings: next });
  },

  resetSettings: () => {
    const keep = get().settings.apiKey;
    const next = { ...DEFAULT_SETTINGS, apiKey: keep };
    saveSettings(next);
    set({ settings: next });
  },

  pushToast: (message, kind = 'info') => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4500);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function recentTranscript(chars: number): string {
  const all = useSession
    .getState()
    .transcript.map((c) => c.text.trim())
    .filter(Boolean)
    .join('\n');
  if (all.length <= chars) return all;
  return all.slice(all.length - chars);
}

export function recentTranscriptSeconds(seconds: number): string {
  const now = Date.now();
  const cutoff = now - seconds * 1000;
  return useSession
    .getState()
    .transcript.filter((c) => c.endedAt >= cutoff)
    .map((c) => c.text.trim())
    .filter(Boolean)
    .join('\n');
}

export function transcriptOlderThan(seconds: number, maxChars: number): string {
  const now = Date.now();
  const cutoff = now - seconds * 1000;
  const text = useSession
    .getState()
    .transcript.filter((c) => c.endedAt < cutoff)
    .map((c) => c.text.trim())
    .filter(Boolean)
    .join('\n');
  if (text.length <= maxChars) return text;
  return text.slice(text.length - maxChars);
}

export function transcriptBetween(fromMs: number, toMs: number): string {
  return useSession
    .getState()
    .transcript.filter((c) => c.endedAt > fromMs && c.startedAt < toMs)
    .map((c) => c.text.trim())
    .filter(Boolean)
    .join('\n');
}

export function transcriptSince(fromChunkIdx: number): string {
  return useSession
    .getState()
    .transcript.slice(fromChunkIdx)
    .map((c) => c.text.trim())
    .filter(Boolean)
    .join('\n');
}

export function fullTranscriptLineNumbered(): string {
  const chunks = useSession.getState().transcript;
  if (chunks.length === 0) return '';
  const lines: string[] = [];
  let n = 1;
  for (const c of chunks) {
    const text = c.text.trim();
    if (!text) continue;
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      lines.push(`L${n}: ${line}`);
      n += 1;
    }
  }
  return lines.join('\n');
}
