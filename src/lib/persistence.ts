import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'solar-yield.json');

export type HourRecord = {
  start: number;
  end: number;
  value: number; // kWh
  retrievedAt: string;
};

export type SiteState = {
  cumulative: number; // kWh
  lastHour?: HourRecord;
  history?: HourRecord[];
};

type Store = Record<string, SiteState>;

const ensureDataDir = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // ignore
  }
};

export const loadStore = async (): Promise<Store> => {
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf8');
    return JSON.parse(raw) as Store;
  } catch (err) {
    return {};
  }
};

const atomicWrite = async (file: string, data: string) => {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, data, { encoding: 'utf8' });
  await fs.rename(tmp, file);
};

export const saveStore = async (store: Store) => {
  await ensureDataDir();
  const data = JSON.stringify(store, null, 2);
  await atomicWrite(FILE_PATH, data);
};

export const getSiteState = async (siteId: string): Promise<SiteState> => {
  const store = await loadStore();
  if (!store[siteId]) {
    store[siteId] = { cumulative: 0, history: [] };
    await saveStore(store);
  }
  return store[siteId];
};

export const updateSiteState = async (siteId: string, updater: (s: SiteState) => SiteState | void) => {
  const store = await loadStore();
  if (!store[siteId]) store[siteId] = { cumulative: 0, history: [] };
  const current = store[siteId];
  const res = updater(current);
  if (res) store[siteId] = res;
  await saveStore(store);
  return store[siteId];
};

// Seed helper: set initial cumulative only if not present or if force
export const seedSiteCumulative = async (siteId: string, value: number, force = false) => {
  const store = await loadStore();
  if (!store[siteId]) store[siteId] = { cumulative: 0, history: [] };
  if (force || !store[siteId].cumulative) {
    store[siteId].cumulative = value;
    await saveStore(store);
  }
  return store[siteId];
};
