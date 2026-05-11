import Joi from "joi";

import { logger } from "../common/logging/logger";

/**
 * Fail fast on boot when running in production with incomplete Victron config.
 * SQLite fallback (no DATABASE_URL) is allowed for single-node deployments.
 */
export function assertProductionConfig(): void {
  if (process.env.NODE_ENV !== "production") return;

  const schema = Joi.object({
    VICTRON_API_URL: Joi.string().uri().required(),
    VICTRON_API_TOKEN: Joi.string().min(1).required(),
    VICTRON_SITE_ID: Joi.string().min(1).required(),
  }).unknown(true);

  const { error } = schema.validate(process.env, { allowUnknown: true });
  if (error) {
    const msg = `Production configuration invalid: ${error.message}`;
    logger.error(msg);
    throw new Error(msg);
  }

  if (!process.env.DATABASE_URL?.trim()) {
    logger.warn(
      "DATABASE_URL is unset; using embedded SQLite. Use Postgres for multi-instance or managed hosting.",
    );
  }
}
