import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { QueueModule } from 'src/modules/queue/queue.module';
import { PrismaModule } from 'src/modules/infrastructure/prisma/prisma.module';
import { NotificationListener } from './listeners/notification.listener';
import { EmailTemplatesService } from './templates/email-templates.service';

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
    QueueModule,
    PrismaModule,
  ],
  providers: [NotificationListener, EmailTemplatesService],
  exports: [NotificationListener, EmailTemplatesService],
})
export class NotificationModule {}
