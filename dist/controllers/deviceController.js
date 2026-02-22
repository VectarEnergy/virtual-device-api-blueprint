"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSolarYield = void 0;
const config_1 = __importDefault(require("../config/config"));
const solarService_1 = require("../services/solarService");
const resolveSiteId = (param) => {
    const value = Array.isArray(param) ? param[0] : param;
    if (!value || value === '{idSite}' || value === 'idSite') {
        return config_1.default.defaultSiteId;
    }
    return value;
};
const getSolarYield = async (req, res, next) => {
    try {
        const idSite = resolveSiteId(req.params.idSite);
        if (!idSite)
            return res.status(400).json({ error: 'idSite required or set VICTRON_SITE_ID' });
        const state = await (0, solarService_1.getStoredSiteReport)(idSite);
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
        const response = { retrievedAt: new Date().toISOString(), lastHour: last, cumulative_kwh: cumulative };
        if (last && ((last.vrmTotal) || last.vrmTotal === 0))
            response.vrm_total_kwh = Number(last.vrmTotal);
        res.json(response);
    }
    catch (err) {
        next(err);
    }
};
exports.getSolarYield = getSolarYield;
