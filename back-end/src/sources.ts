// Curated source-quality heuristics used to re-rank Tavily web results
// before returning them to the frontend's fact-check pipeline.

const DEFAULT_AUTHORITY_DOMAINS = [
  // News wire / legacy press
  'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'nytimes.com',
  'washingtonpost.com', 'wsj.com', 'ft.com', 'economist.com', 'bloomberg.com',
  'theguardian.com', 'aljazeera.com', 'npr.org', 'pbs.org',
  // Reference / encyclopedia
  'wikipedia.org', 'britannica.com',
  // Science, medicine, health
  'nature.com', 'science.org', 'nih.gov', 'who.int', 'cdc.gov', 'fda.gov',
  'pubmed.ncbi.nlm.nih.gov', 'arxiv.org', 'sciencedirect.com', 'thelancet.com',
  'nejm.org',
  // Stats, economics, public data
  'pewresearch.org', 'statista.com', 'oecd.org', 'worldbank.org', 'imf.org',
  'data.gov', 'eurostat.ec.europa.eu', 'bls.gov', 'census.gov',
  // Dedicated fact-checkers
  'snopes.com', 'factcheck.org', 'politifact.com', 'fullfact.org',
  // Tech canonical
  'github.com', 'developer.mozilla.org', 'docs.python.org', 'kubernetes.io',
];

const DEFAULT_CLICKBAIT_DOMAINS = [
  // Forums / Q&A — not authoritative for facts
  'pinterest.com', 'quora.com', 'answers.yahoo.com', 'reddit.com',
  // Listicle / clickbait
  'buzzfeed.com', 'boredpanda.com', 'listverse.com', 'wikihow.com',
  'unilad.com', 'ladbible.com', 'distractify.com', 'diply.com',
  // Content farms / opinion-heavy
  'hubpages.com', 'ezinearticles.com', 'medium.com', 'substack.com',
  // PR distribution (paid placement, not journalism)
  'prnewswire.com', 'businesswire.com', 'globenewswire.com', 'einpresswire.com',
  // Ad networks / recommendation widgets
  'taboola.com', 'outbrain.com',
];

function parseEnvList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const EXTRA_AUTHORITY = parseEnvList(process.env.TAVILY_INCLUDE_DOMAINS);
const EXTRA_CLICKBAIT = parseEnvList(process.env.TAVILY_EXCLUDE_DOMAINS);
// If user provides STRICT_INCLUDE, results MUST be in this list (passed to
// Tavily as include_domains so it doesn't waste credits searching elsewhere).
const STRICT_INCLUDE = parseEnvList(process.env.TAVILY_STRICT_INCLUDE_DOMAINS);

export const ALLOW_LIST: string[] = Array.from(
  new Set([...DEFAULT_AUTHORITY_DOMAINS, ...EXTRA_AUTHORITY]),
);
export const DENY_LIST: string[] = Array.from(
  new Set([...DEFAULT_CLICKBAIT_DOMAINS, ...EXTRA_CLICKBAIT]),
);
export const TAVILY_INCLUDE_DOMAINS: string[] = STRICT_INCLUDE;
export const TAVILY_EXCLUDE_DOMAINS: string[] = DENY_LIST;

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function matchesDomain(host: string, list: string[]): boolean {
  return list.some((d) => host === d || host.endsWith('.' + d));
}

/**
 * Score a result by source authority. Higher is better.
 * Hard-deny: -100. Allow-listed: 100. TLD-based bonuses for .gov/.edu/.int.
 */
export function authorityScore(url: string): number {
  const h = hostnameOf(url);
  if (!h) return -50;
  if (matchesDomain(h, DENY_LIST)) return -100;
  if (matchesDomain(h, ALLOW_LIST)) return 100;
  if (h.endsWith('.gov') || h.endsWith('.gov.uk') || h.endsWith('.gc.ca')) return 60;
  if (h.endsWith('.int')) return 55;
  if (h.endsWith('.edu') || h.endsWith('.ac.uk')) return 50;
  if (h.endsWith('.org')) return 10;
  return 0;
}
