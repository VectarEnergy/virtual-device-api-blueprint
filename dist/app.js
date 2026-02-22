"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
 *         description: Optional. Token to use when performing on-demand fetches. Background scheduler uses the VICTRON_API_TOKEN in .env.
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
 *         description: Optional. Token to use when performing on-demand fetches. Background scheduler uses the VICTRON_API_TOKEN in .env.
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
const config_1 = __importDefault(require("./config/config"));
const dotenv_1 = __importDefault(require("dotenv"));
const errorMiddleware_1 = __importDefault(require("./middlewares/errorMiddleware"));
const express_1 = __importDefault(require("express"));
const deviceController_1 = require("./controllers/deviceController");
const swagger_1 = require("./utils/swagger");
const solarService_1 = require("./services/solarService");
const sequelizeAdapter_1 = require("./lib/sequelizeAdapter");
const winston_1 = __importDefault(require("winston"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
(0, swagger_1.setupSwagger)(app);
// support both parameterized and default-site routes
// only expose the single canonical route — uses VICTRON_SITE_ID from env
// support both parameterized and default-site routes
// both paths delegate to the same controller which resolves the site id
app.get('/installations/:idSite/solar-yield', deviceController_1.getSolarYield);
app.get('/installations/solar-yield', deviceController_1.getSolarYield);
app.use(errorMiddleware_1.default);
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.json(),
    transports: [
        new winston_1.default.transports.Console(),
        new winston_1.default.transports.File({ filename: 'logs/app.log' })
    ]
});
// initialize DB and migrate JSON store if present, then start server + scheduler
(0, sequelizeAdapter_1.initSequelize)()
    .then(async () => {
    try {
        await (0, sequelizeAdapter_1.migrateFromJsonIfNeeded)();
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error('DB migration error', err?.message || err);
    }
    app.listen(config_1.default.port, () => {
        logger.info(`Server running on port ${config_1.default.port}`);
    });
    // start background scheduler for default site if configured
    if (config_1.default.defaultSiteId) {
        (0, solarService_1.startScheduler)(config_1.default.defaultSiteId);
    }
})
    .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('DB init error', err?.message || err);
    process.exit(1);
});
