Summary: Rework TalkNest around the supplied chat/auth references, add attachment messages with file limits, improve the landing page, and introduce a dark theme controlled from settings or Command/Ctrl+D.

Context: The app currently supports registration/login, text-only Socket.io messages, a simple sidebar inbox, a Vite/Three.js landing page, and persisted sessions. The new references call for a richer desktop chat shell with a nav rail, chat cards, message actions, attachment buttons, and a split registration screen with a purple product preview. Dark mode needs app-level state and a keyboard shortcut. Attachments require backend validation and persistence, not just front-end buttons.

System Impact: `ChatMessage` changes from text-only to text plus optional attachment metadata and base64 payloads. The backend remains the source of truth for allowed file type, size limits, message IDs, room authorization, and timestamps. The mobile app owns theme preference and local file picking, then sends a validated message payload over the existing Socket.io channel. The landing page gets a stronger visual hierarchy and theme-aware polish without changing its deployment contract.

Approach: Extend the current room/message contract instead of adding a parallel upload API. Use Expo Document Picker for image/video/document selection, enforce small MVP payload limits in both client and server, and render attachment cards inside message bubbles. Redesign the auth and chat screens to match the references while preserving existing sign-up, login, handle search, private chat, and lobby flows. Add a settings panel with dark-mode toggle and a global Command/Ctrl+D shortcut. Update the landing page with a richer hero, product preview, layered cards, and reduced-motion-safe CSS transitions.

Changes:
- `apps/server/src/types.ts`, `schemas.ts`, `database.ts`, `socket.ts` - add attachment types, SQLite columns/migration, validation, and socket send support.
- `apps/server/tests/server.test.ts` - cover allowed attachments, size/type rejection, and existing text/direct messaging.
- `apps/mobile/package.json`, `src/types.ts`, `src/storage.ts`, `src/App.tsx`, `src/api.ts` - add theme state, persistence, and attachment types.
- `apps/mobile/src/components/LoginScreen.tsx` - rebuild as split registration/login screen inspired by the second reference.
- `apps/mobile/src/components/ChatScreen.tsx` and `MessageBubble.tsx` - rebuild as nav rail + chat list + conversation panel, add settings, dark mode, attachment picker/actions, and richer attachment rendering.
- `apps/web/src/App.tsx`, `styles.css`, and `components/TalkNestScene.tsx` if needed - make the landing page less flat with product preview layers, stronger sectioning, theme-aware visuals, and subtle reduced-motion-safe transitions.
- `README.md` - document attachment limits, supported file types, dark mode, and shortcut.

Verification:
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run verify`
- `npm run test:visual:web`
- Manual smoke: register two users, open a private chat, send text, send an allowed image/video/document under the limit, confirm rejected file types/sizes return errors, toggle dark mode in settings and with Command/Ctrl+D, and open the landing page CTA.
