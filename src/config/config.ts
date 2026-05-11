import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

/** Start of the 15-minute UTC window containing `epochSec`. */
const alignToIntervalStartSec = (epochSec: number, intervalSec: number): number =>
  Math.floor(epochSec / intervalSec) * intervalSec;

/**
 * When you began tracking (ISO 8601). Catch-up fills every completed 15m slot
 * from this instant through the latest completed interval.
 * Legacy aliases: SOLAR_FETCH_SINCE, SOLAR_BACKFILL_START.
 */
const parseTrackingStartUtcSec = (): number | undefined => {
  const raw =
    process.env.TRACKING_START_UTC?.trim() ||
    process.env.SOLAR_FETCH_SINCE?.trim() ||
    process.env.SOLAR_BACKFILL_START?.trim();
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  const sec = Math.floor(d.getTime() / 1000);
  return alignToIntervalStartSec(sec, 15 * 60);
};

/** Backfill/catch-up only: `days` or `months` (VRM `interval=`). Live scheduler still uses 15m. */
const parseCatchUpVrmInterval = (): "days" | "months" => {
  const r = (process.env.CATCHUP_VRM_INTERVAL || "days").trim().toLowerCase();
  if (r === "months" || r === "month") return "months";
  return "days";
};

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

const parsePort = (): number => {
  const p = Number(process.env.PORT);
  return Number.isFinite(p) && p > 0 ? p : 3000;
};

const parseMs = (key: string, def: number, lo: number, hi: number): number =>
  clamp(parseInt(process.env[key] || String(def), 10) || def, lo, hi);

const parseCount = (key: string, def: number, lo: number, hi: number): number =>
  clamp(parseInt(process.env[key] || String(def), 10) || def, lo, hi);

const port = parsePort();

export default {
  port,
  victronApiUrl: process.env.VICTRON_API_URL || '',
  victronToken: process.env.VICTRON_API_TOKEN || '',
  defaultSiteId: process.env.VICTRON_SITE_ID || '',
  env: process.env.NODE_ENV || 'development',
  trackingStartUtcSec: parseTrackingStartUtcSec(),
  catchUpVrmInterval: parseCatchUpVrmInterval(),
  /** Victron HTTP timeout (ms). */
  vrmRequestTimeoutMs: parseMs("VRM_REQUEST_TIMEOUT_MS", 45_000, 5_000, 120_000),
  /** Extra attempts after the first failing request (0 = no retries). */
  vrmMaxRetries: parseCount("VRM_MAX_RETRIES", 2, 0, 5),
  publicApiUrl:
    process.env.PUBLIC_API_URL?.trim() || `http://localhost:${port}`,
  trustProxy: process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true",
};
