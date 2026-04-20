import { useCallback, useEffect, useRef } from 'react';
import { recentTranscript, uid, useSession } from '../store/session';
import { answerDetailed, suggest } from '../lib/groq';
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

  const runningRef = useRef(false);
  const lastBatchAtRef = useRef(0);

  const runRefresh = useCallback(async (opts?: { manual?: boolean }) => {
    if (runningRef.current) return;
    const s = useSession.getState();
    if (!s.settings.apiKey) return;

    const ctx = recentTranscript(s.settings.suggestionContextChars);
    if (!ctx.trim()) {
      if (opts?.manual) {
        s.pushToast(
          'No transcript yet — start the mic and let a chunk land first.',
          'info',
        );
      }
      return;
    }

    runningRef.current = true;
    s.setRefreshing(true);
    try {
      const prevTitles = (s.batches[0]?.suggestions ?? []).map((x) => x.title);
      const suggestions = await suggest(ctx, prevTitles, s.settings);
      s.prependBatch({ id: uid(), createdAt: Date.now(), suggestions });
      lastBatchAtRef.current = Date.now();
    } catch (err) {
      s.pushToast(`Suggestions failed: ${(err as Error).message}`, 'error');
    } finally {
      runningRef.current = false;
      useSession.getState().setRefreshing(false);
    }
  }, []);

  // Trigger refresh when a new transcript chunk arrives, rate-limited to the
  // configured refresh interval. This guarantees every suggestion batch is
  // based on fresh transcript (instead of a blind timer that may race the
  // incoming chunk and see an empty transcript).
  useEffect(() => {
    if (!recording) return;
    if (transcriptLen === 0) return;
    const intervalMs = Math.max(5, settings.refreshIntervalSec) * 1000;
    const elapsed = Date.now() - lastBatchAtRef.current;
    if (lastBatchAtRef.current === 0 || elapsed >= intervalMs) {
      void runRefresh();
    }
  }, [transcriptLen, recording, settings.refreshIntervalSec, runRefresh]);

  const handleCardClick = async (sugg: Suggestion) => {
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
    });

    try {
      const ctx = recentTranscript(s.settings.detailContextChars);
      await answerDetailed(sugg, ctx, s.settings, (delta) => {
        useSession.getState().appendChatDelta(asstId, delta);
      });
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

  return (
    <section className="card flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-mist-200/70 px-5 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-700/70">
          Suggestions
        </h2>
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
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
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
              <div key={b.id}>
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
