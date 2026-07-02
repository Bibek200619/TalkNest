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

  it("logs in a seeded user and returns a token", async () => {
    const response = await request(runtime.httpServer)
      .post("/api/auth/login")
      .send({ identifier: "alex", password: "password123" })
      .expect(200);

    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({
      username: "alex",
      handle: "alex",
      displayName: "Alex Rivera",
    });
  });

  it("lists public users with handles", async () => {
    const alex = await login("alex");

    const response = await request(runtime.httpServer)
      .get("/api/users")
      .set("Authorization", `Bearer ${alex.token}`)
      .expect(200);

    expect(response.body.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          username: "mira",
          handle: "mira",
          displayName: "Mira Chen",
        }),
      ]),
    );
  });

  it("resolves personal conversations by handle", async () => {
    const alex = await login("alex");

    const response = await request(runtime.httpServer)
      .post("/api/direct-conversations/resolve")
      .set("Authorization", `Bearer ${alex.token}`)
      .send({ handle: "@mira" })
      .expect(200);

    expect(response.body.conversation).toMatchObject({
      roomId: getDirectRoomId("user-alex", "user-mira"),
      type: "direct",
      participant: {
        handle: "mira",
        displayName: "Mira Chen",
      },
    });
  });

  it("rejects invalid login details", async () => {
    const response = await request(runtime.httpServer)
      .post("/api/auth/login")
      .send({ identifier: "alex", password: "bad-password" })
      .expect(401);

    expect(response.body.error.message).toBe("Invalid login details");
  });

  it("requires authentication for message history", async () => {
    await request(runtime.httpServer).get("/api/messages").expect(401);
  });

  it("broadcasts socket messages with server timestamps", async () => {
    const alex = await login("alex");
    const mira = await login("mira");

    const alexSocket = await connectSocket(alex.token);
    const miraSocket = await connectSocket(mira.token);
    const received = waitForMessage(miraSocket);

    const ack = await emitMessage(alexSocket, {
      roomId: "lobby",
      text: "Hello from Alex",
    });

    expect(ack.ok).toBe(true);
    const message = await received;

    expect(message).toMatchObject({
      senderId: alex.user.id,
      senderName: "Alex Rivera",
      text: "Hello from Alex",
      type: "text",
      roomId: "lobby",
    });
    expect(Date.parse(message.timestamp)).not.toBeNaN();

    alexSocket.close();
    miraSocket.close();
  });

  it("does not accept empty socket messages", async () => {
    const alex = await login("alex");
    const socket = await connectSocket(alex.token);

    const ack = await emitMessage(socket, {
      roomId: "lobby",
      text: "   ",
    });

    expect(ack).toEqual({ ok: false, error: "Message cannot be empty" });
    socket.close();
  });

  it("broadcasts direct messages only in the resolved personal room", async () => {
    const alex = await login("alex");
    const mira = await login("mira");
    const roomId = await resolveDirectRoom(alex.token, "@mira");

    const alexSocket = await connectSocket(alex.token);
    const miraSocket = await connectSocket(mira.token);

    await expect(joinRoom(alexSocket, roomId)).resolves.toEqual({
      ok: true,
      roomId,
    });
    await expect(joinRoom(miraSocket, roomId)).resolves.toEqual({
      ok: true,
      roomId,
    });

    const received = waitForMessage(miraSocket);
    const ack = await emitMessage(alexSocket, {
      roomId,
      text: "Private hello",
    });

    expect(ack.ok).toBe(true);
    const message = await received;

    expect(message).toMatchObject({
      senderId: alex.user.id,
      senderName: "Alex Rivera",
      text: "Private hello",
      type: "text",
      roomId,
    });

    const history = await request(runtime.httpServer)
      .get("/api/messages")
      .set("Authorization", `Bearer ${mira.token}`)
      .query({ roomId })
      .expect(200);

    expect(history.body.messages).toHaveLength(1);
    expect(history.body.messages[0]).toMatchObject({
      text: "Private hello",
      roomId,
    });

    alexSocket.close();
    miraSocket.close();
  });

  it("rejects nonparticipants from personal conversations", async () => {
    const alex = await login("alex");
    const sam = await login("sam");
    const roomId = await resolveDirectRoom(alex.token, "mira");
    const samSocket = await connectSocket(sam.token);

    await request(runtime.httpServer)
      .get("/api/messages")
      .set("Authorization", `Bearer ${sam.token}`)
      .query({ roomId })
      .expect(403);

    await expect(joinRoom(samSocket, roomId)).resolves.toEqual({
      ok: false,
      error: "You do not have access to this conversation",
    });
    await expect(
      emitMessage(samSocket, {
        roomId,
        text: "Trying to enter",
      }),
    ).resolves.toEqual({
      ok: false,
      error: "You do not have access to this conversation",
    });

    samSocket.close();
  });

  async function login(username: string) {
    const response = await request(runtime.httpServer)
      .post("/api/auth/login")
      .send({ identifier: username, password: "password123" })
      .expect(200);

    return response.body as {
      token: string;
      user: {
        id: string;
        username: string;
        handle: string;
        displayName: string;
        email: string;
      };
    };
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
    payload: { roomId: string; text: string },
  ) {
    return new Promise<
      { ok: true; message: ChatMessage } | { ok: false; error: string }
    >((resolve) => {
      socket.emit("message:send", payload, resolve);
    });
  }
});
