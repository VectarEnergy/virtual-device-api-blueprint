// Fetch and store for a specific hour interval (start/end in epoch seconds)
export const fetchAndStoreHour = async (siteId: string, start: number, end: number, token?: string) => {
  if (!config.victronApiUrl) throw new Error('VICTRON_API_URL not configured');
  const url = buildVictronUrlForHour(siteId, start, end);
  const headers: Record<string, string> = {};
  if (token) headers['x-authorization'] = token;
  else if (config.victronToken) headers['x-authorization'] = `Token ${config.victronToken}`;

  const resp = await axios.get(url, { headers });
  const data = (resp.data as any) || {};
  // Log the raw API response for debugging
  console.log(`\n[DEBUG] VRM API response for ${new Date(start*1000).toISOString()} - ${new Date(end*1000).toISOString()}:`);
  console.dir(data, { depth: 10 });
  const totals = data.totals ?? {};
  let total = typeof totals[VICTRON_ATTR] === 'number' ? Number(totals[VICTRON_ATTR]) : undefined;
  let absolute: number | undefined = undefined;
  if (total === undefined) {
    const records = data.records ?? {};
    const series = records[VICTRON_ATTR] || [];
    const parsed = parseSolarSeriesTotal(series);
    total = Number(parsed.total || 0);
    absolute = parsed.absolute;
  }
  total = Number(total || 0);
  const retrievedAt = new Date().toISOString();
  await updateSiteState(siteId, (s) => {
    s.history = s.history || [];
    const firstIdx = s.history.findIndex((h: any) => h && h.start === start && h.end === end);
    if (firstIdx >= 0) {
      s.history[firstIdx] = { start, end, value: Number(total.toFixed(6)), retrievedAt };
      s.lastHour = s.history[firstIdx];
      return;
    }
    s.cumulative = Number((s.cumulative + total).toFixed(6));
    const rec: any = { start, end, value: Number(total.toFixed(6)), retrievedAt };
    if (typeof absolute === 'number') rec.absolute = absolute;
    rec.vrmTotal = Number(total.toFixed(6));
    s.lastHour = rec;
    s.history.push(rec);
  });
  return { start, end, total, absolute, retrievedAt };
};
import { getSiteState, seedSiteCumulative, updateSiteState } from '../lib/sequelizeAdapter';

import axios from 'axios';
import config from '../config/config';

// Use the VRM attribute that returns hourly totals/absolute meter values
const VICTRON_ATTR = 'total_solar_yield';

const getLastHourRangeUtc = () => {
  const now = new Date();
  // compute previous full hour range in UTC
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  const utcDate = now.getUTCDate();
  const utcHour = now.getUTCHours();
  const end = Date.UTC(utcYear, utcMonth, utcDate, utcHour, 0, 0) - 1; // end of previous hour
  const start = end - 60 * 60 * 1000 + 1; // start of previous hour
  return { start: Math.floor(start / 1000), end: Math.floor(end / 1000) };
};

const buildVictronUrlForHour = (siteId: string, start: number, end: number) => {
  // Query hourly totals. Use interval=hours and pass explicit start/end epoch seconds.
  // preserve attributeCodes[] encoding as requested
  return `${config.victronApiUrl}/installations/${siteId}/stats?type=custom&interval=hours&attributeCodes%5B%5D=${encodeURIComponent(VICTRON_ATTR)}&start=${start}&end=${end}`;
};

const parseSolarSeriesTotal = (series: any[]): { total: number; absolute?: number } => {
  // Treat series values as per-sample kWh (as provided by VRM). Compute the
  // total for the window by summing all sample values. Also return the raw
  // last datapoint as `absolute` for reference.
  if (!Array.isArray(series) || series.length === 0) return { total: 0 };

  const values: number[] = series
    .map((v) => {
      const raw = Array.isArray(v) ? v[v.length - 1] : v;
      return Number(raw);
    })
    .filter((n) => isFinite(n));

  if (values.length === 0) return { total: 0 };

  const summed = values.reduce((acc, v) => acc + v, 0);
  const last = values[values.length - 1];
  return { total: summed, absolute: last };
};

