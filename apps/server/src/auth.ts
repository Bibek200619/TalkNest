import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { toPublicUser, type TalkNestDatabase } from "./database.js";
import { ConflictError, UnauthorizedError } from "./errors.js";
import type { AppConfig } from "./config.js";
import { normalizeHandle } from "./rooms.js";
import type { RegisterInput } from "./schemas.js";
import type { AuthTokenPayload, PublicUser } from "./types.js";

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

export class AuthService {
  constructor(
    private readonly db: TalkNestDatabase,
    private readonly config: AppConfig,
  ) {}

  login(identifier: string, password: string) {
    const user = this.db.findUserByIdentifier(identifier);

    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      throw new UnauthorizedError("Invalid login details");
    }

    return this.createSession(toPublicUser(user));
  }

  register(input: RegisterInput) {
    const username = input.username.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();
    const handle = normalizeHandle(input.handle);

    if (this.db.findUserByUsername(username)) {
      throw new ConflictError("Username is already taken");
    }

    if (this.db.findUserByHandle(handle)) {
      throw new ConflictError("Handle is already taken");
    }

    if (this.db.findUserByEmail(email)) {
      throw new ConflictError("Email is already registered");
    }

    const user = this.db.createUser({
      username,
      email,
      handle,
      displayName: input.displayName,
      passwordHash: bcrypt.hashSync(input.password, 10),
    });

    return this.createSession(toPublicUser(user));
  }

  private createSession(publicUser: PublicUser) {
    const token = jwt.sign(
      {
        sub: publicUser.id,
        username: publicUser.username,
        handle: publicUser.handle,
        displayName: publicUser.displayName,
      } satisfies AuthTokenPayload,
      this.config.jwtSecret,
      { expiresIn: "7d" },
    );

    return { token, user: publicUser };
  }

  verifyToken(token: string): PublicUser {
    try {
      const payload = jwt.verify(
        token,
        this.config.jwtSecret,
      ) as AuthTokenPayload;
      const user = this.db.findUserById(payload.sub);

      if (!user) {
        throw new UnauthorizedError("Session user no longer exists");
      }

      return toPublicUser(user);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }

      throw new UnauthorizedError("Invalid or expired session");
    }
  }
}

export function createAuthMiddleware(authService: AuthService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");

      if (!token) {
        throw new UnauthorizedError("Missing session token");
      }

      req.user = authService.verifyToken(token);
      next();
    } catch (error) {
      next(error);
    }
  };
}
