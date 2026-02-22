"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @swagger
 * /installations/{idSite}/summary:
 *   get:
 *     summary: Get 3-hour interval summary for the last 24 hours
 *     description: Returns an array of records with timestamp, Pt (load), Pg (grid), and Pb (solar) for the last 24 hours in 3-hour intervals from the Victron API.
 *     tags:
 *       - Installation
 *     parameters:
 *       - in: path
 *         name: idSite
 *         required: false
 *         schema:
 *           type: string
 *         description: Installation id (optional if VICTRON_SITE_ID is set)
 *       - in: header
 *         name: x-authorization
 *         required: false
 *         schema:
 *           type: string
 *         description: JWT token for authentication. Format Token <token_value> or Bearer <token_value>. Optional if VICTRON_API_TOKEN is set.
 *     responses:
 *       200:
 *         description: Array of summary records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   timestamp:
 *                     type: integer
 *                     description: Unix timestamp (seconds)
 *                   Pt:
 *                     type: number
 *                     description: Total power consumption (W)
 *                   Pg:
 *                     type: number
 *                     description: Grid power (W)
 *                   Pb:
 *                     type: number
 *                     description: PV (solar) power (W)
 *       401:
 *         description: Unauthorized (invalid or missing token)
 *       429:
 *         description: Rate limit exceeded
 */
/**
 * @swagger
 * /installations/summary:
 *   get:
 *     summary: Get 3-hour interval summary for the last 24 hours (default site)
 *     description: Same as /installations/{idSite}/summary but uses VICTRON_SITE_ID when no path parameter is provided.
 *     tags:
 *       - Installation
 *     parameters:
 *       - in: header
 *         name: x-authorization
 *         required: false
 *         schema:
 *           type: string
 *         description: JWT token for authentication. Format Token <token_value> or Bearer <token_value>. Optional if VICTRON_API_TOKEN is set.
 *     responses:
 *       200:
 *         description: Array of summary records
 *       401:
 *         description: Unauthorized (invalid or missing token)
 */
/**
 * @swagger
 * /installations/{idSite}/pv/realtime:
 *   get:
 *     summary: Get PV realtime metrics from live feed
 *     description: Fetches live_feed data from Victron and calculates average voltage, total current, total power, and cumulative energy for PV strings.
 *     tags:
 *       - Installation
 *     parameters:
 *       - in: path
 *         name: idSite
 *         required: false
 *         schema:
 *           type: string
 *         description: Installation id (optional if VICTRON_SITE_ID is set)
 *       - in: header
 *         name: x-authorization
 *         required: false
 *         schema:
 *           type: string
 *         description: JWT token for authentication. Format Token <token_value> or Bearer <token_value>. Optional if VICTRON_API_TOKEN is set.
 *     responses:
 *       200:
 *         description: PV realtime metrics and raw string values
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 retrievedAt:
 *                   type: string
 *                   format: date-time
 *                 pvStringCount:
 *                   type: integer
 *                 realtimeAverageVoltage:
 *                   type: number
 *                 realtimeCurrent:
 *                   type: number
 *                 realtimePower:
 *                   type: number
 *                 cumulativeEnergyKwh:
 *                   type: number
 *       400:
 *         description: Missing idSite and no VICTRON_SITE_ID configured
 *       401:
 *         description: Unauthorized (invalid or missing token)
 *       422:
 *         description: PV string data missing from live_feed response
 */
/**
 * @swagger
 * /installations/pv/realtime:
 *   get:
 *     summary: Get PV realtime metrics from live feed (default site)
 *     description: Same as /installations/{idSite}/pv/realtime but uses VICTRON_SITE_ID when no path parameter is provided.
 *     tags:
 *       - Installation
 *     parameters:
 *       - in: header
 *         name: x-authorization
 *         required: false
 *         schema:
 *           type: string
 *         description: JWT token for authentication. Format Token <token_value> or Bearer <token_value>. Optional if VICTRON_API_TOKEN is set.
 *     responses:
 *       200:
 *         description: PV realtime metrics and raw string values
 *       401:
 *         description: Unauthorized (invalid or missing token)
 *       422:
 *         description: PV string data missing from live_feed response
 */
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
 *         required: false
 *         schema:
 *           type: string
 *         description: Installation id (optional if VICTRON_SITE_ID is set)
 *       - in: header
 *         name: x-authorization
 *         required: false
 *         schema:
 *           type: string
 *         description: JWT token for authentication. Format Token <token_value> or Bearer <token_value>. Optional if VICTRON_API_TOKEN is set.
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
/**
 * @swagger
 * /installations/stats:
 *   get:
 *     summary: Get installation stats (default site)
 *     description: Same as /installations/{idSite}/stats but uses VICTRON_SITE_ID when no path parameter is provided.
 *     tags:
 *       - Installation
 *     parameters:
 *       - in: header
 *         name: x-authorization
 *         required: false
 *         schema:
 *           type: string
 *         description: JWT token for authentication. Format Token <token_value> or Bearer <token_value>. Optional if VICTRON_API_TOKEN is set.
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
 *       401:
 *         description: Unauthorized (invalid or missing token)
 */
/**
 * @swagger
 * /installations/{idSite}/stats/yesterday:
 *   get:
 *     summary: Get installation stats for yesterday (UTC)
 *     description: Returns stats for the full UTC day yesterday. Accepts the same query parameters as /stats, but overrides start/end to yesterday.
 *     tags:
 *       - Installation
 *     parameters:
 *       - in: path
 *         name: idSite
 *         required: false
 *         schema:
 *           type: string
 *         description: Installation id (optional if VICTRON_SITE_ID is set)
 *       - in: header
 *         name: x-authorization
 *         required: false
 *         schema:
 *           type: string
 *         description: JWT token for authentication. Format Token <token_value> or Bearer <token_value>. Optional if VICTRON_API_TOKEN is set.
 *     responses:
 *       200:
 *         description: Stats for yesterday
 *       401:
 *         description: Unauthorized (invalid or missing token)
 */
/**
 * @swagger
 * /installations/stats/yesterday:
 *   get:
 *     summary: Get installation stats for yesterday (default site)
 *     description: Same as /installations/{idSite}/stats/yesterday but uses VICTRON_SITE_ID when no path parameter is provided.
 *     tags:
 *       - Installation
 *     parameters:
 *       - in: header
 *         name: x-authorization
 *         required: false
 *         schema:
 *           type: string
 *         description: JWT token for authentication. Format Token <token_value> or Bearer <token_value>. Optional if VICTRON_API_TOKEN is set.
 *     responses:
 *       200:
 *         description: Stats for yesterday
 *       401:
 *         description: Unauthorized (invalid or missing token)
 */
const express_1 = require("express");
const deviceController_1 = require("../controllers/deviceController");
/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get current user info from Victron VRM API
 *     description: Returns the authenticated user's info from the Victron VRM API using the configured token.
 *     tags:
 *       - User
 *     parameters:
 *       - in: header
 *         name: x-authorization
 *         required: false
 *         schema:
 *           type: string
 *         description: >-
 *           JWT token for authentication. Format: 'Token <token_value>' or 'Bearer <token_value>'. Optional if VICTRON_API_TOKEN is set.
 *     responses:
 *       200:
 *         description: User info returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 # Add more fields as needed based on actual API response
 *       401:
 *         description: Unauthorized (invalid or missing token)
 *       429:
 *         description: Rate limit exceeded
 */
const deviceController_2 = require("../controllers/deviceController");
const router = (0, express_1.Router)();
router.get('/', deviceController_1.getAllDevices);
router.get('/users/me', deviceController_2.getUserMe);
exports.default = router;
