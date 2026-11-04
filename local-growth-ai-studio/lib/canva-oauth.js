import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const now = () => Date.now();
const hash = value => createHash('sha256').update(value).digest('hex');

function encryptionKey(value) {
  if (typeof value !== 'string' || !value) return null;
  if (/^[a-f0-9]{64}$/i.test(value)) return Buffer.from(value, 'hex');
  try {
    const key = Buffer.from(value, 'base64');
    return key.length === 32 ? key : null;
  } catch { return null; }
}

export class CanvaOAuthStore {
  constructor(path, keyValue) {
    this.key = encryptionKey(keyValue);
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS canva_oauth_states (
        state_hash TEXT PRIMARY KEY,
        account TEXT NOT NULL,
        verifier TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS canva_tokens (
        account TEXT PRIMARY KEY,
        iv TEXT NOT NULL,
        tag TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );`);
  }

  createState(state, account, verifier) {
    const created = now();
    this.db.prepare('DELETE FROM canva_oauth_states WHERE expires_at<=?').run(created);
    this.db.prepare('INSERT INTO canva_oauth_states(state_hash,account,verifier,expires_at) VALUES(?,?,?,?)')
      .run(hash(state), account, verifier, created + 10 * 60_000);
  }

  consumeState(state) {
    if (typeof state !== 'string' || state.length < 32 || state.length > 256) return null;
    const stateHash = hash(state);
    const row = this.db.prepare('SELECT account,verifier,expires_at FROM canva_oauth_states WHERE state_hash=?').get(stateHash);
    this.db.prepare('DELETE FROM canva_oauth_states WHERE state_hash=?').run(stateHash);
    if (!row || row.expires_at <= now()) return null;
    return { account: row.account, verifier: row.verifier };
  }

  saveToken(account, token) {
    if (!this.key) throw new Error('CANVA_TOKEN_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex key.');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(token), 'utf8'), cipher.final()]);
    this.db.prepare(`INSERT INTO canva_tokens(account,iv,tag,ciphertext,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(account) DO UPDATE SET iv=excluded.iv,tag=excluded.tag,ciphertext=excluded.ciphertext,updated_at=excluded.updated_at`)
      .run(account, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url'), now());
  }

  ready() { return Boolean(this.key); }

  hasToken(account) {
    return Boolean(this.db.prepare('SELECT account FROM canva_tokens WHERE account=?').get(account));
  }

  getToken(account) {
    if (!this.key) throw new Error('CANVA_TOKEN_ENCRYPTION_KEY must be configured.');
    const row = this.db.prepare('SELECT iv,tag,ciphertext FROM canva_tokens WHERE account=?').get(account);
    if (!row) return null;
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(row.iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(row.tag, 'base64url'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(row.ciphertext, 'base64url')), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  }

  close() { this.db.close(); }
}
