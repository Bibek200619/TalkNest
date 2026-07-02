# TalkNest

TalkNest is a full-stack real-time chat MVP built from the PRD. It includes an Expo React Native app, a Node.js Socket.io backend, SQLite persistence, JWT login, timestamps generated on the server, and a Vite/Three.js landing page.

## Apps

- `apps/server` - Express, Socket.io, JWT auth, SQLite via `node:sqlite`, Zod validation, and integration tests.
- `apps/mobile` - Expo React Native login and chat app with persisted sessions, message history, live updates, logout, and connection state.
- `apps/web` - Vite React landing page with a responsive Three.js hero scene.

## Requirements

- Node.js `>=22.5.0`
- npm

`node:sqlite` is currently experimental in Node, so the server may print an experimental warning during tests or startup.

## Setup

```bash
npm install
cp apps/server/.env.example apps/server/.env
```

Demo users are seeded automatically:

- `alex` / `password123`
- `mira` / `password123`
- `sam` / `password123`

## Run Locally

Start all runtimes:

```bash
npm run dev
```

Useful individual commands:

```bash
npm run dev:server
npm run dev:web
npm run dev:mobile
```

Default URLs:

- Backend API: `http://localhost:4000`
- Landing page: `http://localhost:5173`
- Expo web/mobile dev server: shown by Expo in the terminal

For a physical device, set the mobile app API URL to a LAN-reachable backend:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:4000 npm run dev:mobile
```

## Verification

```bash
npm run typecheck
npm run test
npm run build
npm run verify
```

Visual validation for the Three.js landing page requires the web dev server:

```bash
npm run dev:web
npm run test:visual:web
```

The visual check saves screenshots in `apps/web/artifacts/` and verifies that the Three.js canvas is not blank on desktop and mobile viewports.

## Vercel Deployment

This repository is configured to deploy the Vite landing page to Vercel from the repo root.

```bash
npm run deploy:vercel
```

The Vercel build uses:

- Build command: `npm run build -w @talknest/web`
- Output directory: `apps/web/dist`
- Config file: `vercel.json`

The real-time chat backend should be deployed separately to a long-running Node host because Socket.io WebSockets and SQLite persistence are not a good fit for Vercel serverless functions. After the backend is hosted, point the mobile app to it with `EXPO_PUBLIC_API_URL`.

## API

- `GET /health` - service health
- `POST /api/auth/login` - returns `{ token, user }`
- `GET /api/auth/me` - validates a bearer token
- `GET /api/messages?roomId=lobby` - returns recent room messages

Socket.io events:

- Client emits `message:send` with `{ roomId, text }`
- Server broadcasts `message:new` with message ID, sender, text, type, room, and timestamp
- Server emits `socket:ready` after authenticated connection
