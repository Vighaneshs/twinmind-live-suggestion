import { serializeLedger, updateLedger } from './groq';
import { transcriptSince, useSession } from '../store/session';

let inFlight = false;

/**
 * Non-blocking ledger refresh. Called fire-and-forget from the suggestion
 * path. Dedupes concurrent runs via `inFlight` and debounces by the number
 * of new transcript chunks since the last successful run.
 */
export async function maybeUpdateLedger(force = false): Promise<void> {
  if (inFlight) return;
  const s = useSession.getState();
  if (!s.settings.apiKey) return;

  const totalChunks = s.transcript.length;
  const sinceIdx = s.ledgerUpdatedAtChunkIdx;
  const newChunks = totalChunks - sinceIdx;
  if (!force && newChunks < Math.max(1, s.settings.ledgerUpdateChunks)) return;
  if (newChunks <= 0) return;

  const newText = transcriptSince(sinceIdx);
  if (!newText.trim()) return;

  inFlight = true;
  try {
    const next = await updateLedger(s.ledger, newText, s.settings);
    useSession.getState().setLedger(serializeLedger(next));
  } catch (err) {
    console.warn('Ledger update failed:', (err as Error).message);
  } finally {
    inFlight = false;
  }
}
