export type PublicUser = {
  id: string;
  username: string;
  handle: string;
  email: string;
  displayName: string;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  type: "text";
  roomId: string;
};

export type Session = {
  token: string;
  user: PublicUser;
};

export type DirectConversation = {
  roomId: string;
  type: "direct";
  participant: PublicUser;
};

export type ConnectionState =
  "connecting" | "connected" | "reconnecting" | "disconnected" | "error";
