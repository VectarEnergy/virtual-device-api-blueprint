import { DataTypes, Model, Sequelize } from 'sequelize';

import fs from 'fs/promises';
import path from 'path';

import { runPendingMigrations } from './run-migrations';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SQLITE_PATH = path.join(DATA_DIR, 'solar-yield.sqlite');
const JSON_STORE = path.join(DATA_DIR, 'solar-yield.json');

let sequelize: Sequelize | null = null;

class Site extends Model {
  public siteId!: string;
  public cumulative!: number;
  public lastHour!: any | null;
  public history!: any[];
}

export const initSequelize = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // ignore
  }

  if (process.env.DATABASE_URL) {
    const poolMax = Math.min(
      32,
      Math.max(1, parseInt(process.env.DB_POOL_MAX || '5', 10) || 5),
    );
    const poolMin = Math.min(
      poolMax,
      Math.max(0, parseInt(process.env.DB_POOL_MIN || '0', 10) || 0),
    );
    sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
      pool: {
        max: poolMax,
        min: poolMin,
        acquire: parseInt(process.env.DB_POOL_ACQUIRE_MS || '60000', 10) || 60000,
        idle: parseInt(process.env.DB_POOL_IDLE_MS || '10000', 10) || 10000,
      },
    });
  } else {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: SQLITE_PATH, logging: false });
  }

  await runPendingMigrations(sequelize);

  Site.init(
    {
      siteId: { type: DataTypes.STRING, primaryKey: true },
      cumulative: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0 },
      lastHour: { type: DataTypes.JSON, allowNull: true },
      history: { type: DataTypes.JSON, allowNull: true },
    },
    { sequelize, tableName: 'sites', timestamps: false },
  );
};

const ensure = () => {
  if (!sequelize) throw new Error('Sequelize not initialized. Call initSequelize() first.');
};

/** For readiness probes (Postgres or SQLite). */
export const checkDbConnection = async (): Promise<void> => {
  ensure();
  await sequelize!.authenticate();
};

export const getSiteState = async (siteId: string) => {
  ensure();
  const row = await Site.findByPk(siteId);
  if (!row) {
    await Site.create({ siteId, cumulative: 0, lastHour: null, history: [] });
    return { cumulative: 0, lastHour: undefined, history: [] };
  }
  return { cumulative: Number(row.cumulative || 0), lastHour: row.lastHour ?? undefined, history: row.history ?? [] };
};

export const updateSiteState = async (siteId: string, updater: (s: any) => any) => {
  ensure();
  const s = await getSiteState(siteId);
  const res = updater(s) || s;
  await Site.upsert({ siteId, cumulative: res.cumulative, lastHour: res.lastHour ?? null, history: res.history ?? [] });
  return res;
};

export const seedSiteCumulative = async (siteId: string, value: number, force = false) => {
  ensure();
  const cur = await getSiteState(siteId);
  if (force || !cur.cumulative) {
    await Site.upsert({ siteId, cumulative: value, lastHour: cur.lastHour ?? null, history: cur.history ?? [] });
    return { cumulative: value, lastHour: cur.lastHour, history: cur.history };
  }
  return cur;
};

/** Wipe stored solar rows for one site (history, cumulative, lastHour). */
export const resetSiteSolarState = async (siteId: string) => {
  ensure();
  await Site.upsert({
    siteId,
    cumulative: 0,
    lastHour: null,
    history: [],
  });
};

export const migrateFromJsonIfNeeded = async () => {
  ensure();
  try {
    const raw = await fs.readFile(JSON_STORE, 'utf8');
    const store = JSON.parse(raw) as Record<string, any>;
    for (const [siteId, state] of Object.entries(store)) {
      await Site.upsert({ siteId, cumulative: state.cumulative || 0, lastHour: state.lastHour ?? null, history: state.history ?? [] });
    }
  } catch (err) {
    // ignore if file missing
  }
};

export const closeSequelize = async () => {
  if (sequelize) {
    await sequelize.close();
    sequelize = null;
  }
};
