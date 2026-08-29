import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  earlyAccess: true,
  datasource: {
    // `prisma generate` runs at image build time without any database env, so a
    // missing URL cannot abort here. The placeholder is intentionally
    // unreachable: commands that really need a database (db push, migrate)
    // fail loudly instead of silently hitting a default localhost server.
    url:
      process.env.DATABASE_URL?.trim() ||
      'postgresql://unset:unset@database-url-not-set.invalid:5432/unset?schema=public',
  },
});
