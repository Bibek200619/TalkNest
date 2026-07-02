import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { io as createClient, type Socket } from "socket.io-client";
import { createRuntime } from "../src/runtime.js";
import { loadConfig } from "../src/config.js";
import { getDirectRoomId } from "../src/rooms.js";
import type { ChatMessage } from "../src/types.js";

const testConfig = loadConfig({
  PORT: "0",
  JWT_SECRET: "talknest-test-secret",
  CORS_ORIGIN: "*",
  DATABASE_PATH: ":memory:",
  MESSAGE_MAX_LENGTH: "1000",
});

type TestSession = {
  token: string;
  user: {
    id: string;
    username: string;
    handle: string;
    displayName: string;
    email: string;
  };
};

describe("TalkNest server", () => {
  let runtime: ReturnType<typeof createRuntime>;
  let baseUrl: string;

  beforeEach(async () => {
    runtime = createRuntime(testConfig);
    await new Promise<void>((resolve) => runtime.httpServer.listen(0, resolve));
    const address = runtime.httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await runtime.close();
  });

  it("does not seed demo users", async () => {
    const response = await request(runtime.httpServer)
      .post("/api/auth/login")
      .send({ identifier: "alex", password: "password123" })
      .expect(401);

    expect(response.body.error.message).toBe("Invalid login details");
  });

  it("registers a user and then logs in with the same credentials", async () => {
    const registered = await registerUser({
      username: "priya",
      handle: "priya",
      email: "priya@talknest.test",
      displayName: "Priya Shah",
    });

    expect(registered.token).toEqual(expect.any(String));
    expect(registered.user).toMatchObject({
      username: "priya",
      handle: "priya",
      email: "priya@talknest.test",
      displayName: "Priya Shah",
    });

    const loggedIn = await login("priya");
    expect(loggedIn.user.id).toBe(registered.user.id);
  });

  it("rejects duplicate handles during registration", async () => {
    await registerUser({
      username: "first",
      handle: "shared",
      email: "first@talknest.test",
      displayName: "First User",
    });

    const response = await request(runtime.httpServer)
      .post("/api/auth/register")
      .send({
        username: "second",
        handle: "@shared",
        email: "second@talknest.test",
        displayName: "Second User",
        password: "password123",
      })
      .expect(409);

    expect(response.body.error.message).toBe("Handle is already taken");
  });

  it("lists public users with handles", async () => {
    const priya = await registerUser({
      username: "priya",
      handle: "priya",
      email: "priya@talknest.test",
      displayName: "Priya Shah",
    });
    await registerUser({
      username: "noah",
      handle: "noah",
      email: "noah@talknest.test",
      displayName: "Noah Kim",
    });

    const response = await request(runtime.httpServer)
      .get("/api/users")
      .set("Authorization", `Bearer ${priya.token}`)
      .expect(200);

    expect(response.body.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          username: "noah",
          handle: "noah",
          displayName: "Noah Kim",
        }),
      ]),
    );
  });

  it("resolves personal conversations by handle", async () => {
    const priya = await registerUser({
      username: "priya",
      handle: "priya",
      email: "priya@talknest.test",
      displayName: "Priya Shah",
    });
    const noah = await registerUser({
      username: "noah",
      handle: "noah",
      email: "noah@talknest.test",
      displayName: "Noah Kim",
    });

    const response = await request(runtime.httpServer)
      .post("/api/direct-conversations/resolve")
      .set("Authorization", `Bearer ${priya.token}`)
      .send({ handle: "@noah" })
      .expect(200);

    expect(response.body.conversation).toMatchObject({
      roomId: getDirectRoomId(priya.user.id, noah.user.id),
      type: "direct",
      participant: {
        handle: "noah",
        displayName: "Noah Kim",
      },
    });
  });

  it("rejects invalid login details", async () => {
    await registerUser({
      username: "priya",
      handle: "priya",
      email: "priya@talknest.test",
      displayName: "Priya Shah",
    });

    const response = await request(runtime.httpServer)
      .post("/api/auth/login")
      .send({ identifier: "priya", password: "bad-password" })
      .expect(401);

    expect(response.body.error.message).toBe("Invalid login details");
  });

  it("requires authentication for message history", async () => {
    await request(runtime.httpServer).get("/api/messages").expect(401);
  });

  it("broadcasts socket messages with server timestamps", async () => {
    const priya = await registerUser({
      username: "priya",
      handle: "priya",
      email: "priya@talknest.test",
      displayName: "Priya Shah",
    });
    const noah = await registerUser({
      username: "noah",
      handle: "noah",
      email: "noah@talknest.test",
      displayName: "Noah Kim",
    });

    const priyaSocket = await connectSocket(priya.token);
    const noahSocket = await connectSocket(noah.token);
    const received = waitForMessage(noahSocket);

    const ack = await emitMessage(priyaSocket, {
      roomId: "lobby",
      text: "Hello from Priya",
    });

    expect(ack.ok).toBe(true);
    const message = await received;

    expect(message).toMatchObject({
      senderId: priya.user.id,
      senderName: "Priya Shah",
      text: "Hello from Priya",
      type: "text",
      roomId: "lobby",
    });
    expect(Date.parse(message.timestamp)).not.toBeNaN();

    priyaSocket.close();
    noahSocket.close();
  });

  it("does not accept empty socket messages", async () => {
    const priya = await registerUser({
      username: "priya",
      handle: "priya",
      email: "priya@talknest.test",
      displayName: "Priya Shah",
    });
    const socket = await connectSocket(priya.token);

    const ack = await emitMessage(socket, {
      roomId: "lobby",
      text: "   ",
    });

    expect(ack).toEqual({ ok: false, error: "Message cannot be empty" });
    socket.close();
  });

  it("broadcasts allowed attachment messages", async () => {
    const priya = await registerUser({
      username: "priya",
      handle: "priya",
      email: "priya@talknest.test",
      displayName: "Priya Shah",
    });
    const noah = await registerUser({
      username: "noah",
      handle: "noah",
      email: "noah@talknest.test",
      displayName: "Noah Kim",
    });
    const priyaSocket = await connectSocket(priya.token);
    const noahSocket = await connectSocket(noah.token);
    const received = waitForMessage(noahSocket);

    const ack = await emitMessage(priyaSocket, {
      roomId: "lobby",
      text: "Design notes attached",
      attachment: {
        kind: "document",
        fileName: "brief.pdf",
        mimeType: "application/pdf",
        size: 128,
        dataUrl: "data:application/pdf;base64,JVBERi0xLjQ=",
      },
    });

    expect(ack.ok).toBe(true);
    const message = await received;

    expect(message).toMatchObject({
      senderId: priya.user.id,
      text: "Design notes attached",
      type: "attachment",
      roomId: "lobby",
      attachment: {
        kind: "document",
        fileName: "brief.pdf",
        mimeType: "application/pdf",
        size: 128,
      },
    });

    const history = await request(runtime.httpServer)
      .get("/api/messages")
      .set("Authorization", `Bearer ${noah.token}`)
      .query({ roomId: "lobby" })
      .expect(200);

    expect(history.body.messages[0]).toMatchObject({
      type: "attachment",
      attachment: {
        fileName: "brief.pdf",
      },
    });

    priyaSocket.close();
    noahSocket.close();
  });

  it("rejects unsupported and oversized attachments", async () => {
    const priya = await registerUser({
      username: "priya",
      handle: "priya",
      email: "priya@talknest.test",
      displayName: "Priya Shah",
    });
    const socket = await connectSocket(priya.token);

    await expect(
      emitMessage(socket, {
        roomId: "lobby",
        attachment: {
          kind: "document",
          fileName: "script.sh",
          mimeType: "application/x-sh",
          size: 20,
          dataUrl: "data:application/x-sh;base64,ZWNobyBoaQ==",
        },
      }),
    ).resolves.toEqual({ ok: false, error: "Unsupported attachment type" });

    await expect(
      emitMessage(socket, {
        roomId: "lobby",
        attachment: {
          kind: "document",
          fileName: "huge.pdf",
          mimeType: "application/pdf",
          size: 3 * 1024 * 1024,
          dataUrl: "data:application/pdf;base64,JVBERi0xLjQ=",
        },
      }),
    ).resolves.toEqual({
      ok: false,
      error: "Attachment exceeds 2 MB limit",
    });

    socket.close();
  });

  it("broadcasts direct messages only in the resolved personal room", async () => {
    const priya = await registerUser({
      username: "priya",
      handle: "priya",
      email: "priya@talknest.test",
      displayName: "Priya Shah",
    });
    const noah = await registerUser({
      username: "noah",
      handle: "noah",
      email: "noah@talknest.test",
      displayName: "Noah Kim",
    });
    const roomId = await resolveDirectRoom(priya.token, "@noah");

    const priyaSocket = await connectSocket(priya.token);
    const noahSocket = await connectSocket(noah.token);

    await expect(joinRoom(priyaSocket, roomId)).resolves.toEqual({
      ok: true,
      roomId,
    });
    await expect(joinRoom(noahSocket, roomId)).resolves.toEqual({
      ok: true,
      roomId,
    });

    const received = waitForMessage(noahSocket);
    const ack = await emitMessage(priyaSocket, {
      roomId,
      text: "Private hello",
    });

    expect(ack.ok).toBe(true);
    const message = await received;

    expect(message).toMatchObject({
      senderId: priya.user.id,
      senderName: "Priya Shah",
      text: "Private hello",
      type: "text",
      roomId,
    });

    const history = await request(runtime.httpServer)
      .get("/api/messages")
      .set("Authorization", `Bearer ${noah.token}`)
      .query({ roomId })
      .expect(200);

    expect(history.body.messages).toHaveLength(1);
    expect(history.body.messages[0]).toMatchObject({
      text: "Private hello",
      roomId,
    });

    priyaSocket.close();
    noahSocket.close();
  });

  it("rejects nonparticipants from personal conversations", async () => {
    const priya = await registerUser({
      username: "priya",
      handle: "priya",
      email: "priya@talknest.test",
      displayName: "Priya Shah",
    });
    await registerUser({
      username: "noah",
      handle: "noah",
      email: "noah@talknest.test",
      displayName: "Noah Kim",
    });
    const li = await registerUser({
      username: "li",
      handle: "li",
      email: "li@talknest.test",
      displayName: "Li Wang",
    });
    const roomId = await resolveDirectRoom(priya.token, "noah");
    const liSocket = await connectSocket(li.token);

    await request(runtime.httpServer)
      .get("/api/messages")
      .set("Authorization", `Bearer ${li.token}`)
      .query({ roomId })
      .expect(403);

    await expect(joinRoom(liSocket, roomId)).resolves.toEqual({
      ok: false,
      error: "You do not have access to this conversation",
    });
    await expect(
      emitMessage(liSocket, {
        roomId,
        text: "Trying to enter",
      }),
    ).resolves.toEqual({
      ok: false,
      error: "You do not have access to this conversation",
    });

    liSocket.close();
  });

  async function registerUser(input: {
    username: string;
    handle: string;
    email: string;
    displayName: string;
  }) {
    const response = await request(runtime.httpServer)
      .post("/api/auth/register")
      .send({ ...input, password: "password123" })
      .expect(201);

    return response.body as TestSession;
  }

  async function login(identifier: string) {
    const response = await request(runtime.httpServer)
      .post("/api/auth/login")
      .send({ identifier, password: "password123" })
      .expect(200);

    return response.body as TestSession;
  }

  async function resolveDirectRoom(token: string, handle: string) {
    const response = await request(runtime.httpServer)
      .post("/api/direct-conversations/resolve")
      .set("Authorization", `Bearer ${token}`)
      .send({ handle })
      .expect(200);

    return response.body.conversation.roomId as string;
  }

  async function connectSocket(token: string) {
    const socket = createClient(baseUrl, {
      auth: { token },
      reconnection: false,
      transports: ["websocket"],
    });

    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });

    return socket;
  }

  function waitForMessage(socket: Socket) {
    return new Promise<ChatMessage>((resolve) => {
      socket.once("message:new", resolve);
    });
  }

  function joinRoom(socket: Socket, roomId: string) {
    return new Promise<
      { ok: true; roomId: string } | { ok: false; error: string }
    >((resolve) => {
      socket.emit("room:join", { roomId }, resolve);
    });
  }

  function emitMessage(
    socket: Socket,
    payload: {
      roomId: string;
      text?: string;
      attachment?: {
        kind: "image" | "video" | "document";
        fileName: string;
        mimeType: string;
        size: number;
        dataUrl: string;
      };
    },
  ) {
    return new Promise<
      { ok: true; message: ChatMessage } | { ok: false; error: string }
    >((resolve) => {
      socket.emit("message:send", payload, resolve);
    });
  }
});
