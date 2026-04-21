import { request } from 'undici';
import { TAVILY_API_KEY } from './env.js';
import {
  TAVILY_EXCLUDE_DOMAINS,
  TAVILY_INCLUDE_DOMAINS,
  authorityScore,
} from './sources.js';

export type WebSource = {
  title: string;
  url: string;
  snippet: string;
};

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
};

type TavilyResponse = {
  results?: TavilyResult[];
};

const FETCH_PER_QUERY = 8;
const FINAL_MAX = 6;

async function searchOne(query: string, signal: AbortSignal): Promise<WebSource[]> {
  const body: Record<string, unknown> = {
    api_key: TAVILY_API_KEY,
    query,
    max_results: FETCH_PER_QUERY,
    search_depth: 'advanced',
    exclude_domains: TAVILY_EXCLUDE_DOMAINS,
  };
  if (TAVILY_INCLUDE_DOMAINS.length) {
    body.include_domains = TAVILY_INCLUDE_DOMAINS;
  }

  const res = await request('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (res.statusCode < 200 || res.statusCode >= 300) {
    const text = await res.body.text().catch(() => '');
    throw new Error(`Tavily ${res.statusCode}: ${text.slice(0, 200)}`);
  }
  const json = (await res.body.json()) as TavilyResponse;
  const list = Array.isArray(json.results) ? json.results : [];
  return list
    .map<WebSource>((r) => ({
      title: (r.title ?? '').trim(),
      url: (r.url ?? '').trim(),
      snippet: (r.content ?? '').trim().slice(0, 600),
    }))
    .filter((r) => r.url);
}

export async function searchMany(queries: string[]): Promise<WebSource[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const settled = await Promise.allSettled(
      queries.slice(0, 2).map((q) => searchOne(q, controller.signal)),
    );

    const seen = new Set<string>();
    const pool: { src: WebSource; score: number; rank: number }[] = [];
    let rank = 0;
    for (const s of settled) {
      if (s.status !== 'fulfilled') continue;
      for (const r of s.value) {
        if (seen.has(r.url)) continue;
        seen.add(r.url);
        const score = authorityScore(r.url);
        if (score <= -100) continue; // hard-deny clickbait
        pool.push({ src: r, score, rank: rank++ });
      }
    }

    // Sort: authority score desc, then original Tavily rank asc as tiebreak.
    pool.sort((a, b) => (b.score - a.score) || (a.rank - b.rank));
    return pool.slice(0, FINAL_MAX).map((x) => x.src);
  } finally {
    clearTimeout(timer);
  }
}
