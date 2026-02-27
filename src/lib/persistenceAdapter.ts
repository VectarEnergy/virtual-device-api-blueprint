import * as pg from './pg';
import * as sqlite from './db';

import config from '../config/config';

export const initPersistence = async () => {
  if (process.env.DATABASE_URL) {
    await pg.initPg(process.env.DATABASE_URL as string);
    // migrate from JSON and sqlite if any
    await pg.migrateFromJsonIfNeeded();
    await pg.migrateFromSqliteIfNeeded();
    return;
  }
  // fallback to sqlite (already initDb called elsewhere)
  // ensure sqlite DB is initialized
  await sqlite; // no-op import usage
};

export const getSiteState = async (siteId: string) => {
  if (process.env.DATABASE_URL) return pg.getSiteState(siteId);
  return sqlite.getSiteState(siteId);
};

export const updateSiteState = async (siteId: string, updater: (s: any) => any) => {
  if (process.env.DATABASE_URL) return pg.updateSiteState(siteId, updater);
  return sqlite.updateSiteState(siteId, updater);
};

export const seedSiteCumulative = async (siteId: string, value: number, force = false) => {
  if (process.env.DATABASE_URL) return pg.seedSiteCumulative(siteId, value, force);
  return sqlite.seedSiteCumulative(siteId, value, force);
};

export const getAllSites = async () => {
  if (process.env.DATABASE_URL) {
    // Postgres lacks a getAll implemented; use getSiteState isn't ideal. For now, return empty to avoid large reads.
    return {} as Record<string, any>;
  }
  return sqlite.getAllSites();
};
