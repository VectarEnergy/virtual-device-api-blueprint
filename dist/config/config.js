"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.default = {
    port: process.env.PORT || 3000,
    victronApiUrl: process.env.VICTRON_API_URL || '',
    victronToken: process.env.VICTRON_API_TOKEN || '',
    defaultSiteId: process.env.VICTRON_SITE_ID || '',
    env: process.env.NODE_ENV || 'development'
};
