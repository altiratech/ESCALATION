import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: '../../db/migrations',
  schema: './src/schema.ts',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID || '',
    token: process.env.CLOUDFLARE_API_TOKEN || ''
  }
});
