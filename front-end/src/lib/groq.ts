import Groq from 'groq-sdk';
import type {
  ChatMessage,
  LedgerState,
  Settings,
  Suggestion,
  SuggestionType,
  WebSource,
} from './types';
import { uid } from '../store/session';

function client(settings: Settings): Groq {
  if (!settings.apiKey) throw new Error('Missing Groq API key. Open Settings to add one.');
  return new Groq({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
}

export async function testApiKey(apiKey: string): Promise<boolean> {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return res.ok;
}

export async function transcribeChunk(
  blob: Blob,
  settings: Settings,
): Promise<string> {
  const file = new File([blob], `chunk-${Date.now()}.webm`, {
    type: blob.type || 'audio/webm',
  });
  const groq = client(settings);
  const res = await groq.audio.transcriptions.create({
    file,
    model: settings.transcriptionModel,
    response_format: 'json',
  });
  return (res as { text?: string }).text?.trim() ?? '';
}

const VALID_TYPES: SuggestionType[] = [
  'question',
  'talking_point',
  'answer',
  'fact_check',
  'clarification',
];

function parseSuggestions(raw: string): Suggestion[] {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error('Model did not return valid JSON');
  }
  const arr = (obj as { suggestions?: unknown[] })?.suggestions;
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('Model returned no suggestions');
  }
  const out: Suggestion[] = [];
  for (const item of arr.slice(0, 3)) {
    const i = item as Partial<Suggestion>;
    const title = String(i.title ?? '').trim();
    const preview = String(i.preview ?? '').trim();
    if (!title || !preview) continue;
    const type = (VALID_TYPES as string[]).includes(i.type ?? '')
      ? (i.type as SuggestionType)
      : 'talking_point';
    out.push({
      id: uid(),
      type,
      title: title.slice(0, 200),
      preview: preview.slice(0, 600),
    });
  }
  if (out.length === 0) throw new Error('Model returned no usable suggestions');
  return out;
}

type ChatCompletionExtras = {
  reasoning_effort?: 'low' | 'medium' | 'high';
};

export type SuggestContext = {
  ledger: string;
  olderWindow: string;
  recentWindow: string;
  recentlySaid: string;
  previousBatch: Suggestion[];
};

function fmtPreviousBatch(prev: Suggestion[]): string {
  if (!prev.length) return '(none)';
  return prev
    .map((s) => `- [${s.type}] ${s.title} — ${s.preview.slice(0, 160)}`)
    .join('\n');
}

function buildSuggestUserMsg(ctx: SuggestContext): string {
  const ledgerBlock = ctx.ledger.trim() || '(empty — nothing summarized yet)';
  const older = ctx.olderWindow.trim() || '(none)';
  const recent = ctx.recentWindow.trim() || '(none)';
  const recentlySaid = ctx.recentlySaid.trim() || '(silence)';
  return (
    `[MEETING LEDGER]\n${ledgerBlock}\n\n` +
    `[OLDER CONTEXT]\n"""\n${older}\n"""\n\n` +
    `[RECENT TRANSCRIPT]\n"""\n${recent}\n"""\n\n` +
    `[RECENTLY SAID]\n"""\n${recentlySaid}\n"""\n\n` +
    `[PREVIOUS BATCH]\n${fmtPreviousBatch(ctx.previousBatch)}`
  );
}

export async function suggest(
  ctx: SuggestContext,
  settings: Settings,
): Promise<Suggestion[]> {
  const groq = client(settings);
  const userContent = buildSuggestUserMsg(ctx);
  const extras: ChatCompletionExtras = {
    reasoning_effort: settings.suggestionReasoningEffort,
  };
  const res = await groq.chat.completions.create({
    model: settings.suggestionModel,
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: settings.suggestionPrompt },
      { role: 'user', content: userContent },
    ],
    ...(extras as Record<string, unknown>),
  });
  const raw = res.choices[0]?.message?.content ?? '';
  return parseSuggestions(raw);
}

export async function updateLedger(
  currentLedger: string,
  newTranscript: string,
  settings: Settings,
): Promise<LedgerState> {
  const groq = client(settings);
  const user =
    `CURRENT LEDGER:\n${currentLedger.trim() || '(empty)'}\n\n` +
    `NEW TRANSCRIPT SINCE LAST UPDATE:\n"""\n${newTranscript.trim() || '(none)'}\n"""`;
  const res = await groq.chat.completions.create({
    model: settings.ledgerModel,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: settings.ledgerPrompt },
      { role: 'user', content: user },
    ],
    ...({ reasoning_effort: 'low' } as Record<string, unknown>),
  });
  const raw = res.choices[0]?.message?.content ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Ledger model returned invalid JSON');
  }
  const p = parsed as Partial<LedgerState>;
  const normalize = (arr: unknown): string[] =>
    Array.isArray(arr)
      ? arr
          .map((x) => String(x).trim())
          .filter(Boolean)
          .slice(0, 20)
      : [];
  return {
    entities: normalize(p.entities),
    facts: normalize(p.facts),
    decisions: normalize(p.decisions),
    open_questions: normalize(p.open_questions),
  };
}

