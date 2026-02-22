"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUserMeFromVictron = exports.fetchDevicesFromVictron = void 0;
const deviceRepository_1 = require("../repositories/deviceRepository");
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../config/config"));
const fetchDevicesFromVictron = async () => {
    let response;
    let retry = true;
    let attempts = 0;
    while (retry && attempts < 3) {
        try {
            response = await axios_1.default.get(config_1.default.victronApiUrl, {
                headers: {
                    'x-authorization': `Token ${process.env.VICTRON_API_TOKEN}`
                }
            });
            retry = false;
        }
        catch (err) {
            if (err.response && err.response.status === 429 && err.response.headers['retry-after']) {
                const wait = parseInt(err.response.headers['retry-after'], 10) * 1000;
                await new Promise(res => setTimeout(res, wait));
                attempts++;
            }
            else {
                throw err;
            }
        }
    }
    if (!response)
        throw new Error('Failed to fetch from Victron API after retries');
    return deviceRepository_1.DeviceRepository.transformVictronData(response.data);
};
exports.fetchDevicesFromVictron = fetchDevicesFromVictron;
const fetchUserMeFromVictron = async () => {
    let response;
    let retry = true;
    let attempts = 0;
    while (retry && attempts < 3) {
        try {
            response = await axios_1.default.get(`${process.env.BASE_URL}/users/me`, {
                headers: {
                    'x-authorization': `Token ${process.env.VICTRON_API_TOKEN}`
                }
            });
            retry = false;
        }
        catch (err) {
            if (err.response && err.response.status === 429 && err.response.headers['retry-after']) {
                const wait = parseInt(err.response.headers['retry-after'], 10) * 1000;
                await new Promise(res => setTimeout(res, wait));
                attempts++;
            }
            else {
                throw err;
            }
        }
    }
    if (!response)
        throw new Error('Failed to fetch /users/me from Victron API after retries');
    return response.data;
};
exports.fetchUserMeFromVictron = fetchUserMeFromVictron;
