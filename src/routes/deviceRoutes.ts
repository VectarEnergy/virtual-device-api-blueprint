import { Router } from 'express';

const router = Router();

// Deprecated placeholder routes (intentionally minimal).
router.get('/', (req, res) => res.status(410).json({ error: 'deprecated' }));
router.get('/users/me', (req, res) => res.status(410).json({ error: 'deprecated' }));

export default router;
