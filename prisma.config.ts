import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  earlyAccess: true,
  datasource: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5433/smart_meal_db?schema=public&sslmode=disable',
  },
});
