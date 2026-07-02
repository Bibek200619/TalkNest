import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  getDirectRoomId,
  LOBBY_ROOM_ID,
  normalizeHandle,
  parseDirectRoomId,
} from "./rooms.js";
import type {
  ChatMessage,
  DirectConversation,
  PublicUser,
  UserRecord,
} from "./types.js";

type CreateUserInput = {
  username: string;
  handle: string;
  email: string;
  displayName: string;
  passwordHash: string;
};

type UserRow = {
  id: string;
  username: string;
  handle: string;
  email: string;
  display_name: string;
  password_hash: string;
  created_at: string;
};

type MessageRow = {
  id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  timestamp: string;
  type: "text";
  room_id: string;
};

const legacyDemoUserIds = ["user-alex", "user-mira", "user-sam"];

export class TalkNestDatabase {
  private readonly db: DatabaseSync;

  constructor(databasePath: string) {
    if (databasePath !== ":memory:") {
      mkdirSync(path.dirname(databasePath), { recursive: true });
    }

    this.db = new DatabaseSync(databasePath);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA journal_mode = WAL");
    this.initializeSchema();
  }

  findUserByIdentifier(identifier: string): UserRecord | null {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const normalizedHandle = normalizeHandle(identifier);
    const row = this.db
      .prepare(
        `SELECT id, username, handle, email, display_name, password_hash, created_at
         FROM users
         WHERE lower(username) = ? OR lower(email) = ? OR lower(handle) = ?
         LIMIT 1`,
      )
      .get(normalizedIdentifier, normalizedIdentifier, normalizedHandle) as
      UserRow | undefined;

    return row ? mapUserRow(row) : null;
  }

  findUserById(id: string): UserRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, username, handle, email, display_name, password_hash, created_at
         FROM users
         WHERE id = ?
         LIMIT 1`,
      )
      .get(id) as UserRow | undefined;

    return row ? mapUserRow(row) : null;
  }

  findUserByUsername(username: string): UserRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, username, handle, email, display_name, password_hash, created_at
         FROM users
         WHERE lower(username) = ?
         LIMIT 1`,
      )
      .get(username.trim().toLowerCase()) as UserRow | undefined;

    return row ? mapUserRow(row) : null;
  }

  findUserByEmail(email: string): UserRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, username, handle, email, display_name, password_hash, created_at
         FROM users
         WHERE lower(email) = ?
         LIMIT 1`,
      )
      .get(email.trim().toLowerCase()) as UserRow | undefined;

    return row ? mapUserRow(row) : null;
  }

  findUserByHandle(handle: string): UserRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, username, handle, email, display_name, password_hash, created_at
         FROM users
         WHERE lower(handle) = ?
         LIMIT 1`,
      )
      .get(normalizeHandle(handle)) as UserRow | undefined;

    return row ? mapUserRow(row) : null;
  }

  createUser(input: CreateUserInput): UserRecord {
    const user: UserRecord = {
      id: randomUUID(),
      username: input.username.trim().toLowerCase(),
      handle: normalizeHandle(input.handle),
      email: input.email.trim().toLowerCase(),
      displayName: input.displayName.trim(),
      passwordHash: input.passwordHash,
      createdAt: new Date().toISOString(),
    };

    this.db
      .prepare(
        `INSERT INTO users
         (id, username, handle, email, display_name, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        user.id,
        user.username,
        user.handle,
        user.email,
        user.displayName,
        user.passwordHash,
        user.createdAt,
      );

    return user;
  }

  listUsers(): PublicUser[] {
    const rows = this.db
      .prepare(
        `SELECT id, username, handle, email, display_name, password_hash, created_at
         FROM users
         ORDER BY lower(handle) ASC`,
      )
      .all() as UserRow[];

    return rows.map(mapUserRow).map(toPublicUser);
  }

  resolveDirectConversation(
    currentUser: PublicUser,
    handle: string,
  ): DirectConversation | null {
    const participant = this.findUserByHandle(handle);

    if (!participant || participant.id === currentUser.id) {
      return null;
    }

    return {
      roomId: getDirectRoomId(currentUser.id, participant.id),
      type: "direct",
      participant: toPublicUser(participant),
    };
  }

  canUserAccessRoom(userId: string, roomId: string): boolean {
    if (roomId === LOBBY_ROOM_ID) {
      return true;
    }

    const directRoom = parseDirectRoomId(roomId);

    if (!directRoom || !directRoom.participantIds.includes(userId)) {
      return false;
    }

    return directRoom.participantIds.every((participantId) => {
      return this.findUserById(participantId) !== null;
    });
  }

  listMessages(roomId: string, limit: number): ChatMessage[] {
    const rows = this.db
      .prepare(
        `SELECT id, sender_id, sender_name, text, timestamp, type, room_id
         FROM (
           SELECT id, sender_id, sender_name, text, timestamp, type, room_id
           FROM messages
           WHERE room_id = ?
           ORDER BY timestamp DESC
           LIMIT ?
         )
         ORDER BY timestamp ASC`,
      )
      .all(roomId, limit) as MessageRow[];

    return rows.map(mapMessageRow);
  }

  createMessage(input: {
    sender: PublicUser;
    text: string;
    roomId: string;
  }): ChatMessage {
    const message: ChatMessage = {
      id: randomUUID(),
      senderId: input.sender.id,
      senderName: input.sender.displayName,
      text: input.text,
      timestamp: new Date().toISOString(),
      type: "text",
      roomId: input.roomId,
    };

    this.db
      .prepare(
        `INSERT INTO messages (id, sender_id, sender_name, text, timestamp, type, room_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        message.id,
        message.senderId,
        message.senderName,
        message.text,
        message.timestamp,
        message.type,
        message.roomId,
      );

    return message;
  }

  close() {
    this.db.close();
  }

  private initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        handle TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'text',
        room_id TEXT NOT NULL DEFAULT 'lobby',
        FOREIGN KEY (sender_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_room_timestamp
      ON messages (room_id, timestamp);
    `);
    this.ensureHandleColumn();
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique
      ON users (lower(username));

      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
      ON users (lower(email));

      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle_unique
      ON users (lower(handle));
    `);
    this.removeLegacyDemoData();
  }

  private ensureHandleColumn() {
    const columns = this.db.prepare("PRAGMA table_info(users)").all() as Array<{
      name: string;
    }>;

    if (columns.some((column) => column.name === "handle")) {
      return;
    }

    this.db.exec("ALTER TABLE users ADD COLUMN handle TEXT");
    this.db.exec(
      "UPDATE users SET handle = lower(username) WHERE handle IS NULL",
    );
  }

  private removeLegacyDemoData() {
    const placeholders = legacyDemoUserIds.map(() => "?").join(", ");

    this.db
      .prepare(
        `DELETE FROM messages
         WHERE sender_id IN (${placeholders})
            OR room_id LIKE '%user-alex%'
            OR room_id LIKE '%user-mira%'
            OR room_id LIKE '%user-sam%'`,
      )
      .run(...legacyDemoUserIds);

    this.db
      .prepare(
        `DELETE FROM users
         WHERE id IN (${placeholders})
           AND email LIKE '%@talknest.local'`,
      )
      .run(...legacyDemoUserIds);
  }
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    username: user.username,
    handle: user.handle,
    email: user.email,
    displayName: user.displayName,
  };
}

function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    handle: row.handle,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

function mapMessageRow(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    text: row.text,
    timestamp: row.timestamp,
    type: row.type,
    roomId: row.room_id,
  };
}
