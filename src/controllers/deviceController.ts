import { NextFunction, Request, Response } from 'express';

import config from '../config/config';
import { getStoredSiteReport } from '../services/solarService';

const resolveSiteId = (param: string | string[] | undefined): string => {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value || value === '{idSite}' || value === 'idSite') {
    return config.defaultSiteId;
  }
  return value;
};

export const getSolarYield = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idSite = resolveSiteId(req.params.idSite);
    if (!idSite) return res.status(400).json({ error: 'idSite required or set VICTRON_SITE_ID' });
    const state = await getStoredSiteReport(idSite);
    const cumulative = typeof state.cumulative === 'number' ? Number(state.cumulative.toFixed(2)) : 0;
    let last = null;
    if (state.lastHour) {
      const lh = state.lastHour;
      // convert epoch seconds (if numeric) to UTC ISO strings for start/end
      const startIso = typeof lh.start === 'number' ? new Date(lh.start * 1000).toISOString() : lh.start;
      const endIso = typeof lh.end === 'number' ? new Date(lh.end * 1000).toISOString() : lh.end;
      const retrievedAtIso = lh.retrievedAt ? new Date(lh.retrievedAt).toISOString() : new Date().toISOString();
      last = {
        start: startIso,
        end: endIso,
        value: Number((lh.value || 0).toFixed(2)),
        retrievedAt: retrievedAtIso
      };
    }
  // Do not return siteId per request — return retrievedAt, lastHour, cumulative_kwh
  // and the VRM-reported total for the hour (if present) as `vrm_total_kwh`.
  const response: any = { retrievedAt: new Date().toISOString(), lastHour: last, cumulative_kwh: cumulative };
  if (last && (((last as any).vrmTotal) || (last as any).vrmTotal === 0)) response.vrm_total_kwh = Number((last as any).vrmTotal);
  res.json(response);
  } catch (err) {
    next(err);
  }
};
