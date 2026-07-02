Summary: Make the left navigation functional, add independent collapse controls for the app rail and chat list sidebar, and turn Settings into a real editable profile/preferences area.

Context: The current Expo app already has auth, direct conversations by handle, a nav rail, chat list, settings theme toggle, and attachment messages. The nav rail items mostly act as static visuals, and profile fields are immutable after registration because the backend only exposes user reads.

System Impact: Profile display name, username, handle, and email become editable backend-owned data. The mobile session remains the client source of truth for the current user after saves, while collapsible sidebar state and selected app section remain local UI state. Updating a handle affects future direct-chat lookup, but existing direct room IDs remain stable because they are user-id based.

Approach: Add a focused authenticated profile update endpoint with the same uniqueness/validation rules as registration, then refresh local session/user state after saves. In the mobile chat shell, add `activeSection`, `navCollapsed`, and `inboxCollapsed` state, render useful section panels for Home, Contacts, Notifications, Calendar, and Settings, and expose one collapse button per sidebar using chevron icon buttons.

Changes:
- `apps/server/src/schemas.ts`, `database.ts`, `auth.ts`, `http.ts`, `tests/server.test.ts` - add profile update validation, uniqueness checks, persistence, route, and tests.
- `apps/mobile/src/types.ts`, `api.ts`, `App.tsx`, `storage.ts` - add profile update input/API and update the persisted session user after settings saves.
- `apps/mobile/src/components/ChatScreen.tsx` - make nav sections functional, add independent sidebar collapse controls, and add editable profile settings plus theme controls.
- `README.md` - document editable settings and sidebar controls.

Verification:
- `npm run verify`
- `npm run test:visual:web`
- Expo web smoke: load app, open/collapse both sidebars, visit each nav section, edit settings, and confirm the updated profile appears in the rail.
