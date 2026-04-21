import type { WebSource } from './types';

type ConfigResponse = { tavilyEnabled: boolean };
type SearchResponse = {
  results: WebSource[];
  disabled?: boolean;
};

let cachedConfig: ConfigResponse | null = null;
let cachedConfigPromise: Promise<ConfigResponse> | null = null;

export async function fetchConfig(): Promise<ConfigResponse> {
  if (cachedConfig) return cachedConfig;
  if (cachedConfigPromise) return cachedConfigPromise;
  cachedConfigPromise = (async () => {
    try {
      const res = await fetch('/api/config', { method: 'GET' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as ConfigResponse;
      cachedConfig = { tavilyEnabled: Boolean(json.tavilyEnabled) };
      return cachedConfig;
    } catch {
      cachedConfig = { tavilyEnabled: false };
      return cachedConfig;
    }
  })();
  return cachedConfigPromise;
}

export async function searchWeb(queries: string[]): Promise<WebSource[]> {
  if (!queries.length) return [];
  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queries }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as SearchResponse;
    if (json.disabled) return [];
    return Array.isArray(json.results) ? json.results : [];
  } catch {
    return [];
  }
}
