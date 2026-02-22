// Legacy Postgres adapter stub. Use Sequelize adapter instead.
import * as seq from './sequelizeAdapter';

export const initPg = async (databaseUrl: string) => {
  // initialize Sequelize with DATABASE_URL instead
  await seq.initSequelize();
};

export const migrateFromSqliteIfNeeded = async () => {
  // noop - handled by sequelize migration from JSON
};

export const migrateFromJsonIfNeeded = seq.migrateFromJsonIfNeeded;

export const getSiteState = seq.getSiteState;
export const updateSiteState = seq.updateSiteState;
export const seedSiteCumulative = seq.seedSiteCumulative;
export const closePg = async () => {};
