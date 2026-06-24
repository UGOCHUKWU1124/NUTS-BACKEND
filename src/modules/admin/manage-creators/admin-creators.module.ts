import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/modules/infrastructure/prisma/prisma.module';
import { AdminCreatorsController } from './admin-creators.controller';
import { AdminCreatorsService } from './admin-creators.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminCreatorsController],
  providers: [AdminCreatorsService],
})
export class AdminCreatorsModule {}
