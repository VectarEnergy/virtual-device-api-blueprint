// Script to clear today's solar yield data and repopulate from 00:00 UTC to now
const { initSequelize, updateSiteState } = require('./dist/lib/sequelizeAdapter');
const { fetchAndStoreHour } = require('./dist/services/solarService');
const config = require('./dist/config/config').default;

async function clearSite(siteId) {
  await initSequelize();
  await updateSiteState(siteId, () => ({ cumulative: 0, lastHour: null, history: [] }));
  console.log(`Cleared site state for ${siteId}`);
}

function getTodayHourRanges() {
  // Fetch from 00:00 up to and including 07:00-07:59 (i.e., 8 intervals)
  const now = new Date();
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  const utcDate = now.getUTCDate();
  const ranges = [];
  for (let h = 0; h < 8; ++h) {
    const start = Date.UTC(utcYear, utcMonth, utcDate, h, 0, 0) / 1000;
    const end = Date.UTC(utcYear, utcMonth, utcDate, h + 1, 0, 0) / 1000 - 1;
    ranges.push({ start: Math.floor(start), end: Math.floor(end) });
  }
  return ranges;
}


async function fetchFromHourToNow(startHour) {
  const now = new Date();
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  const utcDate = now.getUTCDate();
  const currentHour = now.getUTCHours();
  const siteId = process.env.VICTRON_SITE_ID || config.defaultSiteId;
  if (!siteId) throw new Error('No siteId configured');
  for (let h = startHour; h < currentHour; ++h) {
    const start = Date.UTC(utcYear, utcMonth, utcDate, h, 0, 0) / 1000;
    const end = Date.UTC(utcYear, utcMonth, utcDate, h + 1, 0, 0) / 1000 - 1;
    console.log(`Fetching for hour: ${new Date(start * 1000).toISOString()} - ${new Date(end * 1000).toISOString()}`);
    await fetchAndStoreLastHour(siteId);
  }
  console.log('Done.');
  process.exit(0);
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'from6') {
    await fetchFromHourToNow(6);
    return;
  }
  const siteId = process.env.VICTRON_SITE_ID || config.defaultSiteId;
  if (!siteId) throw new Error('No siteId configured');
  await clearSite(siteId);
  const ranges = getTodayHourRanges();
  for (const { start, end } of ranges) {
    console.log(`Fetching for hour: ${new Date(start * 1000).toISOString()} - ${new Date(end * 1000).toISOString()}`);
    await fetchAndStoreHour(siteId, start, end);
  }
  console.log('Done.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
