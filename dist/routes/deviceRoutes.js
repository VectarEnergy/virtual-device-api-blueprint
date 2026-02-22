"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// Deprecated placeholder routes (intentionally minimal).
router.get('/', (req, res) => res.status(410).json({ error: 'deprecated' }));
router.get('/users/me', (req, res) => res.status(410).json({ error: 'deprecated' }));
exports.default = router;
