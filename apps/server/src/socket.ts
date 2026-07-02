import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { AuthService } from "./auth.js";
import type { AppConfig } from "./config.js";
import { getCorsOrigin } from "./config.js";
import type { TalkNestDatabase } from "./database.js";
import { LOBBY_ROOM_ID } from "./rooms.js";
import { messageInputSchema, roomJoinSchema } from "./schemas.js";

type SendAck =
  | { ok: true; message: ReturnType<TalkNestDatabase["createMessage"]> }
  | { ok: false; error: string };

type RoomJoinAck = { ok: true; roomId: string } | { ok: false; error: string };

export function createSocketServer(deps: {
  httpServer: HttpServer;
  db: TalkNestDatabase;
  authService: AuthService;
  config: AppConfig;
}) {
  const io = new SocketIOServer(deps.httpServer, {
    cors: {
      origin: getCorsOrigin(deps.config.corsOrigin),
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token =
        typeof socket.handshake.auth.token === "string"
          ? socket.handshake.auth.token
          : socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, "");

      if (!token) {
        return next(new Error("Missing session token"));
      }

      socket.data.user = deps.authService.verifyToken(token);
      next();
    } catch (error) {
      next(
        error instanceof Error
          ? error
          : new Error("Socket authentication failed"),
      );
    }
  });

  io.on("connection", (socket) => {
    const roomId = LOBBY_ROOM_ID;
    socket.join(roomId);
    socket.emit("socket:ready", {
      roomId,
      user: socket.data.user,
    });

    socket.on(
      "room:join",
      (payload: unknown, ack?: (response: RoomJoinAck) => void) => {
        const parsed = roomJoinSchema.safeParse(payload ?? { roomId });

        if (!parsed.success) {
          ack?.({ ok: false, error: "Invalid room" });
          return;
        }

        if (
          !deps.db.canUserAccessRoom(socket.data.user.id, parsed.data.roomId)
        ) {
          ack?.({
            ok: false,
            error: "You do not have access to this conversation",
          });
          return;
        }

        socket.join(parsed.data.roomId);
        socket.emit("room:joined", { roomId: parsed.data.roomId });
        ack?.({ ok: true, roomId: parsed.data.roomId });
      },
    );

    socket.on(
      "message:send",
      (payload: unknown, ack?: (response: SendAck) => void) => {
        const parsed = messageInputSchema.safeParse(payload);

        if (!parsed.success) {
          ack?.({
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Message cannot be empty",
          });
          return;
        }

        if (
          !deps.db.canUserAccessRoom(socket.data.user.id, parsed.data.roomId)
        ) {
          ack?.({
            ok: false,
            error: "You do not have access to this conversation",
          });
          return;
        }

        if (parsed.data.text.length > deps.config.messageMaxLength) {
          ack?.({
            ok: false,
            error: `Message must be ${deps.config.messageMaxLength} characters or less`,
          });
          return;
        }

        try {
          const message = deps.db.createMessage({
            sender: socket.data.user,
            text: parsed.data.text,
            roomId: parsed.data.roomId,
            attachment: parsed.data.attachment,
          });

          io.to(parsed.data.roomId).emit("message:new", message);
          ack?.({ ok: true, message });
        } catch (error) {
          console.error(error);
          ack?.({ ok: false, error: "Message failed to send" });
        }
      },
    );
  });

  return io;
}
