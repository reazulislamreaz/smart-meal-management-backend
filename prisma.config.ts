import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  earlyAccess: true,
  datasource: {
    url: (() => {
      const url = process.env.DATABASE_URL?.trim();
      if (!url) {
        throw new Error('DATABASE_URL is not set. Prisma commands require an explicit database URL.');
      }
      return url;
    })(),
  },
});
