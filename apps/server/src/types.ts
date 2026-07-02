export type UserRecord = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
};

export type PublicUser = {
  id: string;
  username: string;
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
  displayName: string;
};

export type AuthenticatedSocketData = {
  user: PublicUser;
};
