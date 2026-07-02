export type PublicUser = {
  id: string;
  username: string;
  handle: string;
  email: string;
  displayName: string;
};

export type AppTheme = "light" | "dark";

export type AttachmentKind = "image" | "video" | "document";

export type ChatAttachment = {
  kind: AttachmentKind;
  fileName: string;
  mimeType: string;
  size: number;
  dataUrl: string;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  type: "text" | "attachment";
  roomId: string;
  attachment?: ChatAttachment;
};

export type Session = {
  token: string;
  user: PublicUser;
};

export type RegisterInput = {
  username: string;
  handle: string;
  email: string;
  displayName: string;
  password: string;
};

export type DirectConversation = {
  roomId: string;
  type: "direct";
  participant: PublicUser;
};

export type ConnectionState =
  "connecting" | "connected" | "reconnecting" | "disconnected" | "error";
