import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const CONNECT_MAX_ATTEMPTS = 5;
const CONNECT_RETRY_DELAY_MS = 2000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private static readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor() {
    const connectionString = PrismaService.resolveConnectionString();
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    for (let attempt = 1; attempt <= CONNECT_MAX_ATTEMPTS; attempt++) {
      try {
        await this.$connect();
        await this.$queryRaw`SELECT 1`;
        return;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        PrismaService.logger.error(
          `Database connection attempt ${attempt}/${CONNECT_MAX_ATTEMPTS} failed: ${reason}`,
        );

        if (attempt === CONNECT_MAX_ATTEMPTS) {
          // Fail fast instead of booting an API that errors on every request.
          throw new Error(
            `Unable to connect to the database at ${PrismaService.describeTarget()}. ` +
              'Verify DATABASE_URL credentials match the PostgreSQL role password.',
          );
        }

        await new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_DELAY_MS * attempt));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }

  /**
   * DATABASE_URL is mandatory. A hardcoded localhost fallback silently pointed
   * production at the wrong server, so a missing value must abort startup.
   */
  private static resolveConnectionString(): string {
    const connectionString = process.env.DATABASE_URL?.trim();

    if (!connectionString) {
      throw new Error('DATABASE_URL is not set. Refusing to start without a database connection.');
    }

    try {
      new URL(connectionString);
    } catch {
      throw new Error(
        'DATABASE_URL is not a valid connection URL. Special characters in the password must be percent-encoded.',
      );
    }

    return connectionString;
  }

  /** Host/database only — never logs credentials. */
  private static describeTarget(): string {
    try {
      const url = new URL(process.env.DATABASE_URL as string);
      return `${url.hostname}:${url.port || 5432}${url.pathname}`;
    } catch {
      return 'unknown host';
    }
  }
}
