import express from "express";
import cors from "cors";
import helmet from "helmet";
import { AuthService, createAuthMiddleware } from "./auth.js";
import type { AppConfig } from "./config.js";
import { getCorsOrigin } from "./config.js";
import type { TalkNestDatabase } from "./database.js";
import { errorHandler, notFoundHandler, ValidationError } from "./errors.js";
import { loginSchema, messageQuerySchema } from "./schemas.js";

export function createApp(deps: { db: TalkNestDatabase; config: AppConfig }) {
  const app = express();
  const authService = new AuthService(deps.db, deps.config);
  const requireAuth = createAuthMiddleware(authService);

  app.use(helmet());
  app.use(
    cors({
      origin: getCorsOrigin(deps.config.corsOrigin),
      credentials: true
    })
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

  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  app.get("/api/messages", requireAuth, (req, res, next) => {
    try {
      if (!req.user) {
        throw new ValidationError("Missing authenticated user");
      }

      const query = messageQuerySchema.parse(req.query);
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
