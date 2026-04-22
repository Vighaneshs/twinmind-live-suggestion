# Vigh's Assistant

A real-time meeting co-pilot. Three columns: live transcript on the left, contextual suggestion cards in the middle, and a grounded chat on the right.

```
Give executable permission
./dev.sh        # starts both servers; see Setup below
```

---

## Notes
Data is not persisted, to allow proper testing. Reload reloads everything. 

A reinforcement learning approach based on the embeddings of the card content could be explored. For now, I just give the context of what the last 5 things clicked by user were. 
Moreover, more recent suggestions are the one user will focus on during a meeting since the latest context is more important. 

Web-search can be enabled/disabled


## Setup

**Prerequisites:** Node 20+, a [Groq API key](https://console.groq.com), optionally a [Tavily API key](https://tavily.com) for live web search on fact-checks.

```bash
# 1. Clone and install
git clone <repo>
cd twinmind

# 2. Configure back-end
cp back-end/.env.example back-end/.env
# Edit back-end/.env - paste TAVILY_API_KEY (leave blank to disable web search)

# 3. Start everything
./dev.sh
# front-end: http://localhost:5173
# back-end:  http://localhost:8080
```

On first load, the Settings modal opens automatically. Paste your Groq API key and click **Test key**. Then hit **Capture Notes** to start recording.

To run each service independently:

```bash
cd front-end && npm run dev
cd back-end  && npm run dev
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Browser (Vite + React)                     │
│                                             │
│  Transcript  │  Suggestions  │  Chat        │
│  (Whisper)   │  (gpt-oss-120b│  (gpt-oss-   │
│              │   + search)   │   120b)      │
└──────┬───────────────┬───────────────┬──────┘
       │               │               │
       │   (direct)    │  /api/search  │   (direct)
       │               │               │
       ▼               ▼               ▼
    Groq API      Back-end        Groq API
    (Whisper)     (Fastify)       (chat)
                      │
                  Tavily API
```

This split is intentional and temporary. The plan is to move Groq calls server-side too (for key security, retries, caching), at which point `front-end/src/lib/groq.ts` becomes a thin fetch wrapper without touching any component.

---

## Prompt strategy

### Context block structure
Every suggestion call receives a user message structured into labeled blocks with an explicit priority order:

```
[MEETING LEDGER]       running facts, entities, decisions, open questions
[OLDER CONTEXT]        compressed transcript older than ~2 minutes
[RECENT TRANSCRIPT]    last ~2 minutes, verbatim
[RECENTLY SAID]        the final ~20-30 seconds - PRIMARY TRIGGER
[PREVIOUS BATCH]       titles + previews already returned this session
```

The model is instructed to ground every card in `[RECENTLY SAID]`. If a suggestion can't be tied to a specific phrase in that block, it's dropped. `[RECENT TRANSCRIPT]` provides disambiguating context. `[OLDER CONTEXT]` and `[MEETING LEDGER]` are background, the model should not surface them unless `[RECENTLY SAID]` directly references them.

This layering solves the staleness problem: new transcript arrivals naturally shift what's in `[RECENTLY SAID]`, so each batch is about *what just happened*, not the topic as a whole.

### The meeting ledger
A separately-maintained running snapshot of the session, updated on each new transcript chunk:

```json
{
  "entities":       ["Slack", "MAU", "Q3"],
  "facts":          ["MAU hit 4M in Q3", "launched in 2019"],
  "decisions":      ["shipping with Postgres, not Mongo"],
  "open_questions": ["who owns the onboarding flow?"]
}
```
This helps model ground the truth to what has been discussed, so that the result is more appropriate and accurate.

In production, this could be a knowledge graph. A knowledge graph could be maintained for the session.

The ledger is maintained by its own lightweight model call (`DEFAULT_LEDGER_PROMPT`) with strict rules: entries must be ≤ 12 words, concrete (not topical), deduplicated, and capped at 20 items per category. Open questions are automatically resolved and moved to `facts` or `decisions` when the transcript answers them.

The ledger feeds into both suggestion and detail-answer calls as fast background context. Its value is deduplication across batches, the model can see what has already been surfaced and avoid repeating it without being sent the entire chat history every time.

### State-machine suggestion routing
Before choosing which three cards to return, the model classifies the conversational state from the tail of `[RECENTLY SAID]`:

| State | Dominant card types |
|-------|-------------------|
| `question_pending` | `answer` first, then supporting cards |
| `claim_made` | `fact_check` first |
| `jargon_or_acronym` | `clarification` first |
| `brainstorm` | `talking_point` + `question` |
| `decision_point` | `question` that surfaces the tradeoff |
| `drift_or_stall` | sharp re-focus `question` + `talking_point`s |

The mapping is a strong prior, not a hard rule, the model can deviate when context demands. A batch of three `fact_check` cards is fine if three claims just landed. The state classification is included in the JSON response (`"state": "claim_made"`) for potential logging and eval later.

### User interest signal
Inspired from reinforcement learning, a sophisticated algorithm (NLP + Recommendation) could be (researched) applied if the data is persisted. 

Every suggestion batch also receives a `[USER INTERESTS]` block listing the titles of the last 5 cards the user clicked. The motivation: card type (question, fact_check, etc.) is a weak signal for what the user finds useful. The content is what they're actually engaging with. Tracking clicked titles and passing them as a soft bias lets the model skew toward topics the user has shown interest in, without hard-filtering or over-constraining the output.

### Web search arbitration
Naively sending every suggestion call through a web search adds 1–3 seconds of latency and burns Tavily credits on questions that don't need them ("what is REST?" doesn't need a search; "Anthropic's Series E valuation" does).

