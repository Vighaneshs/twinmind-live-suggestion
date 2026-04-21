import { useEffect, useRef, useState } from 'react';
import {
  fullTranscriptLineNumbered,
  recentTranscriptSeconds,
  uid,
  useSession,
} from '../store/session';
import { chatStream, planWebQueries } from '../lib/groq';
import { fetchConfig, searchWeb } from '../lib/web';
import Markdown from './Markdown';
import type { Suggestion, WebSource } from '../lib/types';

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ChatColumn() {
  const chat = useSession((s) => s.chat);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    const s = useSession.getState();
    if (!s.settings.apiKey) {
      s.pushToast('Add your Groq API key in Settings first.', 'error');
      s.setSettingsOpen(true);
      return;
    }

    setDraft('');
    setSending(true);

    const userMsg = {
      id: uid(),
      role: 'user' as const,
      content: text,
      createdAt: Date.now(),
    };
    s.addChat(userMsg);

    const asstId = uid();
    s.addChat({
      id: asstId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      streaming: true,
      status: 'Pinning meeting context…',
    });

    try {
      const fullTs = fullTranscriptLineNumbered();
      const recent = recentTranscriptSeconds(s.settings.recentWindowSeconds);
      const pseudoCard: Suggestion = {
        id: 'typed',
        type: 'answer',
        title: text.slice(0, 200),
        preview: text.slice(0, 600),
      };

      let webSources: WebSource[] = [];
      if (s.settings.enableWebSearch) {
        const cfg = await fetchConfig();
        if (cfg.tavilyEnabled) {
          try {
            const queries = await planWebQueries(pseudoCard, recent, s.settings);
            if (queries.length) {
              useSession.getState().setChatStatus(asstId, 'Searching the web…');
              webSources = await searchWeb(queries);
            }
          } catch (err) {
            console.warn('Web planner failed:', (err as Error).message);
          }
        }
      }

      if (webSources.length) {
        useSession.getState().setChatSources(asstId, webSources);
      }
      useSession.getState().setChatStatus(asstId, 'Composing answer…');

      const history = [...useSession.getState().chat];
      await chatStream(
        history,
        fullTs,
        useSession.getState().ledger,
        webSources,
        s.settings,
        (delta) => {
          useSession.getState().appendChatDelta(asstId, delta);
        },
      );
    } catch (err) {
      useSession
        .getState()
        .appendChatDelta(asstId, `\n\n_Error: ${(err as Error).message}_`);
      useSession
        .getState()
        .pushToast(`Chat failed: ${(err as Error).message}`, 'error');
    } finally {
      useSession.getState().finishChat(asstId);
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <section className="card flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-mist-200/70 px-5 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-700/70">
          Chat
        </h2>
        <span className="text-[11px] text-brand-700/50">one session</span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {chat.length === 0 ? (
          <p className="mt-8 text-center text-sm text-brand-700/60">
            Ask anything, or tap a suggestion for a deeper answer.
          </p>
        ) : (
          <ul className="space-y-3">
            {chat.map((m) => (
              <li
                key={m.id}
                className={m.role === 'user' ? 'flex justify-end' : 'flex'}
              >
                <div
                  className={[
                    'max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-soft',
                    m.role === 'user'
                      ? 'bg-brand-700 text-white'
                      : 'border border-mist-200/70 bg-white/80 text-brand-900',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'mb-1 text-[10px] font-medium uppercase tracking-wider',
                      m.role === 'user' ? 'text-white/70' : 'text-brand-700/50',
                    ].join(' ')}
                  >
                    {m.role === 'user' ? 'You' : 'Assistant'} · {fmtTime(m.createdAt)}
                  </div>
                  {m.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  ) : m.content ? (
                    <Markdown variant="light">{m.content}</Markdown>
                  ) : m.streaming && m.status ? (
                    <div className="flex items-center gap-2 text-xs italic text-brand-700/70">
                      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-500" />
                      {m.status}
                    </div>
                  ) : m.streaming ? (
                    '…'
                  ) : null}
                  {m.streaming && m.content && (
                    <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-current align-middle opacity-60" />
                  )}
                  {m.role === 'assistant' &&
                    m.webSources &&
                    m.webSources.length > 0 && (
                      <div className="mt-2 border-t border-mist-200/60 pt-2">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-700/60">
                          Sources
                        </div>
                        <ol className="space-y-0.5 text-[11px]">
                          {m.webSources.map((src, i) => (
                            <li key={src.url + i} className="flex gap-1.5">
                              <span className="text-brand-700/50">[{i + 1}]</span>
                              <a
                                href={src.url}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate text-brand-700 underline decoration-brand-500/30 hover:decoration-brand-500"
                                title={src.title}
                              >
                                {src.title || src.url}
                              </a>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-mist-200/70 p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-mist-200/80 bg-white/80 p-2 shadow-soft focus-within:border-brand-500/50">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="Ask anything — Enter to send, Shift+Enter for newline"
            className="flex-1 resize-none bg-transparent px-2 py-1 text-sm text-brand-900 placeholder:text-brand-700/40 focus:outline-none"
          />
          <button
            onClick={() => void send()}
            disabled={!draft.trim() || sending}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 text-white shadow-soft transition hover:bg-brand-800 disabled:bg-brand-700/30"
            title="Send"
          >
            {sending ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-white" />
            ) : (
              <span className="text-base leading-none">↑</span>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
