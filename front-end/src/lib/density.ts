import type { DensitySignal } from './types';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by', 'from',
  'as', 'so', 'we', 'you', 'i', 'he', 'she', 'they', 'it', 'this', 'that',
  'these', 'those', 'our', 'your', 'his', 'her', 'their', 'its', 'my', 'me',
  'us', 'them', 'him', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'can', 'could', 'should', 'may', 'might', 'just', 'really', 'very',
  'also', 'too', 'not', 'no', 'yes', 'okay', 'ok', 'um', 'uh', 'like', 'well',
  'kind', 'sort', 'thing', 'things', 'stuff', 'yeah', 'right', 'sure',
]);

function tokens(text: string): string[] {
  return text.toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) ?? [];
}

function capitalizedEntities(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\b([A-Z][a-zA-Z0-9]{2,}(?:\s+[A-Z][a-zA-Z0-9]+){0,2})\b/g)) {
    const ent = m[1].trim();
    if (ent && !STOPWORDS.has(ent.toLowerCase())) out.add(ent);
  }
  return out;
}

function hasNumber(text: string): boolean {
  return /\b\d[\d.,%kKmMbB]*\b/.test(text);
}

function hasQuestion(text: string): boolean {
  return /\?/.test(text) ||
    /\b(what|why|how|when|where|who|which|should|can|could|would|do we|is there|are there)\b/i.test(
      text,
    );
}

function hasDecisionMarker(text: string): boolean {
  return /\b(let'?s|we'?ll|we should|decide|decision|going to|gonna|pick|choose|ship|launch)\b/i.test(
    text,
  );
}

/**
 * Score a new transcript chunk's density vs the prior transcript.
 * Heuristic, local, no API. Higher score = more "worth refreshing".
 * Score contributions (each adds 1):
 *   - any new capitalized entity not seen before
 *   - a number appears
 *   - a question was asked
 *   - a decision marker appears
 *   - >= 4 new non-stopword tokens
 */
export function scoreChunk(latestText: string, priorText: string): DensitySignal {
  const latest = latestText.trim();
  if (!latest) {
    return { score: 0, newEntities: [], hasQuestion: false, hasNumber: false };
  }

  const priorEntities = capitalizedEntities(priorText);
  const latestEntities = capitalizedEntities(latest);
  const newEntities: string[] = [];
  for (const e of latestEntities) if (!priorEntities.has(e)) newEntities.push(e);

  const priorVocab = new Set(tokens(priorText).filter((t) => !STOPWORDS.has(t)));
  const latestVocab = tokens(latest).filter((t) => !STOPWORDS.has(t));
  const newWordCount = latestVocab.filter((t) => !priorVocab.has(t)).length;

  const q = hasQuestion(latest);
  const n = hasNumber(latest);
  const d = hasDecisionMarker(latest);

  let score = 0;
  if (newEntities.length > 0) score += 1;
  if (n) score += 1;
  if (q) score += 1;
  if (d) score += 1;
  if (newWordCount >= 4) score += 1;

  return { score, newEntities, hasQuestion: q, hasNumber: n };
}
