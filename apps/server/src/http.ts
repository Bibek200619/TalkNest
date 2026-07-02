import express from "express";
import cors from "cors";
import helmet from "helmet";
import { AuthService, createAuthMiddleware } from "./auth.js";
import type { AppConfig } from "./config.js";
import { getCorsOrigin } from "./config.js";
import type { TalkNestDatabase } from "./database.js";
import {
  errorHandler,
  ForbiddenError,
  NotFoundError,
  notFoundHandler,
  ValidationError,
} from "./errors.js";
import {
  directConversationSchema,
  loginSchema,
  messageQuerySchema,
  registerSchema,
} from "./schemas.js";

export function createApp(deps: { db: TalkNestDatabase; config: AppConfig }) {
  const app = express();
  const authService = new AuthService(deps.db, deps.config);
  const requireAuth = createAuthMiddleware(authService);

  app.use(helmet());
  app.use(
    cors({
      origin: getCorsOrigin(deps.config.corsOrigin),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "talknest-server" });
  });

  app.post("/api/auth/login", (req, res, next) => {
    try {
      const input = loginSchema.parse(req.body);
      const session = authService.login(input.identifier, input.password);
      res.json(session);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/register", (req, res, next) => {
    try {
      const input = registerSchema.parse(req.body);
      const session = authService.register(input);
      res.status(201).json(session);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  app.get("/api/users", requireAuth, (_req, res) => {
    res.json({ users: deps.db.listUsers() });
  });

  app.post(
    "/api/direct-conversations/resolve",
    requireAuth,
    (req, res, next) => {
      try {
        if (!req.user) {
          throw new ValidationError("Missing authenticated user");
        }

        const input = directConversationSchema.parse(req.body);
        const conversation = deps.db.resolveDirectConversation(
          req.user,
          input.handle,
        );

        if (!conversation) {
          throw new NotFoundError("Handle not found");
        }

        res.json({ conversation });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get("/api/messages", requireAuth, (req, res, next) => {
    try {
      if (!req.user) {
        throw new ValidationError("Missing authenticated user");
      }

      const query = messageQuerySchema.parse(req.query);

      if (!deps.db.canUserAccessRoom(req.user.id, query.roomId)) {
        throw new ForbiddenError("You do not have access to this conversation");
      }

      const messages = deps.db.listMessages(query.roomId, query.limit);
      res.json({ messages });
    } catch (error) {
      next(error);
    }
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, authService };
}
