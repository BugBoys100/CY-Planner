import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

type DB = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: DB; __sqlite?: Database.Database };

function createDb(): DB {
  const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH ?? "./data/app.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  // Migrations automatiques au démarrage (idempotent) → l'app est utilisable immédiatement
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  if (fs.existsSync(path.join(migrationsFolder, "meta", "_journal.json"))) {
    migrate(db, { migrationsFolder });
  }
  globalForDb.__sqlite = sqlite;
  return db;
}

export const db: DB = globalForDb.__db ?? (globalForDb.__db = createDb());
export { schema };
