import fs from "fs";
import path from "path";
import { CACHED_PROJECTS } from "./data/projects.js";
import { CACHED_USERS } from "./data/users.js";
import { CACHED_TYPES } from "./data/types.js";
import { CACHED_STATUSES } from "./data/statuses.js";
import { CACHED_FEATURES } from "./data/features.js";

export const DB_PATH =
  process.env.OPENPROJECT_DB_PATH ||
  path.join(__dirname, "cache.json");

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

interface CacheStore {
  projects: Project[];
  users: User[];
  types: WpType[];
  statuses: Status[];
  features: Feature[];
}

// ── Load / Save ───────────────────────────────────────────────────────────────

let _store: CacheStore | null = null;

function load(): CacheStore {
  if (_store) return _store;
  if (fs.existsSync(DB_PATH)) {
    try {
      _store = JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as CacheStore;
      return _store;
    } catch {
      // fall through to seed
    }
  }
  _store = seed();
  save(_store);
  return _store;
}

function save(store: CacheStore): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2), "utf8");
}

function getStore(): CacheStore {
  return load();
}

function seed(): CacheStore {
  return {
    projects: CACHED_PROJECTS.map((p) => ({ ...p, parent: p.parent ?? null })),
    users: CACHED_USERS as User[],
    types: CACHED_TYPES as WpType[],
    statuses: CACHED_STATUSES as Status[],
    features: CACHED_FEATURES as Feature[],
  };
}

// ── Projects ──────────────────────────────────────────────────────────────────

export function dbListProjects(activeOnly = false): Project[] {
  const store = getStore();
  return activeOnly ? store.projects.filter((p) => p.active) : store.projects;
}

export function dbUpsertProject(id: number, identifier: string, name: string, active: boolean, parent: string | null): void {
  const store = getStore();
  const idx = store.projects.findIndex((p) => p.id === id);
  const record: Project = { id, identifier, name, active, parent };
  if (idx >= 0) store.projects[idx] = record;
  else store.projects.push(record);
  save(store);
}

export function dbDeleteProject(id: number): void {
  const store = getStore();
  store.projects = store.projects.filter((p) => p.id !== id);
  save(store);
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function dbListUsers(activeOnly = false): User[] {
  const store = getStore();
  return activeOnly ? store.users.filter((u) => u.status === "active") : store.users;
}

export function dbUpsertUser(id: number, login: string, name: string, email: string, status: string): void {
  const store = getStore();
  const idx = store.users.findIndex((u) => u.id === id);
  const record: User = { id, login, name, email, status };
  if (idx >= 0) store.users[idx] = record;
  else store.users.push(record);
  save(store);
}

export function dbDeleteUser(id: number): void {
  const store = getStore();
  store.users = store.users.filter((u) => u.id !== id);
  save(store);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export function dbListTypes(): WpType[] {
  return getStore().types;
}

export function dbUpsertType(id: number, name: string, isDefault: boolean, isMilestone: boolean): void {
  const store = getStore();
  const idx = store.types.findIndex((t) => t.id === id);
  const record: WpType = { id, name, isDefault, isMilestone };
  if (idx >= 0) store.types[idx] = record;
  else store.types.push(record);
  save(store);
}

export function dbDeleteType(id: number): void {
  const store = getStore();
  store.types = store.types.filter((t) => t.id !== id);
  save(store);
}

// ── Statuses ──────────────────────────────────────────────────────────────────

export function dbListStatuses(): Status[] {
  return getStore().statuses;
}

export function dbUpsertStatus(id: number, name: string, isClosed: boolean, isDefault: boolean): void {
  const store = getStore();
  const idx = store.statuses.findIndex((s) => s.id === id);
  const record: Status = { id, name, isClosed, isDefault };
  if (idx >= 0) store.statuses[idx] = record;
  else store.statuses.push(record);
  save(store);
}

export function dbDeleteStatus(id: number): void {
  const store = getStore();
  store.statuses = store.statuses.filter((s) => s.id !== id);
  save(store);
}

// ── Features ──────────────────────────────────────────────────────────────────

export function dbListFeatures(projectId?: number): Feature[] {
  const store = getStore();
  return projectId ? store.features.filter((f) => f.projectId === projectId) : store.features;
}

export function dbUpsertFeature(id: number, subject: string, projectId: number, project: string, module: string, status: string): void {
  const store = getStore();
  const idx = store.features.findIndex((f) => f.id === id);
  const record: Feature = { id, subject, projectId, project, module, status };
  if (idx >= 0) store.features[idx] = record;
  else store.features.push(record);
  save(store);
}

export function dbDeleteFeature(id: number): void {
  const store = getStore();
  store.features = store.features.filter((f) => f.id !== id);
  save(store);
}

// ── Init (used by postbuild script) ──────────────────────────────────────────

export function initCache(): string {
  load(); // creates cache.json from seed data if it doesn't exist
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

  // Projects
  const projData = await get("/projects?pageSize=200");
  const projects: Project[] = (projData._embedded.elements as {
    id: number; identifier: string; name: string; active: boolean;
    _links: { parent: { title: string | null } };
  }[]).map((p) => ({
    id: p.id,
    identifier: p.identifier,
    name: p.name,
    active: p.active,
    parent: p._links.parent?.title ?? null,
  }));
  log.push(`Projects: ${projects.length} loaded`);

  // Users
  const userData = await get("/users?pageSize=200");
  const users: User[] = (userData._embedded.elements as {
    id: number; login: string; firstName: string; lastName: string; email: string; status: string;
  }[]).map((u) => ({
    id: u.id,
    login: u.login,
    name: `${u.firstName} ${u.lastName}`.trim(),
    email: u.email ?? "",
    status: u.status,
  }));
  log.push(`Users: ${users.length} loaded`);

  // Types
  const typeData = await get("/types?pageSize=100");
  const types: WpType[] = (typeData._embedded.elements as {
    id: number; name: string; isDefault: boolean; isMilestone: boolean;
  }[]).map((t) => ({ id: t.id, name: t.name, isDefault: t.isDefault, isMilestone: t.isMilestone }));
  log.push(`Types: ${types.length} loaded`);

  // Statuses
  const statusData = await get("/statuses");
  const statuses: Status[] = (statusData._embedded.elements as {
    id: number; name: string; isClosed: boolean; isDefault: boolean;
  }[]).map((s) => ({ id: s.id, name: s.name, isClosed: s.isClosed, isDefault: s.isDefault }));
  log.push(`Statuses: ${statuses.length} loaded`);

  // Open Features (type=4, status=open)
  const featureFilters = encodeURIComponent(
    JSON.stringify([{ type: { operator: "=", values: ["4"] } }, { status: { operator: "o" } }])
  );
  const featData = await get(`/work_packages?filters=${featureFilters}&pageSize=500`);
  const features: Feature[] = (featData._embedded.elements as {
    id: number; subject: string; customField1: string | null;
    _links: { project: { href: string; title: string }; status: { title: string } };
  }[]).map((f) => ({
    id: f.id,
    subject: f.subject,
    projectId: parseInt(f._links.project.href.split("/").pop()!, 10),
    project: f._links.project.title,
    module: f.customField1 ?? "",
    status: f._links.status.title,
  }));
  log.push(`Features: ${features.length} loaded`);

  const store: CacheStore = { projects, users, types, statuses, features };
  _store = store;
  save(store);

  return log;
}
