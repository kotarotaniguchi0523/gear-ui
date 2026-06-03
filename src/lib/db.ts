import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DB_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = process.env.UI_AI_CREATOR_DB_PATH ?? path.join(DB_DIR, "projects.db");

declare global {
  var __ui_ai_creator_db: Database.Database | undefined;
}

function createDb(): Database.Database {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      requirement TEXT NOT NULL DEFAULT '',
      definitions_json TEXT,
      mocks_json TEXT,
      theme TEXT NOT NULL DEFAULT 'indigo',
      design_rules_json TEXT,
      chat_json TEXT,
      mock_stale_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_projects_updated_at
      ON projects(updated_at DESC);
  `);

  // 既存DB向けマイグレーション: 後から追加した列が無ければ足す
  const columns = db.prepare(`PRAGMA table_info(projects)`).all() as Array<{
    name: string;
  }>;
  const hasColumn = (name: string) => columns.some((c) => c.name === name);
  if (!hasColumn("design_rules_json")) {
    db.exec(`ALTER TABLE projects ADD COLUMN design_rules_json TEXT`);
  }
  if (!hasColumn("chat_json")) {
    db.exec(`ALTER TABLE projects ADD COLUMN chat_json TEXT`);
  }
  if (!hasColumn("mock_stale_json")) {
    db.exec(`ALTER TABLE projects ADD COLUMN mock_stale_json TEXT`);
  }

  return db;
}

export function getDb(): Database.Database {
  if (!globalThis.__ui_ai_creator_db) {
    globalThis.__ui_ai_creator_db = createDb();
  }
  return globalThis.__ui_ai_creator_db;
}
