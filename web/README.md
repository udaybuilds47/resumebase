<div align="center">

# resumebase — current implementation

</div>

## Overview
- Next.js app that starts a Browserbase cloud browser and a Stagehand agent.
- Agent uses Stagehand Open Operator (sequential tool calling) to act on a user‑provided URL.
- API returns a live viewer URL so you can watch the session immediately while the agent continues in the background.
- Recording events are exposed via API (no replay UI included here).

## Tech Stack
- Next.js 15, React 19
- Stagehand + Browserbase

## Directory
```
web/
├─ next.config.ts                    # Next server externals (pino, thread-stream)
├─ package.json                      # Scripts (disable pino workers), deps
└─ src/
   └─ app/
      ├─ api/
      │  └─ session/route.ts        # POST start run, GET recording
      └─ page.tsx                   # URL input, start, live viewer
```

## End‑to‑End Flow
1) User pastes a URL on the home page and clicks Apply.
2) UI calls `POST /api/session` with `{ url }` (or `jobUrl`/`prompt`).
3) API initializes Stagehand → Browserbase, then returns `{ runId, sessionId, viewerUrl }` immediately.
4) UI embeds `viewerUrl` in an `<iframe>` so you can watch live.
5) In the background, the agent runs `stagehand.agent().execute(...)` and the session is closed at the end.
6) Recording can be fetched via `GET /api/session?sessionId=...` (consumer UI not included).

## API
### POST /api/session
Request body (any one works):
```json
{ "url": "https://example.com/apply" }
{ "jobUrl": "https://example.com/apply" }
{ "prompt": "Go to https://example.com/apply and complete the application" }
```
Response:
```json
{ "runId": "uuid", "sessionId": "id", "viewerUrl": "https://..." }
```
Behavior:
- Starts Stagehand and returns immediately (non‑blocking via queueMicrotask).
- Executes the agent with `maxSteps: 25` and `autoScreenshot: true`.

### GET /api/session?sessionId=...
Response:
```json
{ "events": [ /* rrweb events from Browserbase */ ] }
```

## Configuration (env)
Required:
- `BROWSERBASE_API_KEY`
- `BROWSERBASE_PROJECT_ID`
- One provider (choose Google or OpenAI):
  - Google: `GOOGLE_API_KEY`, `GOOGLE_MODEL`
  - OpenAI: `OPENAI_API_KEY`, `OPENAI_MODEL` (fallback default is `openai/gpt-4o-mini`)
Optional:
- `ALLOWLIST` — comma‑separated domains to constrain navigation

## System Prompt (current)
Applied in the API route for every step:
- Only navigate within `ALLOWLIST` (or ask for an allowed domain if not set)
- Ask for missing info before proceeding
- Never bypass login/paywalls/CAPTCHA/MFA
- Prefer visible text/role over brittle CSS selectors
- When a task implies a list, return JSON only
- Once complete, issue a `close` step and stop

## Runtime Config
- `next.config.ts`: `serverExternalPackages: ['pino', 'thread-stream']`
- `package.json` scripts prepend: `PINO_WORKER_THREADS=false PINO_WORKER_THREADS_ENABLED=false`
  (avoids thread‑stream worker issues in Next’s server runtime)

## UI Notes (`src/app/page.tsx`)
- Sends `{ url }` to `POST /api/session`
- Expects `{ runId, sessionId, viewerUrl }`
- Renders `viewerUrl` in an `<iframe>` live viewer
- A “Stop Session” button is present; server‑side stop is not implemented in the single‑route API (non‑blocking for current flow)

## Behavior & Limitations
- Agent acts sequentially (think → act → observe). Long forms may require higher `maxSteps` and clearer instructions.
- `autoScreenshot: true` improves visibility but adds latency.
- No replay UI yet (only raw events endpoint).

## Local Development
```bash
cd web
npm install
npm run dev
# open http://localhost:3000
```

## Reference
- Stagehand — Open Operator (sequential tool calling): https://docs.stagehand.dev/best-practices/build-agent#sequential-tool-calling-open-operator
