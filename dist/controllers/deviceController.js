"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllDevices = exports.getUserMe = exports.getPvRealtime = exports.getInstallationStatsYesterday = exports.getInstallationStats = exports.getInstallationSummary = void 0;
const deviceDTO_1 = require("../dtos/deviceDTO");
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../config/config"));
const deviceService_1 = require("../services/deviceService");
const deviceService_2 = require("../services/deviceService");
const normalizeAuthHeader = (token) => {
    const fallback = config_1.default.victronToken ? `Token ${config_1.default.victronToken}` : null;
    if (!token)
        return fallback;
    const value = Array.isArray(token) ? token[0] : token;
    if (/^(Bearer|Token)\s+/i.test(value)) {
        return value;
    }
    return `Token ${value}`;
};
const resolveSiteId = (param) => {
    const value = Array.isArray(param) ? param[0] : param;
    if (!value || value === '{idSite}' || value === 'idSite') {
        return config_1.default.defaultSiteId;
    }
    return value;
};
const getYesterdayRangeUtc = () => {
    const now = new Date();
    const todayUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const yesterdayStart = todayUtcMidnight - 24 * 60 * 60 * 1000;
    const yesterdayEnd = todayUtcMidnight - 1;
    return {
        start: Math.floor(yesterdayStart / 1000),
        end: Math.floor(yesterdayEnd / 1000)
    };
};
const extractLatestSeries = (series) => {
    if (!Array.isArray(series) || series.length === 0)
        return [];
    const last = series[series.length - 1];
    if (Array.isArray(last)) {
        if (typeof last[0] === 'number') {
            return last.slice(1).map(Number).filter(val => !Number.isNaN(val));
        }
        return last.map(Number).filter(val => !Number.isNaN(val));
    }
    return [];
};
const pickSeries = (records, candidates) => {
    for (const key of candidates) {
        const value = records[key];
        if (value) {
            const series = extractLatestSeries(value);
            if (series.length > 0)
                return series;
        }
    }
    return [];
};
const getInstallationSummary = async (req, res, next) => {
    try {
        const idSite = resolveSiteId(req.params.idSite);
        const authHeader = normalizeAuthHeader(req.headers['x-authorization']);
        if (!idSite) {
            return res.status(400).json({ error: 'idSite is required or set VICTRON_SITE_ID' });
        }
        if (!authHeader) {
            return res.status(401).json({ error: 'x-authorization header required' });
        }
        // Calculate start and end timestamps for the last 24 hours
        const end = Math.floor(Date.now() / 1000);
        const start = end - 24 * 60 * 60;
        if (!config_1.default.victronApiUrl) {
            return res.status(500).json({ error: 'VICTRON_API_URL is not configured' });
        }
        const response = await axios_1.default.get(`${config_1.default.victronApiUrl}/installations/${idSite}/stats`, {
            headers: { 'x-authorization': authHeader },
            params: {
                interval: '3hours',
                type: 'custom',
                attributeCodes: ['Pt', 'Pg', 'Pb'],
                start,
                end
            }
        });
        // Extract and format the data
        const data = response.data;
        const summary = (data.records || []).map((rec) => ({
            timestamp: rec.timestamp,
            Pt: rec.Pt,
            Pg: rec.Pg,
            Pb: rec.Pb
        }));
        res.json(summary);
    }
    catch (err) {
        next(err);
    }
};
exports.getInstallationSummary = getInstallationSummary;
const getInstallationStats = async (req, res, next) => {
    try {
        const idSite = resolveSiteId(req.params.idSite);
        const { query } = req;
        const authHeader = normalizeAuthHeader(req.headers['x-authorization']);
        if (!idSite) {
            return res.status(400).json({ error: 'idSite is required or set VICTRON_SITE_ID' });
        }
        if (!authHeader) {
            return res.status(401).json({ error: 'x-authorization header required' });
        }
        if (!config_1.default.victronApiUrl) {
            return res.status(500).json({ error: 'VICTRON_API_URL is not configured' });
        }
        const response = await axios_1.default.get(`${config_1.default.victronApiUrl}/installations/${idSite}/stats`, {
            headers: { 'x-authorization': authHeader },
            params: query
        });
        res.json(response.data);
    }
    catch (err) {
        next(err);
    }
};
exports.getInstallationStats = getInstallationStats;
const getInstallationStatsYesterday = async (req, res, next) => {
    try {
        const idSite = resolveSiteId(req.params.idSite);
        const authHeader = normalizeAuthHeader(req.headers['x-authorization']);
        if (!idSite) {
            return res.status(400).json({ error: 'idSite is required or set VICTRON_SITE_ID' });
        }
        if (!authHeader) {
            return res.status(401).json({ error: 'x-authorization header required' });
        }
        if (!config_1.default.victronApiUrl) {
            return res.status(500).json({ error: 'VICTRON_API_URL is not configured' });
        }
        const { start, end } = getYesterdayRangeUtc();
        const response = await axios_1.default.get(`${config_1.default.victronApiUrl}/installations/${idSite}/stats`, {
            headers: { 'x-authorization': authHeader },
            params: {
                ...req.query,
                start,
                end
            }
        });
        res.json({
            start,
            end,
            data: response.data
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getInstallationStatsYesterday = getInstallationStatsYesterday;
const getPvRealtime = async (req, res, next) => {
    try {
        const idSite = resolveSiteId(req.params.idSite);
        const authHeader = normalizeAuthHeader(req.headers['x-authorization']);
        if (!idSite) {
            return res.status(400).json({ error: 'idSite is required or set VICTRON_SITE_ID' });
        }
        if (!authHeader) {
            return res.status(401).json({ error: 'x-authorization header required' });
        }
        if (!config_1.default.victronApiUrl) {
            return res.status(500).json({ error: 'VICTRON_API_URL is not configured' });
        }
        const response = await axios_1.default.get(`${config_1.default.victronApiUrl}/installations/${idSite}/stats`, {
            headers: { 'x-authorization': authHeader },
            params: {
                type: 'live_feed'
            }
        });
        const data = response.data;
        const records = (data?.records ?? {});
        const voltageSeries = pickSeries(records, ['pv_voltage', 'pv_voltages', 'pvVoltage', 'voltage', 'Vpv']);
        const currentSeries = pickSeries(records, ['pv_current', 'pv_currents', 'pvCurrent', 'current', 'Ipv']);
        const powerSeries = pickSeries(records, ['pv_power', 'pv_powers', 'pvPower', 'power', 'Ppv']);
        const energySeries = pickSeries(records, ['pv_energy', 'pv_energies', 'pvEnergy', 'energy', 'Epv']);
        const pdcSeries = pickSeries(records, ['Pdc']);
        if (voltageSeries.length === 0 && currentSeries.length === 0 && powerSeries.length === 0 && energySeries.length === 0 && pdcSeries.length === 0) {
            const recordKeys = Object.keys(records || {});
            const debug = String(req.query.debug).toLowerCase() === 'true';
            return res.status(422).json({
                error: 'PV string data not found in live_feed response. Verify Victron attribute names and response structure.',
                recordKeys,
                sampleRecord: debug ? records : undefined
            });
        }
        const sum = (values) => values.reduce((acc, value) => acc + value, 0);
        const safeAverage = (values) => (values.length > 0 ? sum(values) / values.length : 0);
        const totalVoltageAverage = voltageSeries.length > 0 ? safeAverage(voltageSeries) : null;
        const totalCurrent = currentSeries.length > 0 ? sum(currentSeries) : null;
        const totalPower = powerSeries.length > 0 ? sum(powerSeries) : pdcSeries.length > 0 ? pdcSeries[pdcSeries.length - 1] : null;
        const cumulativeEnergyKwh = totalPower !== null ? totalPower / (2 * 3600) : null;
        const retrievedAt = new Date().toISOString();
        const debug = String(req.query.debug).toLowerCase() === 'true';
        res.json({
            retrievedAt,
            pvStringCount: voltageSeries.length || currentSeries.length || powerSeries.length || energySeries.length || pdcSeries.length,
            realtimeAverageVoltage: totalVoltageAverage,
            realtimeCurrent: totalCurrent,
            realtimePower: totalPower,
            cumulativeEnergyKwh,
            raw: {
                voltages: voltageSeries,
                currents: currentSeries,
                powers: powerSeries,
                energies: energySeries,
                pdc: pdcSeries
            },
            debug: debug ? { recordKeys: Object.keys(records || {}) } : undefined
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getPvRealtime = getPvRealtime;
const getUserMe = async (req, res, next) => {
    try {
        const user = await (0, deviceService_2.fetchUserMeFromVictron)();
        res.json(user);
    }
    catch (err) {
        next(err);
    }
};
exports.getUserMe = getUserMe;
const getAllDevices = async (req, res, next) => {
    try {
        const devices = await (0, deviceService_1.fetchDevicesFromVictron)();
        res.json(devices.map(device => new deviceDTO_1.DeviceDTO(device)));
    }
    catch (err) {
        next(err);
    }
};
exports.getAllDevices = getAllDevices;
