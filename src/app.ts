import {
  initSequelize,
  migrateFromJsonIfNeeded as migrateJsonSequelize,
  closeSequelize,
  checkDbConnection,
} from './persistence/site-store';

/**
 * @openapi
 * /installations/solar-yield:
 *   get:
 *     summary: Stored cumulative solar yield (kWh) and last completed 15m window
 *     description: Uses `VICTRON_SITE_ID` when the path has no concrete id. Data is synced from Victron VRM `total_solar_yield` on a 15-minute scheduler.
 *     tags:
 *       - Installation
 *     parameters:
 *       - in: header
 *         name: x-authorization
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional token for on-demand VRM fetches; the scheduler uses VICTRON_API_TOKEN.
 *     responses:
 *       200:
 *         description: Stored report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 retrievedAt:
 *                   type: string
 *                   format: date-time
 *                 lastHour:
 *                   type: object
 *                   nullable: true
 *                 cumulative_kwh:
 *                   type: number
 *                 cumulative_kwh_raw:
 *                   type: number
 */
import http from 'http';

import { setupSwagger } from './api/openapi/swagger-setup';
import config from './config/config';
import { assertProductionConfig } from './config/validateEnv';
import { logger } from './common/logging/logger';
import errorMiddleware from './http/error.middleware';
import express from 'express';
import { getSolarYield } from './http/solar-yield.controller';
import { startScheduler, type SchedulerHandle } from './services/solarService';

assertProductionConfig();

const app = express();
if (config.trustProxy) {
  app.set('trust proxy', 1);
}

app.use(express.json());
setupSwagger(app);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/ready', async (_req, res) => {
  try {
    await checkDbConnection();
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not_ready' });
  }
});

app.get('/installations/:idSite/solar-yield', getSolarYield);
app.get('/installations/solar-yield', getSolarYield);
app.use(errorMiddleware);

let schedulerHandle: SchedulerHandle | undefined;

initSequelize()
  .then(async () => {
    try {
      await migrateJsonSequelize();
    } catch (err) {
      logger.error('JSON→DB migration error', {
        message: (err as Error)?.message ?? String(err),
      });
    }

    const server = http.createServer(app);

    await new Promise<void>((resolve, reject) => {
      server.listen(config.port, () => resolve());
      server.once('error', reject);
    });

    logger.info('Server listening', { port: config.port, env: config.env });

    let shuttingDown = false;
    const shutdown = (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info('Shutdown begin', { signal });

      schedulerHandle?.stop();

      server.close(async (closeErr) => {
        if (closeErr) {
          logger.error('HTTP server close error', {
            message: closeErr.message,
          });
        }
        try {
          await closeSequelize();
        } catch (e) {
          logger.error('Sequelize close error', {
            message: (e as Error)?.message ?? String(e),
          });
        }
        process.exit(closeErr ? 1 : 0);
      });

      setTimeout(() => {
        logger.error('Shutdown forced after timeout');
        process.exit(1);
      }, 25_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    if (config.defaultSiteId) {
      schedulerHandle = startScheduler(config.defaultSiteId);
    }
  })
  .catch((err) => {
    logger.error('DB init error', { message: (err as Error)?.message ?? String(err) });
    process.exit(1);
  });
