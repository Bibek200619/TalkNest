Summary: Convert TalkNest into a non-demo app by adding real registration, redesigning the chat UI around a left conversation sidebar, and linking the landing page directly into the app.

Context: The backend currently seeds `alex`, `mira`, and `sam` on startup, and tests rely on those demo accounts. The mobile app has a top header plus horizontal user chips, which does not match the requested WhatsApp-like sidebar layout. The landing page still describes demo credentials and only links to page sections instead of the main app.

System Impact: User records become user-created data rather than boot-time demo data. Auth gains a registration path that creates a unique username, handle, email, display name, and password hash, then returns the same session shape as login. The chat UI derives its sidebar contacts from the authenticated user directory and the active room selected by the user. The landing page has a configurable app URL so local and hosted environments can point users to the app runtime.

Approach: Keep the existing JWT/session and room contracts, remove demo seeding, and add `POST /api/auth/register`. Update tests to create users explicitly before login, direct messaging, and socket assertions. Redesign the Expo chat screen with a desktop/tablet left sidebar and responsive mobile behavior. Update the landing page copy and CTAs to open the app instead of advertising seeded users.

Changes:

- `apps/server/src/database.ts` - remove seeded demo users, add user creation with uniqueness checks, and keep existing handle migration.
- `apps/server/src/auth.ts` - add registration that creates a user and returns a JWT session.
- `apps/server/src/schemas.ts` and `apps/server/src/http.ts` - add validated `POST /api/auth/register`.
- `apps/server/tests/server.test.ts` - replace seeded-user assumptions with explicit test account creation.
- `apps/mobile/src/api.ts`, `apps/mobile/src/types.ts`, `apps/mobile/src/App.tsx`, and `apps/mobile/src/components/LoginScreen.tsx` - add sign-up mode and registration API.
- `apps/mobile/src/components/ChatScreen.tsx` - replace the top chip layout with a WhatsApp-style left sidebar, conversation list, search/open-handle field, account footer, and right-side chat panel.
- `apps/web/src/App.tsx` and `apps/web/src/styles.css` - add configurable app link, update CTA/nav copy, and remove demo-credential content.
- `README.md` - document sign-up, app links, and the non-demo local setup.

Verification:

- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run verify`
- Live smoke: register two users, open one from the sidebar by handle, send a direct message, and confirm landing CTA opens the app URL.
