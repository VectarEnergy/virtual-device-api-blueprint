/**
 * Destructive daily rebuild from VRM. Requires CONFIRM_REBUILD_DAILY=1.
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { initSequelize, closeSequelize } = require('../dist/persistence/site-store');
const { rebuildSiteHistoryDailyFromVrm } = require('../dist/services/solarService');

(async () => {
  if (process.env.CONFIRM_REBUILD_DAILY !== '1') {
    console.error(
      'Refusing: this deletes existing history. Set CONFIRM_REBUILD_DAILY=1',
    );
    process.exit(1);
  }

  const siteId = process.env.VICTRON_SITE_ID;
  if (!siteId) throw new Error('VICTRON_SITE_ID required');

  await initSequelize();
  try {
    const r = await rebuildSiteHistoryDailyFromVrm(siteId);
    console.log(JSON.stringify(r, null, 2));
  } finally {
    await closeSequelize();
  }
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
