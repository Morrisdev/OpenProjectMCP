import path from "path";
import Database from "better-sqlite3";
import { CACHED_PROJECTS } from "./data/projects.js";
import { CACHED_USERS } from "./data/users.js";
import { CACHED_TYPES } from "./data/types.js";
import { CACHED_STATUSES } from "./data/statuses.js";
import { CACHED_FEATURES } from "./data/features.js";

export const DB_PATH =
  process.env.OPENPROJECT_DB_PATH ||
  path.join(__dirname, "cache.db");

// ── Types ─────────────────────────────────────────────────────────────────────

interface Project {
  id: number; identifier: string; name: string; active: boolean; parent: string | null;
}
interface User {
  id: number; login: string; name: string; email: string; status: string;
}
interface WpType {
  id: number; name: string; isDefault: boolean; isMilestone: boolean;
}
interface Status {
  id: number; name: string; isClosed: boolean; isDefault: boolean;
}
interface Feature {
  id: number; subject: string; projectId: number; project: string; module: string; status: string;
}

// ── DB init ───────────────────────────────────────────────────────────────────

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY,
      identifier TEXT NOT NULL,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      parent TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      login TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS types (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      isDefault INTEGER NOT NULL DEFAULT 0,
      isMilestone INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS statuses (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      isClosed INTEGER NOT NULL DEFAULT 0,
      isDefault INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS features (
      id INTEGER PRIMARY KEY,
      subject TEXT NOT NULL,
      projectId INTEGER NOT NULL,
      project TEXT NOT NULL,
      module TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL
    );
  `);
  return _db;
}

function isEmpty(): boolean {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as n FROM projects").get() as { n: number };
  return row.n === 0;
}

function seed(): void {
  const db = getDb();
  const insertProject = db.prepare(
    "INSERT OR REPLACE INTO projects (id, identifier, name, active, parent) VALUES (?, ?, ?, ?, ?)"
  );
  const insertUser = db.prepare(
    "INSERT OR REPLACE INTO users (id, login, name, email, status) VALUES (?, ?, ?, ?, ?)"
  );
  const insertType = db.prepare(
    "INSERT OR REPLACE INTO types (id, name, isDefault, isMilestone) VALUES (?, ?, ?, ?)"
  );
  const insertStatus = db.prepare(
    "INSERT OR REPLACE INTO statuses (id, name, isClosed, isDefault) VALUES (?, ?, ?, ?)"
  );
  const insertFeature = db.prepare(
    "INSERT OR REPLACE INTO features (id, subject, projectId, project, module, status) VALUES (?, ?, ?, ?, ?, ?)"
  );

  const seedAll = db.transaction(() => {
    for (const p of CACHED_PROJECTS) {
      insertProject.run(p.id, p.identifier, p.name, p.active ? 1 : 0, p.parent ?? null);
    }
    for (const u of CACHED_USERS) {
      insertUser.run(u.id, u.login, u.name, (u as any).email ?? "", u.status);
    }
    for (const t of CACHED_TYPES) {
      insertType.run(t.id, t.name, t.isDefault ? 1 : 0, t.isMilestone ? 1 : 0);
    }
    for (const s of CACHED_STATUSES) {
      insertStatus.run(s.id, s.name, s.isClosed ? 1 : 0, s.isDefault ? 1 : 0);
    }
    for (const f of CACHED_FEATURES) {
      insertFeature.run(f.id, f.subject, f.projectId, f.project, f.module, f.status);
    }
  });
  seedAll();
}

// ── Projects ──────────────────────────────────────────────────────────────────

export function dbListProjects(activeOnly = false): Project[] {
  const db = getDb();
  const rows = activeOnly
    ? db.prepare("SELECT * FROM projects WHERE active = 1 ORDER BY name").all()
    : db.prepare("SELECT * FROM projects ORDER BY name").all();
  return (rows as any[]).map((r) => ({ ...r, active: r.active === 1 }));
}

export function dbUpsertProject(id: number, identifier: string, name: string, active: boolean, parent: string | null): void {
  getDb().prepare(
    "INSERT OR REPLACE INTO projects (id, identifier, name, active, parent) VALUES (?, ?, ?, ?, ?)"
  ).run(id, identifier, name, active ? 1 : 0, parent);
}

export function dbDeleteProject(id: number): void {
  getDb().prepare("DELETE FROM projects WHERE id = ?").run(id);
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function dbListUsers(activeOnly = false): User[] {
  const db = getDb();
  const rows = activeOnly
    ? db.prepare("SELECT * FROM users WHERE status = 'active' ORDER BY name").all()
    : db.prepare("SELECT * FROM users ORDER BY name").all();
  return rows as User[];
}

export function dbUpsertUser(id: number, login: string, name: string, email: string, status: string): void {
  getDb().prepare(
    "INSERT OR REPLACE INTO users (id, login, name, email, status) VALUES (?, ?, ?, ?, ?)"
  ).run(id, login, name, email, status);
}

export function dbDeleteUser(id: number): void {
  getDb().prepare("DELETE FROM users WHERE id = ?").run(id);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export function dbListTypes(): WpType[] {
  const rows = getDb().prepare("SELECT * FROM types ORDER BY name").all();
  return (rows as any[]).map((r) => ({ ...r, isDefault: r.isDefault === 1, isMilestone: r.isMilestone === 1 }));
}

export function dbUpsertType(id: number, name: string, isDefault: boolean, isMilestone: boolean): void {
  getDb().prepare(
    "INSERT OR REPLACE INTO types (id, name, isDefault, isMilestone) VALUES (?, ?, ?, ?)"
  ).run(id, name, isDefault ? 1 : 0, isMilestone ? 1 : 0);
}

export function dbDeleteType(id: number): void {
  getDb().prepare("DELETE FROM types WHERE id = ?").run(id);
}

// ── Statuses ──────────────────────────────────────────────────────────────────

export function dbListStatuses(): Status[] {
  const rows = getDb().prepare("SELECT * FROM statuses ORDER BY name").all();
  return (rows as any[]).map((r) => ({ ...r, isClosed: r.isClosed === 1, isDefault: r.isDefault === 1 }));
}

export function dbUpsertStatus(id: number, name: string, isClosed: boolean, isDefault: boolean): void {
  getDb().prepare(
    "INSERT OR REPLACE INTO statuses (id, name, isClosed, isDefault) VALUES (?, ?, ?, ?)"
  ).run(id, name, isClosed ? 1 : 0, isDefault ? 1 : 0);
}

export function dbDeleteStatus(id: number): void {
  getDb().prepare("DELETE FROM statuses WHERE id = ?").run(id);
}

// ── Features ──────────────────────────────────────────────────────────────────

export function dbListFeatures(projectId?: number): Feature[] {
  const db = getDb();
  const rows = projectId
    ? db.prepare("SELECT * FROM features WHERE projectId = ? ORDER BY subject").all(projectId)
    : db.prepare("SELECT * FROM features ORDER BY subject").all();
  return rows as Feature[];
}

export function dbUpsertFeature(id: number, subject: string, projectId: number, project: string, module: string, status: string): void {
  getDb().prepare(
    "INSERT OR REPLACE INTO features (id, subject, projectId, project, module, status) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, subject, projectId, project, module, status);
}

export function dbDeleteFeature(id: number): void {
  getDb().prepare("DELETE FROM features WHERE id = ?").run(id);
}

// ── Init (used by postbuild script) ──────────────────────────────────────────

export function initCache(): string {
  getDb(); // ensures tables exist
  if (isEmpty()) seed();
  return DB_PATH;
}

// ── Rebuild from API ──────────────────────────────────────────────────────────

export async function rebuildCache(baseUrl: string, apiKey: string): Promise<string[]> {
  const auth = "Basic " + Buffer.from(`apikey:${apiKey}`).toString("base64");
  const get = async (endpoint: string) => {
    const res = await fetch(`${baseUrl}/api/v3${endpoint}`, {
      headers: { Authorization: auth },
    });
    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
    return res.json() as Promise<{ _embedded: { elements: Record<string, unknown>[] }; total: number }>;
  };

  const log: string[] = [];
  const db = getDb();

  // Clear all tables
  db.exec("DELETE FROM projects; DELETE FROM users; DELETE FROM types; DELETE FROM statuses; DELETE FROM features;");

  // Projects
  const projData = await get("/projects?pageSize=200");
  const insertProject = db.prepare(
    "INSERT OR REPLACE INTO projects (id, identifier, name, active, parent) VALUES (?, ?, ?, ?, ?)"
  );
  const projects = projData._embedded.elements as {
    id: number; identifier: string; name: string; active: boolean;
    _links: { parent: { title: string | null } };
  }[];
  const seedProjects = db.transaction(() => {
    for (const p of projects) {
      insertProject.run(p.id, p.identifier, p.name, p.active ? 1 : 0, p._links.parent?.title ?? null);
    }
  });
  seedProjects();
  log.push(`Projects: ${projects.length} loaded`);

  // Users
  const userData = await get("/users?pageSize=200");
  const insertUser = db.prepare(
    "INSERT OR REPLACE INTO users (id, login, name, email, status) VALUES (?, ?, ?, ?, ?)"
  );
  const users = userData._embedded.elements as {
    id: number; login: string; firstName: string; lastName: string; email: string; status: string;
  }[];
  const seedUsers = db.transaction(() => {
    for (const u of users) {
      insertUser.run(u.id, u.login, `${u.firstName} ${u.lastName}`.trim(), u.email ?? "", u.status);
    }
  });
  seedUsers();
  log.push(`Users: ${users.length} loaded`);

  // Types
  const typeData = await get("/types?pageSize=100");
  const insertType = db.prepare(
    "INSERT OR REPLACE INTO types (id, name, isDefault, isMilestone) VALUES (?, ?, ?, ?)"
  );
  const types = typeData._embedded.elements as {
    id: number; name: string; isDefault: boolean; isMilestone: boolean;
  }[];
  const seedTypes = db.transaction(() => {
    for (const t of types) {
      insertType.run(t.id, t.name, t.isDefault ? 1 : 0, t.isMilestone ? 1 : 0);
    }
  });
  seedTypes();
  log.push(`Types: ${types.length} loaded`);

  // Statuses
  const statusData = await get("/statuses");
  const insertStatus = db.prepare(
    "INSERT OR REPLACE INTO statuses (id, name, isClosed, isDefault) VALUES (?, ?, ?, ?)"
  );
  const statuses = statusData._embedded.elements as {
    id: number; name: string; isClosed: boolean; isDefault: boolean;
  }[];
  const seedStatuses = db.transaction(() => {
    for (const s of statuses) {
      insertStatus.run(s.id, s.name, s.isClosed ? 1 : 0, s.isDefault ? 1 : 0);
    }
  });
  seedStatuses();
  log.push(`Statuses: ${statuses.length} loaded`);

  // Open Features
  const featureFilters = encodeURIComponent(
    JSON.stringify([{ type: { operator: "=", values: ["4"] } }, { status: { operator: "o" } }])
  );
  const featData = await get(`/work_packages?filters=${featureFilters}&pageSize=500`);
  const insertFeature = db.prepare(
    "INSERT OR REPLACE INTO features (id, subject, projectId, project, module, status) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const features = featData._embedded.elements as {
    id: number; subject: string; customField1: string | null;
    _links: { project: { href: string; title: string }; status: { title: string } };
  }[];
  const seedFeatures = db.transaction(() => {
    for (const f of features) {
      insertFeature.run(
        f.id, f.subject,
        parseInt(f._links.project.href.split("/").pop()!, 10),
        f._links.project.title,
        f.customField1 ?? "",
        f._links.status.title
      );
    }
  });
  seedFeatures();
  log.push(`Features: ${features.length} loaded`);

  return log;
}
