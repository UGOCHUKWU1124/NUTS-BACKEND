import { Global, Module } from '@nestjs/common';
import { NodemailerProvider } from './mail.provider';
import { EmailService } from './email.service';

@Global()
@Module({
  providers: [
    {
      provide: 'EMAIL_PROVIDER',
      useClass: NodemailerProvider,
    },
    {
      provide: 'MAIL_PROVIDER',
      useExisting: 'EMAIL_PROVIDER',
    },
    EmailService,
  ],
  exports: ['EMAIL_PROVIDER', 'MAIL_PROVIDER', EmailService],
})
export class MailModule {}
