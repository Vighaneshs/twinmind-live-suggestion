const KEY = 'twinmind.clickHistory.v1';
const STORE_LIMIT = 15;
const SERVE_LIMIT = 5;
const TITLE_MAX = 60;

export function recordClick(title: string): void {
  const trimmed = title.trim().slice(0, TITLE_MAX);
  if (!trimmed) return;
  const current = loadAll();
  // Deduplicate: remove any existing occurrence of the same title before prepending
  const deduped = current.filter((t) => t !== trimmed);
  const next = [trimmed, ...deduped].slice(0, STORE_LIMIT);
  localStorage.setItem(KEY, JSON.stringify(next));
}

function loadAll(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function recentClicks(): string[] {
  return loadAll().slice(0, SERVE_LIMIT);
}
