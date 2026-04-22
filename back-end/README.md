# TwinMind - back-end

A small Fastify/TypeScript service that sits between the front-end and external APIs. Currently it proxies **Tavily web search** so the frontend can enrich fact-check suggestions with real citations, without exposing the Tavily key in the browser.

## Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check. Returns `{ ok: true, tavilyEnabled: bool }` |
| `GET` | `/api/config` | Tells the front-end which features are active (e.g. `tavilyEnabled`) |
| `POST` | `/api/search` | Proxy Tavily search, re-rank by source authority, return top results |

### `POST /api/search`

**Request body**
```json
{ "queries": ["string", "string"] }
```
Up to 2 queries are run in parallel. Excess queries are silently dropped.

**Response**
```json
{
  "results": [
    { "title": "...", "url": "https://...", "snippet": "..." }
  ]
}
```
- Up to 6 results total, sorted by source authority (see [Source ranking](#source-ranking)).
- If `TAVILY_API_KEY` is not set: `{ "results": [], "disabled": true }`.
- On Tavily upstream error: HTTP 502, `{ "results": [], "error": "upstream_failed" }`.

## Quickstart

```bash
cd back-end
cp .env.example .env      # fill in TAVILY_API_KEY
npm install
npm run dev               # http://localhost:8080
```

Or run both front-end and back-end together from the repo root:

```bash
./dev.sh
# front-end: http://localhost:5173
# back-end:  http://localhost:8080
```

## Environment variables

Defined in `.env` (copy from `.env.example`):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TAVILY_API_KEY` | Yes (for search) | - | Get one at [tavily.com](https://tavily.com). Leave blank to disable search; the service still starts. |
| `PORT` | No | `8080` | Port to listen on |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origin(s). In production, set to your front-end URL. |
| `TAVILY_EXCLUDE_DOMAINS` | No | - | Comma-separated domains to append to the built-in clickbait deny list |
| `TAVILY_INCLUDE_DOMAINS` | No | - | Comma-separated domains to append to the built-in authority allow list (boosts ranking, does not restrict search) |
| `TAVILY_STRICT_INCLUDE_DOMAINS` | No | - | If set, Tavily ONLY searches these domains. Use sparingly, can starve results. |

## Source ranking

Results from Tavily are re-ranked by `authorityScore()` in [`src/sources.ts`](src/sources.ts) before being returned.

- **+100**, domains on the curated allow list (Reuters, Wikipedia, NIH, arxiv.org, etc.)
- **+60 / +55 / +50**, `.gov`, `.int`, `.edu` TLDs
- **+10**, `.org` TLDs
- **0**, everything else
- **−100** (hard deny), domains on the clickbait/low-quality deny list (Reddit, Pinterest, PRNewswire, etc.)

Hard-denied results are filtered out before ranking. This list is curated in `sources.ts` and can be extended at runtime via the `TAVILY_EXCLUDE_DOMAINS` / `TAVILY_INCLUDE_DOMAINS` env vars.

## Project structure

```
back-end/
├── src/
│   ├── server.ts          # Fastify app, CORS, route registration
│   ├── env.ts             # Env var parsing and exports
│   ├── tavily.ts          # Tavily client: searchOne() + searchMany()
│   ├── sources.ts         # Domain allow/deny lists + authorityScore()
│   └── routes/
│       ├── config.ts      # GET /api/config
│       └── search.ts      # POST /api/search
├── .env.example
├── package.json
└── tsconfig.json
```

## Scripts

```bash
npm run dev        # tsx watch, restarts on file changes
npm run start      # tsx one-shot (for simple prod deploy)
npm run build      # tsc compile to dist/
npm run typecheck  # type-check without emit
```
