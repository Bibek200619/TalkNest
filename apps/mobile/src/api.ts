import { API_URL, ROOM_ID } from "./config";
import type { ChatMessage, PublicUser, Session } from "./types";

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

export async function login(identifier: string, password: string): Promise<Session> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ identifier, password })
  });

  return parseResponse<Session>(response, "Unable to log in");
}

export async function fetchCurrentUser(token: string): Promise<PublicUser> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: authHeaders(token)
  });
  const body = await parseResponse<{ user: PublicUser }>(
    response,
    "Unable to restore session"
  );

  return body.user;
}

export async function fetchMessages(token: string): Promise<ChatMessage[]> {
  const response = await fetch(`${API_URL}/api/messages?roomId=${ROOM_ID}`, {
    headers: authHeaders(token)
  });
  const body = await parseResponse<{ messages: ChatMessage[] }>(
    response,
    "Unable to load messages"
  );

  return body.messages;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`
  };
}

async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
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
