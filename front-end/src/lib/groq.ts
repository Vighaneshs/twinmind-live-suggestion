import Groq from 'groq-sdk';
import type { ChatMessage, Settings, Suggestion, SuggestionType } from './types';
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

export async function suggest(
  transcriptWindow: string,
  previousTitles: string[],
  settings: Settings,
): Promise<Suggestion[]> {
  const groq = client(settings);
  const userContent =
    `PREVIOUS BATCH TITLES (do not repeat):\n${
      previousTitles.length ? previousTitles.map((t) => `- ${t}`).join('\n') : '(none)'
    }\n\nRECENT TRANSCRIPT:\n"""\n${transcriptWindow || '(no speech captured yet)'}\n"""`;
  const res = await groq.chat.completions.create({
    model: settings.suggestionModel,
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: settings.suggestionPrompt },
      { role: 'user', content: userContent },
    ],
  });
  const raw = res.choices[0]?.message?.content ?? '';
  return parseSuggestions(raw);
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

export async function answerDetailed(
  suggestion: Suggestion,
  transcriptContext: string,
  settings: Settings,
  onDelta: (text: string) => void,
): Promise<void> {
  const groq = client(settings);
  const user = `SUGGESTION CARD:\n${JSON.stringify(suggestion, null, 2)}\n\nMEETING TRANSCRIPT (recent):\n"""\n${
    transcriptContext || '(empty)'
  }\n"""\n\nProvide the deeper answer per your instructions.`;
  const stream = await groq.chat.completions.create({
    model: settings.chatModel,
    temperature: 0.4,
    stream: true,
    messages: [
      { role: 'system', content: settings.detailPrompt },
      { role: 'user', content: user },
    ],
  });
  await streamInto(stream as never, onDelta);
}

export async function chatStream(
  history: ChatMessage[],
  transcriptContext: string,
  settings: Settings,
  onDelta: (text: string) => void,
): Promise<void> {
  const groq = client(settings);
  const transcriptPrefix = `CURRENT MEETING TRANSCRIPT (recent):\n"""\n${
    transcriptContext || '(empty)'
  }\n"""`;
  const messages = [
    { role: 'system' as const, content: settings.chatPrompt },
    { role: 'system' as const, content: transcriptPrefix },
    ...history
      .filter((m) => !m.streaming && m.content)
      .map((m) => ({ role: m.role, content: m.content })),
  ];
  const stream = await groq.chat.completions.create({
    model: settings.chatModel,
    temperature: 0.5,
    stream: true,
    messages,
  });
  await streamInto(stream as never, onDelta);
}
