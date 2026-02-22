// Legacy adapter stub to avoid build-time errors.
// Project now uses `sequelizeAdapter`. Re-export its functions here.
import * as seq from './sequelizeAdapter';

export const initDb = seq.initSequelize;
export const getSiteState = seq.getSiteState;
export const updateSiteState = seq.updateSiteState;
export const seedSiteCumulative = seq.seedSiteCumulative;
export const migrateFromJsonIfNeeded = seq.migrateFromJsonIfNeeded;
export const getAllSites = async () => {
  return {} as Record<string, any>;
};
