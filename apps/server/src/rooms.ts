export const LOBBY_ROOM_ID = "lobby";

const DIRECT_ROOM_PREFIX = "dm:";

export function normalizeHandle(handle: string) {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

export function formatHandle(handle: string) {
  return `@${normalizeHandle(handle)}`;
}

export function getDirectRoomId(firstUserId: string, secondUserId: string) {
  const [first, second] = [firstUserId, secondUserId].sort();
  return `${DIRECT_ROOM_PREFIX}${first}:${second}`;
}

export function parseDirectRoomId(roomId: string) {
  if (!roomId.startsWith(DIRECT_ROOM_PREFIX)) {
    return null;
  }

  const participantIds = roomId.slice(DIRECT_ROOM_PREFIX.length).split(":");

  if (participantIds.length !== 2 || participantIds.some((id) => !id)) {
    return null;
  }

  const [firstUserId, secondUserId] = participantIds;
  return { firstUserId, secondUserId, participantIds };
}
