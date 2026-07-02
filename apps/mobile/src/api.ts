import { API_URL, ROOM_ID } from "./config";
import type {
  ChatMessage,
  DirectConversation,
  PublicUser,
  Session,
} from "./types";

type ErrorResponse = {
  error?: {
    message?: string;
  };
};

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function login(
  identifier: string,
  password: string,
): Promise<Session> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ identifier, password }),
  });

  return parseResponse<Session>(response, "Unable to log in");
}

export async function fetchCurrentUser(token: string): Promise<PublicUser> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: authHeaders(token),
  });
  const body = await parseResponse<{ user: PublicUser }>(
    response,
    "Unable to restore session",
  );

  return body.user;
}

export async function fetchUsers(token: string): Promise<PublicUser[]> {
  const response = await fetch(`${API_URL}/api/users`, {
    headers: authHeaders(token),
  });
  const body = await parseResponse<{ users: PublicUser[] }>(
    response,
    "Unable to load users",
  );

  return body.users;
}

export async function resolveDirectConversation(
  token: string,
  handle: string,
): Promise<DirectConversation> {
  const response = await fetch(`${API_URL}/api/direct-conversations/resolve`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ handle }),
  });
  const body = await parseResponse<{ conversation: DirectConversation }>(
    response,
    "Unable to open conversation",
  );

  return body.conversation;
}

export async function fetchMessages(
  token: string,
  roomId = ROOM_ID,
): Promise<ChatMessage[]> {
  const url = new URL(`${API_URL}/api/messages`);
  url.searchParams.set("roomId", roomId);
  const response = await fetch(url.toString(), {
    headers: authHeaders(token),
  });
  const body = await parseResponse<{ messages: ChatMessage[] }>(
    response,
    "Unable to load messages",
  );

  return body.messages;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function parseResponse<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  let body: ErrorResponse | T | null = null;

  try {
    body = (await response.json()) as T | ErrorResponse;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && body.error?.message
        ? body.error.message
        : fallback;
    throw new ApiError(message);
  }

  return body as T;
}
