import { useEffect, useRef } from 'react';
import { useSession, uid } from '../store/session';
import { startRecording, type RecorderHandle } from '../lib/recorder';
import { transcribeChunk } from '../lib/groq';

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function TranscriptColumn() {
  const transcript = useSession((s) => s.transcript);
  const recording = useSession((s) => s.recording);
  const settings = useSession((s) => s.settings);
  const setRecording = useSession((s) => s.setRecording);
  const appendTranscript = useSession((s) => s.appendTranscript);
  const pushToast = useSession((s) => s.pushToast);
  const setSettingsOpen = useSession((s) => s.setSettingsOpen);

  const handleRef = useRef<RecorderHandle | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [transcript.length]);

  const toggle = async () => {
    if (recording) {
      const h = handleRef.current;
      handleRef.current = null;
      setRecording(false);
      if (h) await h.stop();
      return;
    }
    if (!settings.apiKey) {
      pushToast('Add your Groq API key in Settings first.', 'error');
      setSettingsOpen(true);
      return;
    }
    try {
      const handle = await startRecording(
        settings.chunkSeconds,
        (blob, startedAt, endedAt) => {
          void (async () => {
            try {
              const text = await transcribeChunk(blob, useSession.getState().settings);
              if (text) {
                appendTranscript({ id: uid(), text, startedAt, endedAt });
              }
            } catch (err) {
              pushToast(
                `Transcription failed: ${(err as Error).message}`,
                'error',
              );
            }
          })();
        },
        (err) => pushToast(`Mic error: ${err.message}`, 'error'),
      );
      handleRef.current = handle;
      setRecording(true);
    } catch (err) {
      pushToast(
        `Could not access microphone: ${(err as Error).message}`,
        'error',
      );
    }
  };

  useEffect(() => {
    return () => {
      handleRef.current?.stop();
    };
  }, []);

  return (
    <section className="card flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-mist-200/70 px-5 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-700/70">
          Transcript
        </h2>
        <button
          onClick={toggle}
          className={[
            'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-soft transition',
            recording
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-brand-700 text-white hover:bg-brand-800',
          ].join(' ')}
        >
          <span
            className={[
              'h-2 w-2 rounded-full',
              recording ? 'animate-pulse bg-white' : 'bg-white/90',
            ].join(' ')}
          />
          {recording ? 'Stop' : 'Capture Notes'}
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {transcript.length === 0 ? (
          <p className="mt-8 text-center text-sm text-brand-700/60">
            {recording
              ? 'Listening… first chunk will appear in ~30s.'
              : 'Press Capture Notes to begin.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {transcript.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-mist-200/70 bg-white/70 p-3 shadow-soft"
              >
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-brand-700/50">
                  {fmtTime(c.startedAt)} – {fmtTime(c.endedAt)}
                </div>
                <p className="text-sm leading-relaxed text-brand-900">
                  {c.text}
                </p>
              </li>
            ))}
          </ul>
        )}
        <div ref={endRef} />
      </div>
    </section>
  );
}
