import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { io as createClient, type Socket } from "socket.io-client";
import { createRuntime } from "../src/runtime.js";
import { loadConfig } from "../src/config.js";
import type { ChatMessage } from "../src/types.js";

const testConfig = loadConfig({
  PORT: "0",
  JWT_SECRET: "talknest-test-secret",
  CORS_ORIGIN: "*",
  DATABASE_PATH: ":memory:",
  MESSAGE_MAX_LENGTH: "1000"
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
      displayName: "Alex Rivera"
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
      text: "Hello from Alex"
    });

    expect(ack.ok).toBe(true);
    const message = await received;

    expect(message).toMatchObject({
      senderId: alex.user.id,
      senderName: "Alex Rivera",
      text: "Hello from Alex",
      type: "text",
      roomId: "lobby"
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
      text: "   "
    });

    expect(ack).toEqual({ ok: false, error: "Message cannot be empty" });
    socket.close();
  });

  async function login(username: string) {
    const response = await request(runtime.httpServer)
      .post("/api/auth/login")
      .send({ identifier: username, password: "password123" })
      .expect(200);

    return response.body as {
      token: string;
      user: { id: string; username: string; displayName: string; email: string };
    };
  }

  async function connectSocket(token: string) {
    const socket = createClient(baseUrl, {
      auth: { token },
      reconnection: false,
      transports: ["websocket"]
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

  function emitMessage(
    socket: Socket,
    payload: { roomId: string; text: string }
  ) {
    return new Promise<{ ok: true; message: ChatMessage } | { ok: false; error: string }>(
      (resolve) => {
        socket.emit("message:send", payload, resolve);
      }
    );
  }
});
