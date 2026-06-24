import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import {
  EmailProvider,
  SendEmailOptions,
} from 'src/modules/shared/interfaces/email-provider.interface';

@Injectable()
export class NodemailerProvider implements EmailProvider {
  readonly name = 'nodemailer';
  private readonly logger = new Logger(NodemailerProvider.name);
  private transporter: Transporter | null = null;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    this.fromAddress =
      this.configService.get<string>('EMAIL_FROM') ||
      'noreply@nuts-commerce.com';
    this.initialize();
  }

  private initialize(): void {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const service = this.configService.get<string>('SMTP_SERVICE');
    const secureRaw = this.configService.get<string>('SMTP_SECURE');
    const secure = secureRaw === 'false' ? false : port === 465;

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        service: service || undefined,
        auth: { user, pass },
      });

      void this.verifyConnection().then((ok) => {
        if (ok) {
          this.logger.log('SMTP transporter configured and verified');
        } else {
          this.logger.warn('SMTP transporter verification failed');
        }
      });
    } else {
      this.logger.warn(
        'SMTP not fully configured. Email sending will be simulated in development.',
      );
    }
  }

  async send(options: SendEmailOptions): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        { to: options.to, subject: options.subject },
        'SMTP not configured — email not sent',
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo,
    });
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error.message : String(error) },
        'SMTP connection verification failed',
      );
      return false;
    }
  }
}
