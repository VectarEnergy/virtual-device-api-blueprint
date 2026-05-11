/**
 * One-off: run catch-up from TRACKING_START_UTC through last completed 15m slot.
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { initSequelize, closeSequelize } = require('../dist/persistence/site-store');
const { catchUpMissedIntervals } = require('../dist/services/solarService');
const config = require('../dist/config/config').default;

(async () => {
  const siteId = process.env.VICTRON_SITE_ID || config.defaultSiteId;
  if (!siteId) {
    throw new Error('Set VICTRON_SITE_ID');
  }
  if (!config.trackingStartUtcSec) {
    throw new Error('Set TRACKING_START_UTC in .env');
  }
  await initSequelize();
  try {
    await catchUpMissedIntervals(siteId);
  } finally {
    await closeSequelize();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
