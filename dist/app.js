"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @swagger
 * /installations/{idSite}/stats:
 *   get:
 *     summary: Get installation stats from Victron VRM API
 *     description: Retrieves installation stats for the specified period, or one day if none specified. Proxies all query parameters and requires x-authorization header.
 *     tags:
 *       - Installation
 *     parameters:
 *       - in: path
 *         name: idSite
 *         required: true
 *         schema:
 *           type: string
 *         description: Installation id
 *       - in: header
 *         name: x-authorization
 *         required: true
 *         schema:
 *           type: string
 *         description: JWT token for authentication. Format: 'Token <token_value>' or 'Bearer <token_value>'.
 *       - in: query
 *         name: attributeCodes[]
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Attribute codes for which to retrieve series, repeated for each attribute. Required at least once if datatype is set to custom.
 *       - in: query
 *         name: end
 *         schema:
 *           type: integer
 *         description: Timestamp to which to fetch data, defaults to now.
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [15mins, hours, 2hours, days, weeks, months, years]
 *         description: Time between retrieved data points, defaults to hours.
 *       - in: query
 *         name: show_instance
 *         schema:
 *           type: boolean
 *         description: If included, attributes will be grouped by instance.
 *       - in: query
 *         name: start
 *         schema:
 *           type: integer
 *         description: Timestamp from which to fetch data, defaults to one day ago.
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [venus, live_feed, consumption, solar_yield, kwh, generator, generator-runtime, custom, forecast]
 *         description: Type of data to fetch, defaults to live_feed. If set to custom, the attributeCodes[] parameter must be provided.
 *     responses:
 *       200:
 *         description: Installation stats returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Unauthorized (invalid or missing token)
 *       429:
 *         description: Rate limit exceeded
 */
const config_1 = __importDefault(require("./config/config"));
const deviceRoutes_1 = __importDefault(require("./routes/deviceRoutes"));
const dotenv_1 = __importDefault(require("dotenv"));
const errorMiddleware_1 = __importDefault(require("./middlewares/errorMiddleware"));
const express_1 = __importDefault(require("express"));
const deviceController_1 = require("./controllers/deviceController");
const deviceController_2 = require("./controllers/deviceController");
const deviceController_3 = require("./controllers/deviceController");
const deviceController_4 = require("./controllers/deviceController");
const deviceController_5 = require("./controllers/deviceController");
const swagger_1 = require("./utils/swagger");
const winston_1 = __importDefault(require("winston"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
(0, swagger_1.setupSwagger)(app);
app.use('/api/devices', deviceRoutes_1.default);
app.get('/users/me', deviceController_5.getUserMe);
app.get('/installations/:idSite/stats', deviceController_1.getInstallationStats);
app.get('/installations/:idSite/stats/yesterday', deviceController_2.getInstallationStatsYesterday);
app.get('/installations/:idSite/summary', deviceController_3.getInstallationSummary);
app.get('/installations/:idSite/pv/realtime', deviceController_4.getPvRealtime);
app.get('/installations/stats', deviceController_1.getInstallationStats);
app.get('/installations/stats/yesterday', deviceController_2.getInstallationStatsYesterday);
app.get('/installations/summary', deviceController_3.getInstallationSummary);
app.get('/installations/pv/realtime', deviceController_4.getPvRealtime);
app.use(errorMiddleware_1.default);
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.json(),
    transports: [
        new winston_1.default.transports.Console(),
        new winston_1.default.transports.File({ filename: 'logs/app.log' })
    ]
});
app.listen(config_1.default.port, () => {
    logger.info(`Server running on port ${config_1.default.port}`);
});
