Summary: Build TalkNest as a greenfield full-stack product from the PRD: a real-time chat backend, an Expo React Native mobile app, and an animated 3D web landing page. Use a TypeScript monorepo so the apps can evolve together while keeping the MVP simple.

Context: The repository currently contains `PRD.md`, `README.md`, `CODEX.md`, Supabase config, and no app source. `CODEX.md` requires using applicable `.agents` skills, a plan/execute/test/commit tempo, and `rtk`-prefixed shell commands from the AGENTS instruction. The PRD requires login, session persistence, Socket.io messaging, server timestamps, logout, connection handling, mobile-first UI, and an animated 3D landing page.

System Impact: The backend becomes the source of truth for authentication, message validation, message IDs, and timestamps. The mobile app owns local UI state and persisted session state, but it must derive authenticated chat access from backend tokens. Socket.io becomes the real-time transport, with REST used for login, session validation, and initial message history. The landing page is separate from the app runtime and only markets the product.

Approach: Create a monorepo with `apps/server`, `apps/mobile`, and `apps/web`. The server uses Express, Socket.io, JWT, SQLite persistence, Zod validation, and bcrypt password hashes. The mobile app uses Expo React Native with AsyncStorage, Socket.io Client, touch-friendly screens, clear sent/received bubbles, timestamps, empty/loading/error states, and logout. The web app uses Vite, React, and Three.js for a responsive animated 3D hero.

Changes:
- `package.json` - root workspaces and scripts for dev, build, typecheck, test, and verification.
- `tsconfig.base.json` - shared TypeScript defaults.
- `apps/server/*` - Node/Express/Socket.io backend with auth, SQLite persistence, message validation, socket events, health check, tests, and env sample.
- `apps/mobile/*` - Expo React Native app with landing/login/chat screens, persisted session, connection state, Socket.io messaging, timestamps, and mobile UI.
- `apps/web/*` - Vite React landing page with animated Three.js scene and responsive marketing content.
- `README.md` - setup, demo credentials, run commands, architecture, and testing instructions.
- `.gitignore` - project-generated files such as `node_modules`, build output, SQLite data, logs, and Expo/Vite caches.

Verification:
- `npm install`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run verify`
- Manual smoke: start server, open the mobile app on web or device, log in as two demo users, send messages both ways, confirm timestamps, auto-scroll, logout, invalid-login errors, empty-message blocking, and reconnection status.
