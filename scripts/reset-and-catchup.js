/**
 * Clear solar state for VICTRON_SITE_ID, then catch-up.
 *   CONFIRM_RESET_SITE=1 npm run catchup:fresh
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const {
  initSequelize,
  closeSequelize,
  resetSiteSolarState,
} = require('../dist/persistence/site-store');
const { catchUpMissedIntervals } = require('../dist/services/solarService');
const config = require('../dist/config/config').default;

(async () => {
  if (process.env.CONFIRM_RESET_SITE !== '1') {
    throw new Error(
      'Refusing to wipe data without CONFIRM_RESET_SITE=1 (see scripts/reset-and-catchup.js)',
    );
  }
  const siteId = process.env.VICTRON_SITE_ID || config.defaultSiteId;
  if (!siteId) {
    throw new Error('Set VICTRON_SITE_ID');
  }
  if (!config.trackingStartUtcSec) {
    throw new Error('Set TRACKING_START_UTC in .env');
  }

  await initSequelize();
  try {
    console.log(`[reset] Clearing solar state for site ${siteId}`);
    await resetSiteSolarState(siteId);
    await catchUpMissedIntervals(siteId);
  } finally {
    await closeSequelize();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
