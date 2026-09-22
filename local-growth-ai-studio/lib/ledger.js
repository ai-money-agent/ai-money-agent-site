import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// One local SQLite database on a persistent volume. Transactions reserve before
// provider work; duplicate request IDs never start another provider operation.
export class Ledger {
  constructor(path, initialBalance = 100) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.initialBalance = initialBalance;
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, balance INTEGER NOT NULL CHECK(balance >= 0), used INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS jobs (account TEXT NOT NULL, id TEXT NOT NULL, fingerprint TEXT NOT NULL, status TEXT NOT NULL, cost INTEGER NOT NULL, output TEXT, PRIMARY KEY(account,id));`);

    const columns = this.db.prepare('PRAGMA table_info(jobs)').all();
    if (!columns.some(column => column.name === 'created_at')) this.db.exec('ALTER TABLE jobs ADD COLUMN created_at INTEGER');
    if (!columns.some(column => column.name === 'updated_at')) this.db.exec('ALTER TABLE jobs ADD COLUMN updated_at INTEGER');
    const now = Date.now();
    this.db.prepare('UPDATE jobs SET created_at=COALESCE(created_at,?), updated_at=COALESCE(updated_at,created_at,?) WHERE created_at IS NULL OR updated_at IS NULL').run(now,now);
  }
  account(id) {
    this.db.prepare('INSERT OR IGNORE INTO accounts(id,balance) VALUES(?,?)').run(id, this.initialBalance);
    return this.db.prepare('SELECT balance,used FROM accounts WHERE id=?').get(id);
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  job(account, id) {
    return this.db.prepare('SELECT status,output,cost,created_at,updated_at FROM jobs WHERE account=? AND id=?').get(account,id);
  }
  reserve(account, id, fingerprint, cost) {
    return this.transaction(() => {
      this.account(account);
      const previous = this.db.prepare('SELECT * FROM jobs WHERE account=? AND id=?').get(account,id);
      if (previous) return { ...previous, conflict: previous.fingerprint !== fingerprint };
      const change = this.db.prepare('UPDATE accounts SET balance=balance-? WHERE id=? AND balance>=?').run(cost,account,cost);
      if (!change.changes) return { status: 'insufficient' };
      const now = Date.now();
      this.db.prepare("INSERT INTO jobs(account,id,fingerprint,status,cost,created_at,updated_at) VALUES(?,?,?,'pending',?,?,?)").run(account,id,fingerprint,cost,now,now);
      return { status: 'reserved' };
    });
  }
  complete(account, id, output) {
    return this.transaction(() => {
      const job = this.db.prepare('SELECT * FROM jobs WHERE account=? AND id=?').get(account,id);
      if (job?.status !== 'pending') throw new Error('Reservation missing.');
      this.db.prepare("UPDATE jobs SET status='completed',output=?,updated_at=? WHERE account=? AND id=?").run(JSON.stringify(output),Date.now(),account,id);
      this.db.prepare('UPDATE accounts SET used=used+? WHERE id=?').run(job.cost,account);
    });
  }
  fail(account, id) {
    this.transaction(() => {
      const job = this.db.prepare('SELECT * FROM jobs WHERE account=? AND id=?').get(account,id);
      if (job?.status !== 'pending') return;
      this.db.prepare("UPDATE jobs SET status='failed',updated_at=? WHERE account=? AND id=?").run(Date.now(),account,id);
      this.db.prepare('UPDATE accounts SET balance=balance+? WHERE id=?').run(job.cost,account);
    });
  }
  refundStalePending(maxAgeMs, now = Date.now()) {
    if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) throw new Error('Pending timeout must be positive.');
    return this.transaction(() => {
      const cutoff = now - maxAgeMs;
      const stale = this.db.prepare("SELECT account,id,cost FROM jobs WHERE status='pending' AND updated_at<=?").all(cutoff);
      let jobs = 0;
      let credits = 0;
      for (const item of stale) {
        const change = this.db.prepare("UPDATE jobs SET status='failed',updated_at=? WHERE account=? AND id=? AND status='pending'").run(now,item.account,item.id);
        if (!change.changes) continue;
        this.db.prepare('UPDATE accounts SET balance=balance+? WHERE id=?').run(item.cost,item.account);
        jobs += 1;
        credits += item.cost;
      }
      return { jobs, credits };
    });
  }
  ping() { return this.db.prepare('SELECT 1 AS ok').get().ok === 1; }
  close() { this.db.close(); }
}
