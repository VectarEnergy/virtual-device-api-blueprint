import winston from 'winston';

const level = process.env.LOG_LEVEL || 'info';
const json =
  process.env.LOG_FORMAT === 'json' || process.env.NODE_ENV === 'production';

export const logger = winston.createLogger({
  level,
  format: json
    ? winston.format.combine(winston.format.timestamp(), winston.format.json())
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'ISO' }),
        winston.format.printf(
          ({ level: lv, message, timestamp, ...rest }) =>
            `${timestamp as string} ${lv}: ${message as string} ${
              Object.keys(rest).length ? JSON.stringify(rest) : ''
            }`,
        ),
      ),
  transports: [new winston.transports.Console()],
});

if (process.env.LOG_TO_FILE === '1') {
  logger.add(new winston.transports.File({ filename: 'logs/app.log', level }));
}
