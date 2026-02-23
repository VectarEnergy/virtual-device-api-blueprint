import { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Virtual Device API Blueprint',
      version: '1.0.0',
      description: 'API documentation for the Virtual Device API Blueprint',
    },
    servers: [
      {
        url: 'https://virtual-device-api-blueprint.onrender.com/',
      },
    ],
  },
  // In production (container) we run compiled JS from `dist/` so include that as well.
  // Keep the src globs for local dev and editor-based generation.
  apis: ['./dist/**/*.js', './src/**/*.ts', './src/controllers/*.ts'],
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Express) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
}
