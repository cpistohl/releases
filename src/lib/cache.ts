import { Database } from "bun:sqlite";
import { join } from "path";

const dbPath = Bun.env.CACHE_DIR ? join(Bun.env.CACHE_DIR, "cache.sqlite") : join(import.meta.dir, "../../cache.sqlite");
const db = new Database(dbPath);

db.run("PRAGMA journal_mode = WAL");
db.run(`CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL
)`);

const stmts = {
  get: db.prepare<{ value: string; expires_at: number }, [string]>("SELECT value, expires_at FROM cache WHERE key = ?"),
  set: db.prepare("INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)"),
  del: db.prepare("DELETE FROM cache WHERE key = ?"),
  prune: db.prepare("DELETE FROM cache WHERE expires_at <= ?"),
};

export function cacheGet<T>(key: string): T | null {
  const row = stmts.get.get(key);
  if (!row) return null;
  if (row.expires_at <= Date.now()) {
    stmts.del.run(key);
    return null;
  }
  return JSON.parse(row.value) as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number) {
  stmts.set.run(key, JSON.stringify(value), Date.now() + ttlMs);
}

export function cachePrune() {
  return stmts.prune.run(Date.now()).changes;
}

export function cacheClear() {
  db.run("DELETE FROM cache");
}

export { db };
