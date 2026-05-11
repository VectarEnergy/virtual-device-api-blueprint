import { NextFunction, Request, Response } from 'express';

import { logger } from '../common/logging/logger';

export default function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const e = err as { status?: number; message?: string; stack?: string };
  const status = typeof e?.status === 'number' ? e.status : 500;
  const isProd = process.env.NODE_ENV === 'production';

  if (status >= 500) {
    logger.error('Unhandled error', {
      message: e?.message ?? String(err),
      stack: isProd ? undefined : e?.stack,
    });
  }

  const message =
    isProd && status >= 500
      ? 'Internal Server Error'
      : e?.message || 'Internal Server Error';

  res.status(status).json({ error: message });
}
