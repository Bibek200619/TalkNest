import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required")
});

export const messageInputSchema = z.object({
  roomId: z.string().trim().min(1).max(80).default("lobby"),
  text: z.string().trim().min(1, "Message cannot be empty").max(1000)
});

export const messageQuerySchema = z.object({
  roomId: z.string().trim().min(1).max(80).default("lobby"),
  limit: z.coerce.number().int().min(1).max(200).default(100)
});

export type LoginInput = z.infer<typeof loginSchema>;
export type MessageInput = z.infer<typeof messageInputSchema>;
