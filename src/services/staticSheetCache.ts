import { getRows, type SheetName, type SheetRow } from './sheets.js';

const DEFAULT_CACHE_MS = 60_000;

interface CacheEntry {
  expiresAt: number;
  rows?: SheetRow[];
  pending?: Promise<SheetRow[]>;
}

const cache = new Map<SheetName, CacheEntry>();

function cloneRows(rows: SheetRow[]): SheetRow[] {
  return rows.map((row) => ({ ...row }));
}

export async function getCachedRows(name: SheetName, ttlMs = DEFAULT_CACHE_MS): Promise<SheetRow[]> {
  const now = Date.now();
  const entry = cache.get(name);

  if (entry?.rows && entry.expiresAt > now) {
    return cloneRows(entry.rows);
  }

  if (entry?.pending) {
    return cloneRows(await entry.pending);
  }

  const pending = getRows(name)
    .then((rows) => {
      if (cache.get(name)?.pending === pending) {
        cache.set(name, { rows: cloneRows(rows), expiresAt: Date.now() + ttlMs });
      }
      return rows;
    })
    .catch((error) => {
      if (cache.get(name)?.pending === pending) cache.delete(name);
      throw error;
    });

  cache.set(name, { pending, expiresAt: now + ttlMs });
  return cloneRows(await pending);
}

export function clearStaticSheetCache(name?: SheetName): void {
  if (name) {
    cache.delete(name);
    return;
  }
  cache.clear();
}
