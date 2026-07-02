Summary: Add user handles and handle-based personal chat to TalkNest. The backend remains the source of truth for public handles, direct conversation room IDs, message authorization, and message timestamps; the mobile app adds a handle picker so users can open private threads.

Context: Current users have unique usernames but no explicit public handle field. REST exposes login, current user, and shared lobby history; Socket.io accepts any room ID and sends all messages through the shared `roomId` contract. The mobile app loads one fixed lobby room from `ROOM_ID`, connects one socket, and renders all incoming messages into the current list.

System Impact: Public users gain a unique `handle` shown as `@handle`. Direct messages use deterministic room IDs derived by the server from the two participant user IDs. REST history and socket joins/sends must authorize direct rooms so only the two participants can load, join, or send to that personal thread. The mobile app will track the active conversation and only render socket messages for that conversation.

Approach: Keep the existing `roomId` message contract and extend it instead of creating a separate direct-message transport. Add handle lookup and direct-room helpers on the backend, expose authenticated user listing plus handle resolution, and add authorization before REST history, `room:join`, and `message:send`. Update the mobile chat screen with a compact handle selector, lobby/direct conversation state, and per-room message loading.

Changes:

- `apps/server/src/types.ts` - add `handle` to public/auth user types and define direct conversation response shape.
- `apps/server/src/rooms.ts` - add pure helpers for handle normalization and deterministic direct room IDs.
- `apps/server/src/database.ts` - add/migrate `users.handle`, seed demo handles, expose handle lookup, list public users, and direct-room access checks.
- `apps/server/src/schemas.ts` - add handle resolution schema and keep room/message validation bounded.
- `apps/server/src/http.ts` - add `GET /api/users`, `POST /api/direct-conversations/resolve`, and enforce message history authorization.
- `apps/server/src/socket.ts` - authorize direct `room:join` and `message:send` requests before joining or broadcasting.
- `apps/server/tests/server.test.ts` - cover handles, user listing, direct room resolution, direct message delivery, and nonparticipant rejection.
- `apps/mobile/src/types.ts` and `apps/mobile/src/api.ts` - add handle/direct conversation types and API calls.
- `apps/mobile/src/components/ChatScreen.tsx` - add lobby/direct switching, handle entry, user chips, per-room history loading, and message filtering by active room.
- `README.md` - document demo handles, personal chat flow, new REST endpoints, and socket room authorization.

Verification:

- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run verify`
- Manual smoke: log in as `alex`, open `@mira`, send a private message, log in as `mira`, open `@alex`, confirm history and live messages; confirm `sam` cannot load or send into the Alex/Mira room.
