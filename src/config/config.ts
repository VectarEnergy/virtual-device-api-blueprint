import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

export default {
  port: process.env.PORT || 3000,
  victronApiUrl: process.env.VICTRON_API_URL || '',
  victronToken: process.env.VICTRON_API_TOKEN || '',
  defaultSiteId: process.env.VICTRON_SITE_ID || '',
  env: process.env.NODE_ENV || 'development'
};
