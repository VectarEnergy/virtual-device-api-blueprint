/**
 * DB sum(history) vs VRM for the same epoch range.
 *   npm run reconcile
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { initSequelize, closeSequelize } = require('../dist/persistence/site-store');
const { reconcileSolarYieldWithVrm } = require('../dist/services/solarService');

(async () => {
  const siteId = process.env.VICTRON_SITE_ID;
  if (!siteId) throw new Error('VICTRON_SITE_ID required');

  const iv = (process.env.RECONCILE_INTERVAL || 'days').trim().toLowerCase();
  const vrmInterval = iv === 'months' || iv === 'month' ? 'months' : 'days';

  await initSequelize();
  try {
    const r = await reconcileSolarYieldWithVrm(siteId, { vrmInterval });
    console.log(JSON.stringify(r, null, 2));
  } finally {
    await closeSequelize();
  }
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
