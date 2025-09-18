# architecture

resumebase consists of a next.js app that starts a browserbase cloud browser and runs a stagehand agent to complete job application flows.

## components
- web (next.js 15, react 19): ui and api routes
- stagehand agent: sequential tool-calling operator
- browserbase: managed chrome sessions with live viewer and recording

## high-level flow
1. user submits a job url (and optionally a resume or prompt)
2. api route starts a browserbase session and returns a live `viewerurl`
3. agent executes steps (navigate, read, fill, upload, submit)
4. recording events are stored and retrievable (raw endpoint exists)

## api overview
- `post /api/session`: start a run → returns `{ runId, sessionId, viewerUrl }`
- `get /api/session?sessionId=...`: fetch raw recording events
- `post /api/upload`: upload resume (for current run)
- `get /api/oauth/gmail/status`: example provider integration

## configuration
see `web/SETUP.md` and readme for environment variables. provider can be google genai or openai.

## future directions
- job search/sourcing service
- solidifying account creation and verification with email
- custom resume creation for each job application auto created
- provider abstraction and prompt libraries
- replay ui and analytics
- verification and audit trail
