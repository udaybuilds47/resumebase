# contributing to resumebase

thanks for your interest in improving resumebase! contributions of all kinds are welcome: code, docs, design, product, and testing.

## ways to contribute
- fix bugs or implement roadmap items
- improve form-filling reliability and observability
- add provider support (openai, google, others)
- build the replay ui for recordings
- improve docs and setup

## development setup
```bash
# Enable corepack if needed
pnpm -v || corepack enable

cd web
pnpm install
cp SETUP.md .env.local  # then edit values
pnpm dev
# open http://localhost:3000
```

## project structure
see README.md and ARCHITECTURE.md for details.

## commit and pr guidelines
- create a feature branch from `main`
- write clear commit messages
- add tests or screenshots where applicable
- keep prs focused and small where possible
- ensure `pnpm lint` and `pnpm build` pass locally

## code style
- use typescript and prefer strictness
- prefer clear names and early returns
- avoid catching without meaningful handling
- follow eslint and existing formatting

## reporting bugs
use the bug report template. include steps, expected vs actual, logs (`web/logs/*`), and environment details.

## security issues
do not open a public issue. see SECURITY.md for private reporting instructions.

## license
by contributing, you agree your contributions are licensed under the mit license.
