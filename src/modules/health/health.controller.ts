import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/modules/shared/decorators/public.decorator';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';

@ApiTags('HEALTH')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'Health check (liveness)',
    description:
      'Simple liveness probe that returns OK if the service is running.',
  })
  liveness(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness check (database)',
    description:
      'Readiness probe that verifies the database connection is healthy.',
  })
  @ApiResponse({
    status: 503,
    description: 'Database connection failed',
  })
  async readiness(): Promise<{
    status: string;
    database: string;
    timestamp: string;
  }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
