import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { PrismaService } from '@/database/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Check server & database operational status' })
  async check(@Res({ passthrough: true }) res: Response) {
    let dbStatus = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'up';
    } catch {
      dbStatus = 'error';
    }

    // Report unhealthy so Docker/monitoring restarts or alerts instead of the
    // API silently serving requests it cannot fulfil.
    res.status(dbStatus === 'up' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return {
      message: 'System operational status',
      data: {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: dbStatus,
      },
    };
  }
}
