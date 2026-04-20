import { create } from 'zustand';
import type {
  ChatMessage,
  Settings,
  SuggestionBatch,
  Toast,
  TranscriptChunk,
} from '../lib/types';
import {
  DEFAULT_CHAT_PROMPT,
  DEFAULT_DETAIL_PROMPT,
  DEFAULT_SUGGESTION_PROMPT,
} from '../lib/prompts';

const SETTINGS_KEY = 'twinmind.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  suggestionModel: 'openai/gpt-oss-120b',
  chatModel: 'openai/gpt-oss-120b',
  transcriptionModel: 'whisper-large-v3',
  suggestionPrompt: DEFAULT_SUGGESTION_PROMPT,
  detailPrompt: DEFAULT_DETAIL_PROMPT,
  chatPrompt: DEFAULT_CHAT_PROMPT,
  suggestionContextChars: 4000,
  detailContextChars: 12000,
  refreshIntervalSec: 30,
  chunkSeconds: 30,
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
  settings: Settings;
  recording: boolean;
  refreshing: boolean;
  settingsOpen: boolean;
  toasts: Toast[];

  appendTranscript: (chunk: TranscriptChunk) => void;
  prependBatch: (batch: SuggestionBatch) => void;
  addChat: (msg: ChatMessage) => void;
  appendChatDelta: (id: string, delta: string) => void;
  finishChat: (id: string) => void;

  setRecording: (v: boolean) => void;
  setRefreshing: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;

  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;

  pushToast: (message: string, kind?: Toast['kind']) => void;
  dismissToast: (id: string) => void;
};

export const useSession = create<SessionState>((set, get) => ({
  transcript: [],
  batches: [],
  chat: [],
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
        m.id === id ? { ...m, content: m.content + delta } : m,
      ),
    })),

  finishChat: (id) =>
    set((s) => ({
      chat: s.chat.map((m) => (m.id === id ? { ...m, streaming: false } : m)),
    })),

  setRecording: (v) => set({ recording: v }),
  setRefreshing: (v) => set({ refreshing: v }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),

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
