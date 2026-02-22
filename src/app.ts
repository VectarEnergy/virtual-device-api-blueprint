/**
 * @openapi
 * /installations/solar-yield:
 *   get:
 *     summary: Get stored cumulative solar_yield and last completed hour value for the default installation
 *     description: Returns the stored cumulative solar_yield (kWh) and the most recent completed hour's solar_yield increment. Data is collected hourly by a background scheduler and persisted to disk. This endpoint uses the `VICTRON_SITE_ID` configured in the environment to determine which installation to report on.
 *     tags:
 *       - Installation
 *     parameters:
 *       - in: header
 *         name: x-authorization
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional. Token to use when performing on-demand fetches. Background scheduler uses the VICTRON_API_TOKEN in .env.local.
 *     responses:
 *       200:
 *         description: Stored solar_yield report
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
 *                   properties:
 *                     start:
 *                       type: string
 *                       format: date-time
 *                     end:
 *                       type: string
 *                       format: date-time
 *                     value:
 *                       type: number
 *                     retrievedAt:
 *                       type: string
 *                       format: date-time
 *                 cumulative_kwh:
 *                   type: number
 */
/**
 * @openapi
 * /installations/solar-yield:
 *   get:
 *     summary: Get stored cumulative solar_yield and last completed hour value for the default installation
 *     description: Returns the stored cumulative solar_yield (kWh) and the most recent completed hour's solar_yield increment. Data is collected hourly by a background scheduler and persisted to disk. This endpoint uses the `VICTRON_SITE_ID` configured in the environment to determine which installation to report on.
 *     tags:
 *       - Installation
 *     parameters:
 *       - in: header
 *         name: x-authorization
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional. Token to use when performing on-demand fetches. Background scheduler uses the VICTRON_API_TOKEN in .env.local.
 *     responses:
 *       200:
 *         description: Stored solar_yield report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 siteId:
 *                   type: string
 *                 retrievedAt:
 *                   type: string
 *                   format: date-time
 *                 lastHour:
 *                   type: object
 *                   properties:
 *                     start:
 *                       type: integer
 *                     end:
 *                       type: integer
 *                     value:
 *                       type: number
 *                     retrievedAt:
 *                       type: string
 *                       format: date-time
 *                 cumulative_kwh:
 *                   type: number
 */
import config from './config/config';
import errorMiddleware from './middlewares/errorMiddleware';
import express from 'express';
import { getSolarYield } from './controllers/deviceController';
import { setupSwagger } from './utils/swagger';
import { startScheduler } from './services/solarService';
import { initSequelize, migrateFromJsonIfNeeded as migrateJsonSequelize } from './lib/sequelizeAdapter';
import winston from 'winston';
const app = express();

app.use(express.json());
setupSwagger(app);
// support both parameterized and default-site routes
// only expose the single canonical route — uses VICTRON_SITE_ID from env
// support both parameterized and default-site routes
// both paths delegate to the same controller which resolves the site id
app.get('/installations/:idSite/solar-yield', getSolarYield);
app.get('/installations/solar-yield', getSolarYield);
app.use(errorMiddleware);

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/app.log' })
  ]
});

// initialize DB and migrate JSON store if present, then start server + scheduler
initSequelize()
  .then(async () => {
    try {
      await migrateJsonSequelize();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('DB migration error', (err as any)?.message || err);
    }

    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
    });

    // start background scheduler for default site if configured
    if (config.defaultSiteId) {
      startScheduler(config.defaultSiteId);
    }
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('DB init error', (err as any)?.message || err);
    process.exit(1);
  });
