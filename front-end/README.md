# Vigh's Assistant

A three-column live meeting co-pilot, powered entirely by [Groq](https://console.groq.com):

- **Left , Transcript.** Start/stop the mic; Whisper transcribes ~30-second chunks and appends them live (auto-scrolls).
- **Middle , Live suggestions.** Every ~30s (and on-demand) the model reads the recent transcript and emits **3 tappable cards** whose previews are useful on their own. Types mix dynamically , `question`, `talking_point`, `answer`, `fact_check`, `clarification` , based on what is actually happening in the conversation. Older batches stay visible below newer ones.
- **Right , Chat.** Tap a card for a detailed, streamed answer grounded in the transcript. Or type your own question. One continuous session, no login, no persistence across reloads.

Plus: JSON/TXT session export with timestamps, and a full Settings screen to tune models, prompts, context windows, and chunk/refresh cadence.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS
- Zustand (session state)
- `groq-sdk` (browser, user's key)
- Models (all editable in Settings):
  - Transcription: `whisper-large-v3`
  - Suggestions + Chat: `openai/gpt-oss-120b`

## Quickstart

```bash
npm install
npm run dev
# open http://localhost:5173
```

On first load, the Settings modal opens. Paste your Groq API key (get one at [console.groq.com](https://console.groq.com)) and click **Test key**. The key is stored only in this browser's `localStorage` , it never leaves your machine.

Then press **Start mic** in the left column. After ~30s you'll see your first transcript chunk + first suggestion batch.

## Exporting

Top-right **Export ▾** downloads the whole session , transcript chunks, every suggestion batch (with per-batch timestamps), and the full chat , as **JSON** (machine-readable) or **TXT** (human-readable).

## Project layout

```
src/
  App.tsx                       3-column layout + modal + toasts
  main.tsx                      React entry
  index.css                     Tailwind + scrollbar styling
  lib/
    types.ts                    Transcript / Suggestion / Chat / Settings types
    prompts.ts                  Default prompts (exported so Settings can reset to them)
    groq.ts                     transcribeChunk / suggest / answerDetailed / chatStream
    recorder.ts                 MediaRecorder wrapper , rotates to produce 30s self-contained blobs
    export.ts                   JSON + TXT builders + downloadFile helper
  store/
    session.ts                  Zustand store (single source of truth) + DEFAULT_SETTINGS
  components/
    Header.tsx                  Brand, recording pill, Export, Settings button
    TranscriptColumn.tsx        Mic toggle + auto-scrolling list
    SuggestionsColumn.tsx       30s loop + manual refresh + batch rendering
    SuggestionCard.tsx          Tappable card w/ type chip + preview
    ChatColumn.tsx              Streamed messages + composer
    SettingsModal.tsx           API key, models, prompts, context windows, cadence
    ExportButton.tsx            JSON / TXT dropdown
    Toasts.tsx                  Minimal toast surface
```

## Configuration

Everything is in the Settings modal (⚙ top-right):

- **API key** , Groq key, kept in localStorage only.
- **Models** , swap to any other Groq model (e.g. `llama-3.3-70b-versatile`).
- **Chunk length / refresh interval** , defaults match the spec at 30s each.
- **Suggestion context chars** (default 4000) , how much recent transcript feeds the suggestion prompt.
- **Detail / chat context chars** (default 12000) , how much feeds the deep-answer and chat prompts.
- **Three prompts** , live-suggestion, detailed-answer-on-click, chat. Each has a **Reset to default** link.

The default suggestion prompt (see [src/lib/prompts.ts](src/lib/prompts.ts)) instructs the model to infer the current conversational state from the transcript and weight the mix of suggestion types accordingly , so when a question is asked you tend to get an `answer` first, when a claim is made you get a `fact_check`, and during open brainstorming you get sharper `talking_point`s and `question`s.

## Design choices

- **Groq calls go directly from the browser** using the user's own key. This is the simplest path for a prototype and the brief explicitly allows it. When the backend ships, only [src/lib/groq.ts](src/lib/groq.ts) needs to change , components and store are untouched.
- **Self-contained audio chunks.** The recorder stops + restarts every `chunkSeconds` rather than using `timeslice`, because only self-contained blobs can be fed to Whisper directly. This gives a clean "new chunk ≈ new transcript line" cadence.
- **JSON-mode suggestions.** The suggestion call uses `response_format: { type: 'json_object' }` so parsing is deterministic; invalid responses are defensively coerced.
- **Streamed chat.** Detail answers and chat use `stream: true` for responsive UX. Suggestions are intentionally *not* streamed , the 3-card batch renders at once so the layout doesn't jitter.

## Scripts

- `npm run dev` , Vite dev server
- `npm run build` , Typecheck + production build
- `npm run preview` , Serve the production build
- `npm run typecheck` , TS only
