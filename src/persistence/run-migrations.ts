import { Umzug, SequelizeStorage } from 'umzug';
import type { Sequelize } from 'sequelize';

const silentLogger = {
  info: (_m: Record<string, unknown>) => undefined,
  warn: (_m: Record<string, unknown>) => undefined,
  error: (_m: Record<string, unknown>) => undefined,
  debug: (_m: Record<string, unknown>) => undefined,
};

/**
 * Apply SQL migrations tracked in SequelizeMeta. Set `SKIP_DB_MIGRATIONS=1` to fall back
 * to `sequelize.sync()` (emergency / local only).
 */
export async function runPendingMigrations(sequelize: Sequelize): Promise<void> {
  if (process.env.SKIP_DB_MIGRATIONS === '1') {
    await sequelize.sync();
    return;
  }

  const umzug = new Umzug({
    migrations: {
      glob: ['migrations/*.js', { cwd: __dirname }],
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger:
      process.env.UMZUG_LOG === '1'
        ? console
        : silentLogger,
  });

  await umzug.up();
}
