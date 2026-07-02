export type UserRecord = {
  id: string;
  username: string;
  handle: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
};

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

export type AuthTokenPayload = {
  sub: string;
  username: string;
  handle: string;
  displayName: string;
};

export type AuthenticatedSocketData = {
  user: PublicUser;
};

export type DirectConversation = {
  roomId: string;
  type: "direct";
  participant: PublicUser;
};
