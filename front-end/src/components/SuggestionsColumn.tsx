import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fullTranscriptLineNumbered,
  recentTranscriptSeconds,
  transcriptOlderThan,
  uid,
  useSession,
} from '../store/session';
import { answerDetailed, planWebQueries, suggest } from '../lib/groq';
import { recordClick, recentClicks } from '../lib/clickHistory';
import { scoreChunk } from '../lib/density';
import { maybeUpdateLedger } from '../lib/ledger';
import { fetchConfig, searchWeb } from '../lib/web';
import SuggestionCard from './SuggestionCard';
import type { Suggestion } from '../lib/types';

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function SuggestionsColumn() {
  const batches = useSession((s) => s.batches);
  const recording = useSession((s) => s.recording);
  const refreshing = useSession((s) => s.refreshing);
  const settings = useSession((s) => s.settings);
  const transcriptLen = useSession((s) => s.transcript.length);
  const lastSkipped = useSession((s) => s.lastSkippedRefresh);
  const lastDensity = useSession((s) => s.lastDensitySignal);

  const runningRef = useRef(false);
  const lastBatchAtRef = useRef(0);
  const [scrolled, setScrolled] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const runRefresh = useCallback(async (opts?: { manual?: boolean }) => {
    if (runningRef.current) return;
    const s = useSession.getState();
    if (!s.settings.apiKey) return;

    const recentlySaid = recentTranscriptSeconds(s.settings.recentlySaidSeconds);
    const recentWindow = recentTranscriptSeconds(s.settings.recentWindowSeconds);
    const olderWindow = transcriptOlderThan(
      s.settings.recentWindowSeconds,
      Math.max(500, s.settings.suggestionContextChars - recentWindow.length),
    );

    if (!recentWindow.trim() && !olderWindow.trim()) {
      if (opts?.manual) {
        s.pushToast(
          'No transcript yet — start the mic and let a chunk land first.',
          'info',
        );
      }
      return;
    }

    // Density gate — skip if nothing new said since the last batch (unless manual).
    if (!opts?.manual) {
      const priorBefore = s.transcript
        .slice(0, Math.max(0, s.transcript.length - 1))
        .map((c) => c.text.trim())
        .filter(Boolean)
        .join('\n');
      const latestChunk = s.transcript[s.transcript.length - 1]?.text ?? '';
      const density = scoreChunk(latestChunk, priorBefore);
      if (density.score < Math.max(0, s.settings.densityThreshold)) {
        s.setDensity(density, true);
        return;
      }
      s.setDensity(density, false);
    }

    // Kick off Janitor non-blocking — does its own debounce.
    void maybeUpdateLedger();

    runningRef.current = true;
    s.setRefreshing(true);
    // Stamp the attempt time BEFORE the API call so the rate limiter doesn't
    // drift by the API round-trip each tick (a ~2s call would otherwise skip
    // every other 30s chunk).
    lastBatchAtRef.current = Date.now();
    const suggestCtx = {
      ledger: s.ledger,
      olderWindow,
      recentWindow,
      recentlySaid,
      previousBatch: s.batches[0]?.suggestions ?? [],
      recentClicks: recentClicks(),
    };
    try {
      const suggestions = await suggest(suggestCtx, s.settings);
      s.prependBatch({ id: uid(), createdAt: Date.now(), suggestions });
    } catch {
      try {
        await new Promise((res) => setTimeout(res, 2500));
        const suggestions = await suggest(suggestCtx, s.settings);
        s.prependBatch({ id: uid(), createdAt: Date.now(), suggestions });
      } catch (err) {
        console.warn('Suggestions failed after retry:', (err as Error).message);
      }
    } finally {
      runningRef.current = false;
      useSession.getState().setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!recording) return;
    if (transcriptLen === 0) return;
    const intervalMs = Math.max(5, settings.refreshIntervalSec) * 1000;
    const elapsed = Date.now() - lastBatchAtRef.current;
    if (lastBatchAtRef.current === 0 || elapsed >= intervalMs - 1000) {
      void runRefresh();
    }
  }, [transcriptLen, recording, settings.refreshIntervalSec, runRefresh]);

  const handleCardClick = async (sugg: Suggestion) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.add(sugg.id); return next; });
    setTimeout(() => recordClick(sugg.title), 0);
    const s = useSession.getState();
    if (!s.settings.apiKey) {
      s.pushToast('Add your Groq API key in Settings first.', 'error');
      s.setSettingsOpen(true);
      return;
    }

    const userMsgId = uid();
    s.addChat({
      id: userMsgId,
      role: 'user',
      content: `Tell me more about: "${sugg.title}"`,
      createdAt: Date.now(),
      sourceSuggestionId: sugg.id,
    });

    const asstId = uid();
    s.addChat({
      id: asstId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      sourceSuggestionId: sugg.id,
      streaming: true,
      status: `Pinning meeting context for "${sugg.title}"…`,
    });

    try {
      const fullTs = fullTranscriptLineNumbered();
      const recent = recentTranscriptSeconds(s.settings.recentWindowSeconds);

      let webSources: typeof s.chat[number]['webSources'] = [];
      if (s.settings.enableWebSearch) {
        const cfg = await fetchConfig();
        if (cfg.tavilyEnabled) {
          try {
            const queries = await planWebQueries(sugg, recent, s.settings);
            if (queries.length) {
              useSession.getState().setChatStatus(asstId, 'Searching the web…');
              webSources = await searchWeb(queries);
            }
          } catch (err) {
            console.warn('Web planner failed:', (err as Error).message);
          }
        }
      }

      if (webSources && webSources.length) {
        useSession.getState().setChatSources(asstId, webSources);
      }
      useSession.getState().setChatStatus(asstId, 'Composing answer…');

      let pending = '';
      let rafId: number | null = null;
      await answerDetailed(
        sugg,
        fullTs,
        s.settings.apiKey ? useSession.getState().ledger : '',
        webSources ?? [],
        s.settings,
        (delta) => {
          pending += delta;
          if (rafId === null) {
            rafId = requestAnimationFrame(() => {
              useSession.getState().appendChatDelta(asstId, pending);
              pending = '';
              rafId = null;
            });
          }
        },
      );
      if (pending) useSession.getState().appendChatDelta(asstId, pending);
    } catch (err) {
      useSession
        .getState()
        .appendChatDelta(asstId, `\n\n_Error: ${(err as Error).message}_`);
      useSession
        .getState()
        .pushToast(`Detail answer failed: ${(err as Error).message}`, 'error');
    } finally {
      useSession.getState().finishChat(asstId);
    }
  };

  const skipHint =
    lastSkipped && recording && transcriptLen > 0
      ? lastDensity && lastDensity.newEntities.length > 0
        ? 'Held — minor update, tap Refresh to force.'
        : 'Held — nothing new said. Tap Refresh to force.'
      : '';

  return (
    <section className="card flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-mist-200/70 px-5 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-700/70">
          Suggestions
        </h2>
        <div className="flex flex-col items-end gap-0.5">
          <button
            onClick={() => void runRefresh({ manual: true })}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-xs font-medium text-brand-700 shadow-soft transition hover:bg-white disabled:opacity-50"
            title="Refresh suggestions"
          >
            <span
              className={refreshing ? 'animate-spin' : ''}
              aria-hidden="true"
            >
              ↻
            </span>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          {skipHint && (
            <span className="text-[10px] text-brand-700/50">{skipHint}</span>
          )}
        </div>
      </header>

      <div
        className="flex-1 min-h-0 overflow-y-auto px-5 py-4"
        onScroll={(e) => setScrolled((e.currentTarget as HTMLDivElement).scrollTop > 10)}
      >
        {refreshing && (
          <div className="mb-5 space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border border-mist-200/70 bg-white/50"
              />
            ))}
          </div>
        )}

        {batches.length === 0 && !refreshing ? (
          <p className="mt-8 text-center text-sm text-brand-700/60">
            {recording
              ? 'Generating your first batch after the next transcript chunk…'
              : 'Start the mic for live suggestions, or press Refresh.'}
          </p>
        ) : (
          <div className="space-y-6">
            {batches.map((b, idx) => (
              <div
                key={b.id}
                className={`transition-opacity duration-300 ${idx > 0 && !scrolled ? 'opacity-30' : 'opacity-100'}`}
              >
                <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-brand-700/50">
                  <span>{idx === 0 ? 'Latest' : `#${batches.length - idx}`}</span>
                  <span className="text-brand-700/20">•</span>
                  <span>{fmtTime(b.createdAt)}</span>
                </div>
                <div className="space-y-2.5">
                  {b.suggestions.map((s) => (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      onClick={() => void handleCardClick(s)}
                      selected={selectedIds.has(s.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
