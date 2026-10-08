import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const now = () => Date.now();
const json = (value, fallback = {}) => {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
};

export class WorkspaceStore {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS studio_projects (
        account TEXT NOT NULL,
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'idea',
        profile TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(account,id)
      );
      CREATE TABLE IF NOT EXISTS studio_research (
        account TEXT NOT NULL,
        id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        idea_name TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY(account,id)
      );
      CREATE TABLE IF NOT EXISTS studio_products (
        account TEXT NOT NULL,
        id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(account,id)
      );
      CREATE TABLE IF NOT EXISTS studio_brands (
        account TEXT NOT NULL,
        project_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(account,project_id)
      );
      CREATE TABLE IF NOT EXISTS studio_outputs (
        account TEXT NOT NULL,
        id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY(account,id)
      );
      CREATE TABLE IF NOT EXISTS studio_tasks (
        account TEXT NOT NULL,
        id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        recipe TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(account,id)
      );
      CREATE TABLE IF NOT EXISTS studio_partner_messages (
        account TEXT NOT NULL,
        id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY(account,id)
      );
      CREATE INDEX IF NOT EXISTS idx_studio_projects_updated ON studio_projects(account,updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_studio_research_project ON studio_research(account,project_id,created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_studio_products_project ON studio_products(account,project_id,updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_studio_outputs_project ON studio_outputs(account,project_id,created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_studio_messages_project ON studio_partner_messages(account,project_id,created_at ASC);
    `);
  }

  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  createProject(account, data) {
    const id = randomUUID();
    const createdAt = now();
    const profile = {
      country: data.country || '',
      budget: data.budget || '',
      skills: data.skills || '',
      timeAvailable: data.timeAvailable || '',
      businessType: data.businessType || 'unsure',
      marketScope: data.marketScope || 'unsure',
      payoutMethods: data.payoutMethods || ''
    };
    const name = (data.name || 'New business project').trim().slice(0,120);
    this.db.prepare(`INSERT INTO studio_projects(account,id,name,status,profile,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?)`).run(account,id,name,'idea',JSON.stringify(profile),createdAt,createdAt);
    return this.project(account,id);
  }

  updateProject(account, id, patch) {
    const current = this.project(account,id);
    if (!current) return null;
    const profile = { ...current.profile, ...(patch.profile && typeof patch.profile === 'object' ? patch.profile : {}) };
    const name = typeof patch.name === 'string' && patch.name.trim() ? patch.name.trim().slice(0,120) : current.name;
    const allowed = new Set(['idea','research','building','ready','launched','optimizing']);
    const status = allowed.has(patch.status) ? patch.status : current.status;
    this.db.prepare('UPDATE studio_projects SET name=?,status=?,profile=?,updated_at=? WHERE account=? AND id=?')
      .run(name,status,JSON.stringify(profile),now(),account,id);
    return this.project(account,id);
  }

  project(account, id) {
    const row = this.db.prepare('SELECT * FROM studio_projects WHERE account=? AND id=?').get(account,id);
    if (!row) return null;
    return { id:row.id, name:row.name, status:row.status, profile:json(row.profile), createdAt:row.created_at, updatedAt:row.updated_at };
  }

  listProjects(account, limit = 30) {
    return this.db.prepare('SELECT * FROM studio_projects WHERE account=? ORDER BY updated_at DESC LIMIT ?').all(account,limit)
      .map(row => ({ id:row.id, name:row.name, status:row.status, profile:json(row.profile), createdAt:row.created_at, updatedAt:row.updated_at }));
  }

  saveResearch(account, projectId, ideaName, payload) {
    const id = randomUUID();
    const createdAt = now();
    this.db.prepare('INSERT INTO studio_research(account,id,project_id,idea_name,payload,created_at) VALUES(?,?,?,?,?,?)')
      .run(account,id,projectId,String(ideaName).slice(0,160),JSON.stringify(payload),createdAt);
    this.db.prepare("UPDATE studio_projects SET status='research',updated_at=? WHERE account=? AND id=?").run(createdAt,account,projectId);
    return { id, projectId, ideaName, payload, createdAt };
  }

  latestResearch(account, projectId) {
    const row = this.db.prepare('SELECT * FROM studio_research WHERE account=? AND project_id=? ORDER BY created_at DESC LIMIT 1').get(account,projectId);
    return row ? { id:row.id, projectId:row.project_id, ideaName:row.idea_name, payload:json(row.payload), createdAt:row.created_at } : null;
  }

  saveProduct(account, projectId, payload) {
    const existing = payload.id ? this.db.prepare('SELECT * FROM studio_products WHERE account=? AND id=?').get(account,payload.id) : null;
    const updatedAt = now();
    if (existing) {
      const name = String(payload.name || json(existing.payload).name || existing.name).trim().slice(0,160);
      this.db.prepare('UPDATE studio_products SET name=?,payload=?,updated_at=? WHERE account=? AND id=?')
        .run(name,JSON.stringify({...json(existing.payload),...payload,id:existing.id}),updatedAt,account,existing.id);
      this.db.prepare("UPDATE studio_projects SET status='building',updated_at=? WHERE account=? AND id=?").run(updatedAt,account,projectId);
      return this.product(account,existing.id);
    }
    const id = randomUUID();
    const createdAt = updatedAt;
    const finalPayload = { ...payload, id };
    const name = String(finalPayload.name || 'Untitled product').trim().slice(0,160);
    this.db.prepare('INSERT INTO studio_products(account,id,project_id,name,payload,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
      .run(account,id,projectId,name,JSON.stringify(finalPayload),createdAt,updatedAt);
    this.db.prepare("UPDATE studio_projects SET status='building',updated_at=? WHERE account=? AND id=?").run(updatedAt,account,projectId);
    return this.product(account,id);
  }

  product(account, id) {
    const row = this.db.prepare('SELECT * FROM studio_products WHERE account=? AND id=?').get(account,id);
    return row ? { id:row.id, projectId:row.project_id, name:row.name, ...json(row.payload), createdAt:row.created_at, updatedAt:row.updated_at } : null;
  }

  listProducts(account, projectId) {
    return this.db.prepare('SELECT * FROM studio_products WHERE account=? AND project_id=? ORDER BY updated_at DESC').all(account,projectId)
      .map(row => ({ id:row.id, projectId:row.project_id, name:row.name, ...json(row.payload), createdAt:row.created_at, updatedAt:row.updated_at }));
  }

  saveBrand(account, projectId, payload) {
    const updatedAt = now();
    this.db.prepare(`INSERT INTO studio_brands(account,project_id,payload,updated_at) VALUES(?,?,?,?)
      ON CONFLICT(account,project_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`)
      .run(account,projectId,JSON.stringify(payload),updatedAt);
    return { projectId, ...payload, updatedAt };
  }

  brand(account, projectId) {
    const row = this.db.prepare('SELECT * FROM studio_brands WHERE account=? AND project_id=?').get(account,projectId);
    return row ? { projectId, ...json(row.payload), updatedAt:row.updated_at } : null;
  }

  saveOutput(account, projectId, type, title, payload) {
    const id = randomUUID();
    const createdAt = now();
    this.db.prepare('INSERT INTO studio_outputs(account,id,project_id,type,title,payload,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(account,id,projectId,type,String(title).slice(0,180),JSON.stringify(payload),createdAt);
    return { id, projectId, type, title, payload, createdAt };
  }

  listOutputs(account, projectId, limit = 50) {
    return this.db.prepare('SELECT * FROM studio_outputs WHERE account=? AND project_id=? ORDER BY created_at DESC LIMIT ?').all(account,projectId,limit)
      .map(row => ({ id:row.id, projectId:row.project_id, type:row.type, title:row.title, payload:json(row.payload), createdAt:row.created_at }));
  }

  addMessage(account, projectId, role, content) {
    const id = randomUUID();
    const createdAt = now();
    this.db.prepare('INSERT INTO studio_partner_messages(account,id,project_id,role,content,created_at) VALUES(?,?,?,?,?,?)')
      .run(account,id,projectId,role,String(content).slice(0,12000),createdAt);
    return { id, role, content, createdAt };
  }

  messages(account, projectId, limit = 80) {
    return this.db.prepare(`SELECT * FROM (
      SELECT * FROM studio_partner_messages WHERE account=? AND project_id=? ORDER BY created_at DESC LIMIT ?
    ) ORDER BY created_at ASC`).all(account,projectId,limit)
      .map(row => ({ id:row.id, role:row.role, content:row.content, createdAt:row.created_at }));
  }

  createTask(account, projectId, recipe, payload = {}) {
    const id = randomUUID();
    const createdAt = now();
    this.db.prepare("INSERT INTO studio_tasks(account,id,project_id,recipe,status,payload,created_at,updated_at) VALUES(?,?,?,?, 'todo',?,?,?)")
      .run(account,id,projectId,recipe,JSON.stringify(payload),createdAt,createdAt);
    return { id, projectId, recipe, status:'todo', payload, createdAt, updatedAt:createdAt };
  }

  listTasks(account, projectId) {
    return this.db.prepare('SELECT * FROM studio_tasks WHERE account=? AND project_id=? ORDER BY created_at DESC').all(account,projectId)
      .map(row => ({ id:row.id, projectId:row.project_id, recipe:row.recipe, status:row.status, payload:json(row.payload), createdAt:row.created_at, updatedAt:row.updated_at }));
  }

  dashboard(account, projectId = null) {
    const projects = this.listProjects(account,10);
    const active = projectId ? this.project(account,projectId) : projects[0] || null;
    if (!active) return { projects, activeProject:null, research:null, products:[], brand:null, outputs:[], tasks:[] };
    return {
      projects,
      activeProject:active,
      research:this.latestResearch(account,active.id),
      products:this.listProducts(account,active.id),
      brand:this.brand(account,active.id),
      outputs:this.listOutputs(account,active.id,12),
      tasks:this.listTasks(account,active.id)
    };
  }

  ping() { return this.db.prepare('SELECT 1 AS ok').get().ok === 1; }
  close() { this.db.close(); }
}
