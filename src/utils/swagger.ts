import { Express } from 'express';
import config from '../config/config';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

// Determine base URL for Swagger servers
const baseUrl = process.env.BASE_URL
  || (process.env.NODE_ENV === 'production'
      ? `https://virtual-device-api-blueprint.onrender.com` // set your prod domain here if needed
      : `http://localhost:${config.port || 3000}`);

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
        url: baseUrl,
      },
    ],
  },
  apis: ['./dist/**/*.js', './src/**/*.ts', './src/controllers/*.ts'],
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Express) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
}
