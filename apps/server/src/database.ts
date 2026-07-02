import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
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

const seedUsers = [
  {
    id: "user-alex",
    username: "alex",
    handle: "alex",
    email: "alex@talknest.local",
    displayName: "Alex Rivera",
  },
  {
    id: "user-mira",
    username: "mira",
    handle: "mira",
    email: "mira@talknest.local",
    displayName: "Mira Chen",
  },
  {
    id: "user-sam",
    username: "sam",
    handle: "sam",
    email: "sam@talknest.local",
    displayName: "Sam Patel",
  },
] as const;

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
    this.seedDemoUsers();
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
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle_unique
      ON users (lower(handle));
    `);
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

  private seedDemoUsers() {
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO users
       (id, username, handle, email, display_name, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const passwordHash = bcrypt.hashSync("password123", 10);
    const createdAt = new Date().toISOString();

    for (const user of seedUsers) {
      insert.run(
        user.id,
        user.username,
        user.handle,
        user.email,
        user.displayName,
        passwordHash,
        createdAt,
      );
    }
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