We solve this with a cheap arbitration step: before calling Tavily, a small model call (`DEFAULT_WEB_QUERY_PROMPT`) decides whether web search would materially improve the answer and, if so, generates up to two targeted queries. The rule is deliberately aggressive for named entities, "when in doubt, search", because the model cannot know what it doesn't know about fast-moving companies, products, and APIs. It's conservative for well-established general concepts.

The arbitration call is fast (small output, no streaming), and the savings in avoided Tavily calls pay for it within a few sessions.

### Detail answers: Anchor → Expand → Cite
When a user taps a card, the detail prompt follows a three-step structure:

1. **Anchor**, locate and quote 1–2 verbatim lines from the full transcript that triggered the card (with line numbers). This keeps the answer grounded and auditable.
2. **Expand**, produce a response whose shape depends on card type: fact-checks state what was claimed + the correction; answers lead with the direct answer then add supporting bullets; questions provide the exact wording to say out loud plus a rationale.
3. **Cite**, if web sources were returned by the search arbitration step, cite them inline as `[1]`, `[2]`. When sources disagree or contradict the transcript, the model is instructed to call that out explicitly and weight by source authority (wire services and government/academic sources over opinion and forums).


---

## Tradeoffs

### Context size for suggestions
Focus is on recent transcript. 
Assume its 5 minute total at 400 wpm (commentators/auctuneers) ~ 2000 words ~ 2700 tokens 
Biggest prompt ~ 1500 token
Total ~ 4200 tokens
GPT-OSS-120B has 128k context size => 124k tokens preserved for context. 

But still bigger context cause problems like lost in the middle, slower inference.
So, suggestions never use full context window

[MEETING LEDGER] - Strict size rules, only facts. ~ 4000 tokens
[OLDER CONTEXT] - limited, we already have meeting ledger, we don't need whole of the older context. ~ 6000 tokens
[RECENT TRANSCRIPT] - This is only last 2 minutes. ~ 1100 tokens
[RECENTLY SAID] - This is the last 30 seconds, very important ~ 300 tokens
[PREVIOUS BATCH] - previously returned suggestions ~ 2000 tokens

Total tokens used for suggestions ~ 16000 tokens (VERY SAFE)

### Context size for detailed chat (RAG vs direct feeding into context)
Now, the detailed chat can definitely use all the transcript according to our logic. As it tries to find the sentence of the transcript. 
Assume, a big meeting. 3 hours ~ 180 minutes ~ 180*550 ~ 100,000 tokens (commentators/auctuneers) ~ grok has 128k context windows. We are walking on edge.
Direct feeding into context is faster than Retrieval overhead. 
For a production system, retrieval can be done from a RAG architecture with transcript 10-20sec windows, using a vector store, when data is persisted. 

Worst case calculations.
Assuming 400 wpm (commentators/auctuneers)  ~ 550 tokens PER Minute. ~=  275 tokens per 30 seconds
Assume, a big meeting. 3 hours ~ 180 minutes ~ 180*550 ~ 100,000 tokens ~ gpt-OSS-120B has 128k context length length.

### Web-search overhead for detailed chat
It is important to fact-check from reliable outputs. LLMs have knowledge cut-offs. 


### 30 seconds is a good window for refresh
This helps generate suggestions which actually help the user. Assuming, at least 5 sntences are spoken. This is gives enough context for a conversation, without missing things.

### JSON-mode for suggestions, no streaming.
The suggestion call uses `response_format: { type: 'json_object' }` to get deterministic structured output. Streaming suggestions is tempting but counterproductive, partial JSON is unparseable, and partial card renders cause layout jitter.
This jitter can distract the user in an actual meeting.
Chat responses stream normally since token-by-token render is the right UX for prose.

### Suggestions don't fire on empty transcript.
Better than repeating similar suggestions, or giving the one considered worse than previous, 

---

## Stack choices

Most of the product logic (transcription, suggestions, chat, ledger) lives in the front-end. The back-end does one thing: proxy Tavily so the API key never touches the client. This is a deliberate prototype trade-off. Moving fast without standing up auth, queues, or a database. The migration path is straightforward: add `/api/transcribe`, `/api/suggest`, `/api/chat` routes to the Fastify server and swap the direct Groq calls in `groq.ts` for fetch calls to those routes, with no component changes required.

### Front-end

**Vite** This is a single-page app with no server-rendered content. It is a simple front-end framework

**Zustand** Three columns need shared state: transcript, suggestion batches, chat history, settings, and a handful of flags. Zustand gives a flat store, selector-based subscriptions, and no boilerplate. The entire session store is 80 lines, while Redux would be 300+.

**Tailwind CSS.** CSS but easier

### Back-end

**Fastify** Faster, has native TypeScript type inference for route schemas, and the plugin model is cleaner. For a service that'll grow into a proper API, the discipline Fastify enforces early is worth it.

**Tavily for web search.** Tavily returns pre-summarized snippets (lower token cost when feeding to an LLM), has the cleanest API for this use case, and handles query-to-snippet condensation server-side.

**Source re-ranking in `sources.ts`.** Tavily's default ranking optimises for relevance to the query, not source authority. For fact-checks specifically, a result from `reuters.com` beats `medium.com` even if the latter is more "relevant" by embedding cosine similarity. We apply a hard deny list (forums, PR wire services, listicle farms) and an allow list (Reuters, AP, NIH, Wikipedia, arxiv, etc.) before returning results. `.gov`/`.edu`/`.int` TLDs get a softer bonus. This runs in microseconds server-side and meaningfully improves citation quality.

### Models

| Job | Model |
|-----|-------|
| Transcription | `whisper-large-v3` |
| Suggestions + chat | `openai/gpt-oss-120b` via Groq |

---