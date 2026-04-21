import type {
  ChatMessage,
  SuggestionBatch,
  TranscriptChunk,
} from './types';

export type ExportPayload = {
  exportedAt: string;
  transcript: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  chat: ChatMessage[];
};

export function buildExportJSON(
  transcript: TranscriptChunk[],
  batches: SuggestionBatch[],
  chat: ChatMessage[],
): string {
  const payload: ExportPayload = {
    exportedAt: new Date().toISOString(),
    transcript,
    suggestionBatches: batches,
    chat,
  };
  return JSON.stringify(payload, null, 2);
}

export function buildExportTxt(
  transcript: TranscriptChunk[],
  batches: SuggestionBatch[],
  chat: ChatMessage[],
): string {
  const iso = (ts: number) => new Date(ts).toISOString();
  const lines: string[] = [];
  lines.push(`TwinMind session; exported ${new Date().toISOString()}`);
  lines.push('='.repeat(60));

  lines.push('\n## TRANSCRIPT');
  if (!transcript.length) lines.push('(none)');
  for (const c of transcript) {
    lines.push(`\n[${iso(c.startedAt)} → ${iso(c.endedAt)}]`);
    lines.push(c.text);
  }

  lines.push('\n\n## SUGGESTION BATCHES (newest first)');
  if (!batches.length) lines.push('(none)');
  for (const b of batches) {
    lines.push(`\n--- Batch @ ${iso(b.createdAt)} ---`);
    b.suggestions.forEach((s, i) => {
      lines.push(`  ${i + 1}. [${s.type}] ${s.title}`);
      lines.push(`     ${s.preview}`);
    });
  }

  lines.push('\n\n## CHAT');
  if (!chat.length) lines.push('(none)');
  for (const m of chat) {
    lines.push(`\n[${iso(m.createdAt)}] ${m.role.toUpperCase()}${
      m.sourceSuggestionId ? ' (from suggestion)' : ''
    }:`);
    lines.push(m.content);
  }

  return lines.join('\n');
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
