# CUA Desktop

This directory contains the Electron-based desktop application for CUA.

## Structure

- `electron/` - Main Electron application
  - `src/` - TypeScript source code
  - `dist/` - Built JavaScript files
  - `package.json` - Desktop-specific dependencies and scripts

## Development

### Prerequisites

Make sure you have the following installed:
- Node.js (v18 or higher)
- pnpm

### Setup

1. Install dependencies from the workspace root:
   ```bash
   pnpm install
   ```

2. Build the desktop app:
   ```bash
   pnpm build:desktop
   ```

### Running

#### Development Mode (with hot reload)
```bash
# From workspace root
pnpm dev:desktop

# Or from desktop/electron directory
pnpm dev:desktop
```

#### Production Mode
```bash
# From workspace root
pnpm start:desktop

# Or from desktop/electron directory
pnpm start
```

### Building for Distribution

```bash
# From workspace root
pnpm build:desktop

# Or from desktop/electron directory
pnpm dist
```

## Architecture

The desktop app consists of:
- **Left Panel**: Next.js web application (your UI)
- **Right Panel**: Embedded browser view for web browsing
- **IPC Communication**: Navigation handling between panels

## Environment Variables

- `UI_URL`: Override the default UI URL (defaults to http://localhost:3000)

## Notes

- The app exposes CDP on port 9222 for Playwright testing
- User data is persisted in `~/.cua-desktop`
- The web app should be running on port 3000 for development
