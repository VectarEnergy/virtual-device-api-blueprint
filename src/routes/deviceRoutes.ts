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
// Deprecated routes removed. This file previously contained multiple legacy endpoints and Swagger
// documentation. They were intentionally removed to keep the API surface minimal (only
// /installations/solar-yield is supported). Left a placeholder router for compatibility.
import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => res.status(410).json({ error: 'deprecated' }));
router.get('/users/me', (req, res) => res.status(410).json({ error: 'deprecated' }));

export default router;
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
import { Router } from 'express';
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
const router = Router();

// Legacy routes removed. Keep a placeholder to avoid compilation errors.
router.get('/', (req, res) => res.status(410).json({ error: 'deprecated' }));
router.get('/users/me', (req, res) => res.status(410).json({ error: 'deprecated' }));

export default router;
