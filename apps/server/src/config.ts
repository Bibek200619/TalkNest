import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(0).default(4000),
  JWT_SECRET: z.string().min(16).default("talknest-local-dev-secret"),
  CORS_ORIGIN: z.string().default("*"),
  DATABASE_PATH: z.string().default("./data/talknest.sqlite"),
  MESSAGE_MAX_LENGTH: z.coerce.number().int().min(1).max(4000).default(1000)
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.parse(env);

  return {
    port: parsed.PORT,
    jwtSecret: parsed.JWT_SECRET,
    corsOrigin: parsed.CORS_ORIGIN,
    databasePath:
      parsed.DATABASE_PATH === ":memory:"
        ? parsed.DATABASE_PATH
        : path.resolve(process.cwd(), parsed.DATABASE_PATH),
    messageMaxLength: parsed.MESSAGE_MAX_LENGTH
  };
}

export function getCorsOrigin(origin: string) {
  if (origin === "*") {
    return true;
  }

  const allowed = origin
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return allowed.length > 1 ? allowed : allowed[0] ?? true;
}
