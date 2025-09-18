<div align="center">

# resumebase — current implementation

</div>

## overview
- next.js app that starts a browserbase cloud browser and a stagehand agent.
- agent uses stagehand open operator (sequential tool calling) to act on a user‑provided url.
- api returns a live viewer url so you can watch the session immediately while the agent continues in the background.
- recording events are exposed via api (no replay ui included here).

## tech stack
- next.js 15, react 19
- stagehand + browserbase

## directory
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

## end‑to‑end flow
1) user pastes a url on the home page and clicks apply.
2) ui calls `post /api/session` with `{ url }` (or `jobUrl`/`prompt`).
3) api initializes stagehand → browserbase, then returns `{ runId, sessionId, viewerUrl }` immediately.
4) ui embeds `viewerurl` in an `<iframe>` so you can watch live.
5) in the background, the agent runs `stagehand.agent().execute(...)` and the session is closed at the end.
6) recording can be fetched via `get /api/session?sessionId=...` (consumer ui not included).

## api
### post /api/session
request body (any one works):
```json
{ "url": "https://example.com/apply" }
{ "jobUrl": "https://example.com/apply" }
{ "prompt": "Go to https://example.com/apply and complete the application" }
```
response:
```json
{ "runId": "uuid", "sessionId": "id", "viewerUrl": "https://..." }
```
behavior:
- starts stagehand and returns immediately (non‑blocking via queuemicrotask).
- executes the agent with `maxsteps: 25` and `autoscreenshot: true`.

### get /api/session?sessionid=...
response:
```json
{ "events": [ /* rrweb events from Browserbase */ ] }
```

## configuration (env)
required:
- `BROWSERBASE_API_KEY`
- `BROWSERBASE_PROJECT_ID`
- one provider (choose google or openai):
  - google: `GOOGLE_API_KEY`, `GOOGLE_MODEL`
  - openai: `OPENAI_API_KEY`, `OPENAI_MODEL` (fallback default is `openai/gpt-4o-mini`)
optional:
- `ALLOWLIST` — comma‑separated domains to constrain navigation
- `BROWSER_WIDTH` — browser viewport width (default: 1920)
- `BROWSER_HEIGHT` — browser viewport height (default: 1080)

## system prompt (current)
applied in the api route for every step:
- only navigate within `ALLOWLIST` (or ask for an allowed domain if not set)
- ask for missing info before proceeding
- never bypass login/paywalls/captcha/mfa
- prefer visible text/role over brittle css selectors
- when a task implies a list, return json only
- once complete, issue a `close` step and stop

## runtime config
- `next.config.ts`: `serverExternalPackages: ['pino', 'thread-stream']`
- `package.json` scripts prepend: `PINO_WORKER_THREADS=false PINO_WORKER_THREADS_ENABLED=false`
  (avoids thread‑stream worker issues in next’s server runtime)

## ui notes (`src/app/page.tsx`)
- sends `{ url }` to `post /api/session`
- expects `{ runId, sessionId, viewerUrl }`
- renders `viewerurl` in an `<iframe>` live viewer
- a “stop session” button is present; server‑side stop is not implemented in the single‑route api (non‑blocking for current flow)

## behavior & limitations
- agent acts sequentially (think → act → observe). long forms may require higher `maxsteps` and clearer instructions.
- `autoscreenshot: true` improves visibility but adds latency.
- no replay ui yet (only raw events endpoint).

## local development
```bash
cd web
npm install
npm run dev
# open http://localhost:3000
```

## reference
- stagehand — open operator (sequential tool calling): https://docs.stagehand.dev/best-practices/build-agent#sequential-tool-calling-open-operator
- project readme: ../README.md
- contributing: ../CONTRIBUTING.md
- code of conduct: ../CODE_OF_CONDUCT.md
 - stagehand fork used in this repo: https://github.com/udaysvc/stagehand/tree/changes