export const fetchAndStoreLastHour = async (siteId: string, token?: string) => {
  if (!config.victronApiUrl) throw new Error('VICTRON_API_URL not configured');
  const { start, end } = getLastHourRangeUtc();
  const url = buildVictronUrlForHour(siteId, start, end);
  const headers: Record<string, string> = {};
  if (token) headers['x-authorization'] = token;
  else if (config.victronToken) headers['x-authorization'] = `Token ${config.victronToken}`;

  const resp = await axios.get(url, { headers });
  const data = (resp.data as any) || {};
  // Prefer the totals object if present — VRM returns totals.total_solar_yield as the summed value
  const totals = data.totals ?? {};
  let total = typeof totals[VICTRON_ATTR] === 'number' ? Number(totals[VICTRON_ATTR]) : undefined;
  let absolute: number | undefined = undefined;

  if (total === undefined) {
    // Fallback: parse series values (older behavior)
    const records = data.records ?? {};
    const series = records[VICTRON_ATTR] || [];
    const parsed = parseSolarSeriesTotal(series);
    total = Number(parsed.total || 0);
    absolute = parsed.absolute;
  }
  total = Number(total || 0);

  const retrievedAt = new Date().toISOString();

  await updateSiteState(siteId, (s) => {
    // Make the update idempotent: if we already have an entry for this
    // start/end, replace it and only apply the difference to cumulative.
    s.history = s.history || [];
  // Find any existing history entry for this hour and compute the previous value
    // If we already have an entry for this hour, replace the first occurrence
    // and do not change the cumulative (prevents double-counting on repeated fetches).
    const firstIdx = s.history.findIndex((h: any) => h && h.start === start && h.end === end);
    if (firstIdx >= 0) {
      s.history[firstIdx] = { start, end, value: Number(total.toFixed(6)), retrievedAt };
      s.lastHour = s.history[firstIdx];
      return;
    }

    // Otherwise add the new total once.
    s.cumulative = Number((s.cumulative + total).toFixed(6));
  const rec: any = { start, end, value: Number(total.toFixed(6)), retrievedAt };
    if (typeof absolute === 'number') rec.absolute = absolute;
  // keep the VRM-reported total available for inspection
  rec.vrmTotal = Number(total.toFixed(6));
    s.lastHour = rec;
  s.history.push(rec);
  });

  return { start, end, total, absolute, retrievedAt };
};

// Scheduler: start at next top-of-hour UTC, then run every hour
// Scheduler: schedule first run at configured hour (default 06:00 UTC) then every hour
export const startScheduler = (siteId: string) => {
  // Allow override via environment variable (0-23). Default to 6 (06:00 UTC).
  const configuredHour = Number(process.env.VICTRON_SCHED_START_HOUR ?? 6);
  const now = new Date();

  // Build the next occurrence of the configuredHour in UTC.
  const candidate = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), configuredHour, 0, 5);
  let firstRunAt = candidate;
  if (firstRunAt <= now.getTime()) {
    // already past today's configured hour -> schedule for tomorrow
    firstRunAt = candidate + 24 * 60 * 60 * 1000;
  }

  const delay = firstRunAt - now.getTime();

  setTimeout(() => {
    // run first then every hour
    (async () => {
      try {
        await fetchAndStoreLastHour(siteId);
      } catch (err) {
        // log and continue
        // eslint-disable-next-line no-console
        console.error('solar scheduler error', (err as any)?.message || err);
      }
    })();

    setInterval(async () => {
      try {
        await fetchAndStoreLastHour(siteId);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('solar scheduler error', (err as any)?.message || err);
      }
    }, 60 * 60 * 1000);
  }, delay);
};

export const getStoredSiteReport = async (siteId: string) => {
  const s = await getSiteState(siteId);
  // Always recalculate cumulative as the sum of all valid history values
  const history = Array.isArray(s.history) ? s.history : [];
  const cumulative = history.reduce((acc, h) => acc + (typeof h.value === 'number' ? h.value : 0), 0);
  return { ...s, cumulative };
};

export const seedInitialCumulative = async (siteId: string, value: number) => {
  await seedSiteCumulative(siteId, value, true);
};
