## ResumeBase Gmail OTP MCP Server

Minimal MCP server exposing tools to store a user's Gmail refresh token and fetch the latest OTP email from a label (default `ResumeBase/OTP`).

### Prereqs
- Enable Gmail API in GCP, create OAuth2 Web Client.
- Copy `.env.example` to `.env` and set values:
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `ENCRYPTION_KEY_BASE64` a 32-byte key base64-encoded (e.g., `openssl rand -base64 32`)
  - `LABEL_NAME` optional, defaults to `ResumeBase/OTP`

### Install
```bash
npm install
npm run build
```

### Run (stdio)
```bash
npm start
```

### Tools
- set_refresh_token: `{ userId, refreshToken }` → stores encrypted token to `data/<userId>.token`.
- get_email_otp: `{ userId, issuer?, maxAgeSec? }` → `{ status, code?, receivedAt?, issuer? }`.

### Label/filter (optional)
Create Gmail label `ResumeBase/OTP` and a filter routing OTP mails to it for higher accuracy.