export function serializeLedger(l: LedgerState): string {
  const hasAny =
    l.entities.length + l.facts.length + l.decisions.length + l.open_questions.length > 0;
  if (!hasAny) return '';
  const section = (label: string, items: string[]): string =>
    items.length ? `${label}:\n${items.map((i) => `- ${i}`).join('\n')}` : '';
  return [
    section('Entities', l.entities),
    section('Facts', l.facts),
    section('Decisions', l.decisions),
    section('Open questions', l.open_questions),
  ]
    .filter(Boolean)
    .join('\n');
}

export async function planWebQueries(
  suggestion: Suggestion,
  recentTranscriptCtx: string,
  settings: Settings,
): Promise<string[]> {
  const groq = client(settings);
  const user =
    `[SUGGESTION CARD]\n${JSON.stringify(
      { type: suggestion.type, title: suggestion.title, preview: suggestion.preview },
      null,
      2,
    )}\n\n` +
    `[RECENT TRANSCRIPT]\n"""\n${recentTranscriptCtx.trim() || '(empty)'}\n"""`;
  const res = await groq.chat.completions.create({
    model: settings.scoutModel,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: settings.webQueryPrompt },
      { role: 'user', content: user },
    ],
    ...({ reasoning_effort: 'low' } as Record<string, unknown>),
  });
  const raw = res.choices[0]?.message?.content ?? '';
  try {
    const obj = JSON.parse(raw) as { queries?: unknown };
    if (!Array.isArray(obj.queries)) return [];
    return obj.queries
      .map((q) => String(q).trim())
      .filter(Boolean)
      .slice(0, 2);
  } catch {
    return [];
  }
}

async function streamInto(
  stream: AsyncIterable<{ choices: { delta: { content?: string | null } }[] }>,
  onDelta: (text: string) => void,
): Promise<void> {
  for await (const part of stream) {
    const delta = part.choices?.[0]?.delta?.content;
    if (delta) onDelta(delta);
  }
}

function fmtWebSources(sources: WebSource[]): string {
  if (!sources.length) return '(no web sources)';
  return sources
    .map(
      (s, i) =>
        `[${i + 1}] ${s.title}\n    ${s.url}\n    ${s.snippet.slice(0, 400)}`,
    )
    .join('\n\n');
}

export async function answerDetailed(
  suggestion: Suggestion,
  fullTranscript: string,
  ledger: string,
  webSources: WebSource[],
  settings: Settings,
  onDelta: (text: string) => void,
): Promise<void> {
  const groq = client(settings);
  const user =
    `[MEETING LEDGER]\n${ledger.trim() || '(empty)'}\n\n` +
    `[FULL TRANSCRIPT (line-numbered)]\n"""\n${fullTranscript.trim() || '(empty)'}\n"""\n\n` +
    `[WEB SOURCES]\n${fmtWebSources(webSources)}\n\n` +
    `[SUGGESTION CARD]\n${JSON.stringify(
      { type: suggestion.type, title: suggestion.title, preview: suggestion.preview },
      null,
      2,
    )}\n\nFollow the Anchor → Expand → Cite procedure.`;
  const stream = await groq.chat.completions.create({
    model: settings.chatModel,
    temperature: 0.4,
    stream: true,
    messages: [
      { role: 'system', content: settings.detailPrompt },
      { role: 'user', content: user },
    ],
    ...({ reasoning_effort: settings.detailReasoningEffort } as Record<string, unknown>),
  });
  await streamInto(stream as never, onDelta);
}

export async function chatStream(
  history: ChatMessage[],
  fullTranscript: string,
  ledger: string,
  webSources: WebSource[],
  settings: Settings,
  onDelta: (text: string) => void,
): Promise<void> {
  const groq = client(settings);
  const ledgerBlock = `[MEETING LEDGER]\n${ledger.trim() || '(empty)'}`;
  const transcriptBlock = `[FULL TRANSCRIPT (line-numbered)]\n"""\n${
    fullTranscript.trim() || '(empty)'
  }\n"""`;
  const webBlock = webSources.length
    ? `[WEB SOURCES]\n${fmtWebSources(webSources)}`
    : '';
  const messages = [
    { role: 'system' as const, content: settings.chatPrompt },
    { role: 'system' as const, content: ledgerBlock },
    { role: 'system' as const, content: transcriptBlock },
    ...(webBlock ? [{ role: 'system' as const, content: webBlock }] : []),
    ...history
      .filter((m) => !m.streaming && m.content)
      .map((m) => ({ role: m.role, content: m.content })),
  ];
  const stream = await groq.chat.completions.create({
    model: settings.chatModel,
    temperature: 0.5,
    stream: true,
    messages,
    ...({ reasoning_effort: settings.detailReasoningEffort } as Record<string, unknown>),
  });
  await streamInto(stream as never, onDelta);
}
