import { NextFunction, Request, Response } from "express";

import config from "../config/config";
import { getStoredSiteReport } from "../services/solarService";

const resolveSiteId = (param: string | string[] | undefined): string => {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value || value === "{idSite}" || value === "idSite") {
    return config.defaultSiteId;
  }
  return value;
};

export const getSolarYield = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const idSite = resolveSiteId(req.params.idSite);
    if (!idSite)
      return res
        .status(400)
        .json({ error: "idSite required or set VICTRON_SITE_ID" });
    const state = await getStoredSiteReport(idSite);
    const cumulativeRaw =
      typeof state.cumulative === "number" ? state.cumulative : 0;
    const cumulative = Number(cumulativeRaw.toFixed(2));

    let last = null;
    if (state.lastHour) {
      const lh = state.lastHour;
      // convert epoch seconds (if numeric) to UTC ISO strings for start/end
      const startIso =
        typeof lh.start === "number"
          ? new Date(lh.start * 1000).toISOString()
          : lh.start;
      const endIso =
        typeof lh.end === "number"
          ? new Date(lh.end * 1000).toISOString()
          : lh.end;
      const retrievedAtIso = lh.retrievedAt
        ? new Date(lh.retrievedAt).toISOString()
        : new Date().toISOString();
      const lastValueRaw = typeof lh.value === "number" ? lh.value : 0;

      last = {
        start: startIso,
        end: endIso,
        value: Number(lastValueRaw.toFixed(2)),
        value_raw: lastValueRaw,
        retrievedAt: retrievedAtIso,
      };
    }

    // Do not return siteId per request — return retrievedAt, lastHour, cumulative_kwh
    // and include raw precision values for analytics/verification.
    const response: any = {
      retrievedAt: new Date().toISOString(),
      lastHour: last,
      cumulative_kwh: cumulative,
      cumulative_kwh_raw: cumulativeRaw,
    };

    if (
      state.lastHour &&
      ((state.lastHour as any).vrmTotal ||
        (state.lastHour as any).vrmTotal === 0)
    ) {
      response.vrm_total_kwh = Number((state.lastHour as any).vrmTotal);
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
};
