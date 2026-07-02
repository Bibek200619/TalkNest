import { z } from "zod";

export const attachmentLimits = {
  image: 4 * 1024 * 1024,
  video: 4 * 1024 * 1024,
  document: 2 * 1024 * 1024,
} as const;

export const allowedAttachmentMimeTypes = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
  ],
} as const;

const maxAttachmentDataUrlLength =
  Math.ceil(Math.max(...Object.values(attachmentLimits)) * 1.4) + 128;

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters")
    .max(32, "Username must be 32 characters or less")
    .regex(
      /^[a-z0-9][a-z0-9._-]*$/i,
      "Username can contain letters, numbers, dots, underscores, and dashes",
    ),
  handle: z
    .string()
    .trim()
    .min(2, "Handle must be at least 2 characters")
    .max(32, "Handle must be 32 characters or less")
    .regex(
      /^@?[a-z0-9][a-z0-9._-]*$/i,
      "Handle can contain letters, numbers, dots, underscores, and dashes",
    ),
  email: z.string().trim().email("Enter a valid email"),
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(80, "Display name must be 80 characters or less"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const profileUpdateSchema = registerSchema
  .omit({ password: true })
  .partial()
  .refine((input) => Object.keys(input).length > 0, {
    message: "Choose at least one profile field to update",
  });

export const messageInputSchema = z.object({
  roomId: z.string().trim().min(1).max(80).default("lobby"),
  text: z.string().trim().max(1000).default(""),
  attachment: z
    .object({
      kind: z.enum(["image", "video", "document"]),
      fileName: z.string().trim().min(1).max(140),
      mimeType: z.string().trim().min(1).max(140),
      size: z.number().int().min(1),
      dataUrl: z.string().min(1).max(maxAttachmentDataUrlLength),
    })
    .superRefine((attachment, context) => {
      const allowed = allowedAttachmentMimeTypes[attachment.kind];

      if (!(allowed as readonly string[]).includes(attachment.mimeType)) {
        context.addIssue({
          code: "custom",
          message: "Unsupported attachment type",
          path: ["mimeType"],
        });
      }

      if (attachment.size > attachmentLimits[attachment.kind]) {
        context.addIssue({
          code: "custom",
          message: `Attachment exceeds ${Math.floor(
            attachmentLimits[attachment.kind] / (1024 * 1024),
          )} MB limit`,
          path: ["size"],
        });
      }

      if (!attachment.dataUrl.startsWith(`data:${attachment.mimeType};base64,`)) {
        context.addIssue({
          code: "custom",
          message: "Attachment data must match its MIME type",
          path: ["dataUrl"],
        });
      }
    })
    .optional(),
}).refine((input) => input.text.trim().length > 0 || input.attachment, {
  message: "Message cannot be empty",
  path: ["text"],
});

export const roomJoinSchema = z.object({
  roomId: z.string().trim().min(1).max(80).default("lobby"),
});

export const messageQuerySchema = z.object({
  roomId: z.string().trim().min(1).max(80).default("lobby"),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const directConversationSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(2, "Handle is required")
    .max(32, "Handle must be 32 characters or less")
    .regex(
      /^@?[a-z0-9][a-z0-9._-]*$/i,
      "Handle can contain letters, numbers, dots, underscores, and dashes",
    ),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type MessageInput = z.infer<typeof messageInputSchema>;
