import { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import config from '../../config/config';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Virtual Device API Blueprint',
      version: '1.0.0',
      description:
        'Solar yield proxy: Victron VRM total_solar_yield → persisted cumulative and history.',
    },
    servers: [
      {
        url: config.publicApiUrl,
        description: 'Configured via PUBLIC_API_URL (default http://localhost:PORT)',
      },
    ],
  },
  apis: ['./dist/**/*.js', './src/**/*.ts', './src/http/*.ts'],
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Express) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
}
