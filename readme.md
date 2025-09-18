<div align="center">

# resumebase — open source job agent
## demo
<img src="web/public/rb%20gif.gif" alt="resumebase demo" width="720" />

</div>

i graduated last december. it took 6 months of grinding applications and endless rejections to land a role.

the market is brutal. the process is broken. it’s not just about jobs — it’s about survival. so i started building.

- first, applymate: a chrome extension to personalize resumes.
- now, resumebase: a job agent that reads the job, rewrites your resume, fills forms, and applies for you.

right now it works: you drop a resume and a job link — it applies. it still needs job search, recommendations, custom resumes, verification. i’m open‑sourcing it so we can build it together.

## what it does today
- starts a cloud browser via browserbase and runs a stagehand agent
- reads a job description, navigates, fills forms, and applies
- streams a live viewer url so you can watch the session
- exposes a raw recording events api

## roadmap (help wanted)
- job search and sourcing
- recommendations and ranking
- custom resume generation per job
- verification and audit trail
- replay ui and annotations
- provider abstraction (openai, google, others)

## project structure
```
resumebase/
├── web/                 # Next.js app (UI + API)
│   ├── src/app/api/     # session, upload, oauth, otp endpoints
│   ├── src/components/  # UI (shadcn/ui)
│   └── src/lib/         # utils, logging, crypto
├── .github/             # issues, PR template, CI
├── LICENSE              # MIT
└── README.md            # this file
```

## quick start
prereqs: node 18+, pnpm, api keys for browserbase and a model provider.

```bash
cd web
pnpm install
cp env.example .env.local # open and fill values as needed
pnpm dev
# open http://localhost:3000
```

minimal `.env.local` for google genai:
```env
BROWSERBASE_API_KEY=...
BROWSERBASE_PROJECT_ID=...
GOOGLE_API_KEY=...
GOOGLE_MODEL=gemini-1.5-flash
```

see `web/SETUP.md` for all options (openai supported too).

## contributing
- read CONTRIBUTING.md and CODE_OF_CONDUCT.md
- good first issues: docs, replay ui, provider abstraction, form reliability
- open a pr with a clear description and screenshots where relevant

## security
please report vulnerabilities via github security advisories. see SECURITY.md.

## license
mit © 2025 uday savitha. see LICENSE.

## credits
- browserbase, stagehand, shadcn/ui, next.js, tailwind

## notes
this repo currently uses a slightly altered stagehand package. you can find the fork here: `https://github.com/udaysvc/stagehand/tree/changes`.