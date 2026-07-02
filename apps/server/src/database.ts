import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import type { ChatMessage, PublicUser, UserRecord } from "./types.js";

type UserRow = {
  id: string;
  username: string;
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
    email: "alex@talknest.local",
    displayName: "Alex Rivera"
  },
  {
    id: "user-mira",
    username: "mira",
    email: "mira@talknest.local",
    displayName: "Mira Chen"
  },
  {
    id: "user-sam",
    username: "sam",
    email: "sam@talknest.local",
    displayName: "Sam Patel"
  }
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
    const normalized = identifier.trim().toLowerCase();
    const row = this.db
      .prepare(
        `SELECT id, username, email, display_name, password_hash, created_at
         FROM users
         WHERE lower(username) = ? OR lower(email) = ?
         LIMIT 1`
      )
      .get(normalized, normalized) as UserRow | undefined;

    return row ? mapUserRow(row) : null;
  }

  findUserById(id: string): UserRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, username, email, display_name, password_hash, created_at
         FROM users
         WHERE id = ?
         LIMIT 1`
      )
      .get(id) as UserRow | undefined;

    return row ? mapUserRow(row) : null;
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
         ORDER BY timestamp ASC`
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
      roomId: input.roomId
    };

    this.db
      .prepare(
        `INSERT INTO messages (id, sender_id, sender_name, text, timestamp, type, room_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        message.id,
        message.senderId,
        message.senderName,
        message.text,
        message.timestamp,
        message.type,
        message.roomId
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
  }

  private seedDemoUsers() {
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO users
       (id, username, email, display_name, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const passwordHash = bcrypt.hashSync("password123", 10);
    const createdAt = new Date().toISOString();

    for (const user of seedUsers) {
      insert.run(
        user.id,
        user.username,
        user.email,
        user.displayName,
        passwordHash,
        createdAt
      );
    }
  }
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName
  };
}

function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    createdAt: row.created_at
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
    roomId: row.room_id
  };
}
