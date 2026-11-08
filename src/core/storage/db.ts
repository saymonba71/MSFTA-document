import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface StoredProject { id: string; name: string; module: string; createdAt: number; updatedAt: number; favorite: boolean; deletedAt?: number; thumbnail?: string; data: unknown; snapshots?: { at: number; data: unknown }[] }
export interface StoredPrompt { id: string; name: string; category: string; original: string; enhanced: string; negative: string; variations: string[]; notes: string; tags: string[]; collection: string; favorite: boolean; createdAt: number; updatedAt: number }
export interface StoredExport { id: string; filename: string; mime: string; size: number; createdAt: number; blob: Blob }
export interface StoredSetting { key: string; value: unknown }
export interface StoredSignature { id: string; name: string; src: string; createdAt: number }
interface IsoeDB extends DBSchema {
  projects: { key: string; value: StoredProject; indexes: { updatedAt: number; deletedAt: number } };
  prompts: { key: string; value: StoredPrompt; indexes: { updatedAt: number; category: string } };
  exports: { key: string; value: StoredExport; indexes: { createdAt: number } };
  settings: { key: string; value: StoredSetting };
  signatures: { key: string; value: StoredSignature };
}
let dbp: Promise<IDBPDatabase<IsoeDB>> | null = null;
export function db() {
  if (!dbp) dbp = openDB<IsoeDB>("isoe-studio", 2, {
    upgrade(d, old) {
      if (old < 1) {
        const p = d.createObjectStore("projects", { keyPath: "id" }); p.createIndex("updatedAt", "updatedAt"); p.createIndex("deletedAt", "deletedAt");
        const pr = d.createObjectStore("prompts", { keyPath: "id" }); pr.createIndex("updatedAt", "updatedAt"); pr.createIndex("category", "category");
        d.createObjectStore("exports", { keyPath: "id" }).createIndex("createdAt", "createdAt");
        d.createObjectStore("settings", { keyPath: "key" });
        d.createObjectStore("signatures", { keyPath: "id" });
      }
    },
  });
  return dbp;
}
export async function getSetting<T>(key: string, fallback: T): Promise<T> { const row = await db().then((d) => d.get("settings", key)); return row ? (row.value as T) : fallback; }
export async function setSetting(key: string, value: unknown) { await db().then((d) => d.put("settings", { key, value })); }
export async function storageEstimate() { return navigator.storage?.estimate ? navigator.storage.estimate() : { usage: 0, quota: 0 }; }
export async function requestPersist() { return navigator.storage?.persist ? navigator.storage.persist() : false; }
export async function clearAllData() { const d = await db(); await Promise.all(["projects", "prompts", "exports", "settings", "signatures"].map((s) => d.clear(s as never))); const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); localStorage.clear(); }
export async function purgeTrash() { const d = await db(); const all = await d.getAll("projects"); const cutoff = Date.now() - 30 * 86400000; await Promise.all(all.filter((p) => p.deletedAt && p.deletedAt < cutoff).map((p) => d.delete("projects", p.id))); }
export type ProjectMeta = { id: string; name: string; module: string; updatedAt: string; size?: number; trashedAt?: string; favorite?: boolean; thumbnail?: string };
export async function getAll<K extends "projects" | "prompts" | "exports" | "settings" | "signatures">(store: K): Promise<IsoeDB[K]["value"][]> { return db().then((d) => d.getAll(store)); }
export async function get<K extends "projects" | "prompts" | "exports" | "settings" | "signatures">(store: K, id: string): Promise<IsoeDB[K]["value"] | undefined> { return db().then((d) => d.get(store, id)); }
export async function put<K extends "projects" | "prompts" | "exports" | "settings" | "signatures">(store: K, value: IsoeDB[K]["value"]) { await db().then((d) => d.put(store, value)); }
export async function del(store: "projects" | "prompts" | "exports" | "settings" | "signatures", id: string) { await db().then((d) => d.delete(store, id)); }
export async function saveData(id: string, data: unknown) { const d = await db(); const prev = await d.get("projects", id); if (prev) await d.put("projects", { ...prev, data, updatedAt: Date.now() }); }
export const clearAll = clearAllData;
