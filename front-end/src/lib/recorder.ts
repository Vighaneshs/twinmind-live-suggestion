export type RecorderHandle = {
  stop: () => Promise<void>;
};

function pickMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return undefined;
}

/**
 * Records the mic and fires `onChunk` roughly every `chunkSeconds` with a
 * standalone audio blob (each chunk is independently transcribable).
 *
 * Implementation note: we stop + restart the MediaRecorder each interval
 * rather than relying on `timeslice`, because timeslice output is not a
 * self-contained container and can't be fed to Whisper directly.
 */
export async function startRecording(
  chunkSeconds: number,
  onChunk: (blob: Blob, startedAt: number, endedAt: number) => void,
  onError: (err: Error) => void,
): Promise<RecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();

  let stopped = false;
  let current: MediaRecorder | null = null;
  let currentStart = Date.now();
  let rotateTimer: ReturnType<typeof setTimeout> | null = null;

  const startLeg = () => {
    if (stopped) return;
    try {
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const parts: BlobPart[] = [];
      const start = Date.now();
      currentStart = start;
      current = rec;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) parts.push(e.data);
      };
      rec.onerror = (e) => onError(new Error(`MediaRecorder error: ${String(e)}`));
      rec.onstop = () => {
        const end = Date.now();
        if (parts.length) {
          const blob = new Blob(parts, { type: mimeType || 'audio/webm' });
          if (blob.size > 0) onChunk(blob, start, end);
        }
        if (!stopped) startLeg();
      };

      rec.start();
      rotateTimer = setTimeout(() => {
        if (rec.state !== 'inactive') rec.stop();
      }, chunkSeconds * 1000);
    } catch (err) {
      onError(err as Error);
    }
  };

  startLeg();

  return {
    stop: () =>
      new Promise<void>((resolve) => {
        stopped = true;
        if (rotateTimer) clearTimeout(rotateTimer);
        const finalize = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve();
        };
        if (current && current.state !== 'inactive') {
          const rec = current;
          const prev = rec.onstop;
          rec.onstop = (ev) => {
            if (prev) (prev as (this: MediaRecorder, ev: Event) => unknown).call(rec, ev);
            finalize();
          };
          rec.stop();
        } else {
          finalize();
        }
        void currentStart;
      }),
  };
}
