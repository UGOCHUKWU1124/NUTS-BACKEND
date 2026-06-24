import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { SendMailOptions } from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  generateInvoicePdf,
  PdfInvoiceData,
} from 'src/modules/shared/utils/pdf-generator.util';

type MailTransport = {
  verify: () => Promise<unknown>;
  sendMail: (options: SendMailOptions) => Promise<unknown>;
};

type NodemailerLike = {
  createTransport: (options: {
    host: string;
    port: number;
    secure: boolean;
    service?: string;
    auth: { user: string; pass: string };
  }) => MailTransport;
};

@Injectable()
export class EmailService {
  private transporter: MailTransport | null = null;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const portRaw = this.configService.get<string>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const service = this.configService.get<string>('SMTP_SERVICE');
    const secureRaw = this.configService.get<string>('SMTP_SECURE');

    const port = portRaw ? Number(portRaw) : undefined;
    const secure = secureRaw === 'false' ? false : port === 465;

    if (host && port && user && pass) {
      const mailer = nodemailer as unknown as NodemailerLike;
      this.transporter = mailer.createTransport({
        host,
        port,
        secure,
        service: service || undefined,
        auth: { user, pass },
      });

      void this.verifyTransporter();
    } else {
      this.logger.warn(
        'SMTP settings are incomplete. Email sending is disabled until SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS are configured.',
      );
    }
  }

  async sendOtpEmail(
    to: string,
    otp: string,
    options?: { subject?: string; orderDetails?: string },
  ): Promise<void> {
    const subject = options?.subject ?? 'Your verification code';
    const html = this.buildOtpHtml(otp, options?.orderDetails);

    await this.sendEmail({
      to,
      subject,
      html,
    });
    this.logger.log(`OTP email sent to ${to}`);
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const subject = 'Welcome to NUTS';
    const html = this.buildWelcomeHtml(name);

    await this.sendEmail({
      to,
      subject,
      html,
    });
    this.logger.log(`Welcome email sent to ${to}`);
  }

  async sendPasswordResetSuccessEmail(to: string, name: string): Promise<void> {
    const subject = 'Password reset successful';
    const html = this.buildPasswordResetHtml(name);

    await this.sendEmail({
      to,
      subject,
      html,
    });
    this.logger.log(`Password reset confirmation email sent to ${to}`);
  }

  async sendOrderConfirmation(to: string, data: PdfInvoiceData): Promise<void> {
    const subject = `Order Confirmation - ${data.orderNumber}`;
    const html = this.buildOrderConfirmationHtml(data);

    const tempPath = path.join(os.tmpdir(), `invoice_${data.orderNumber}.pdf`);
    try {
      await generateInvoicePdf(data, tempPath);
      const pdfBuffer = fs.readFileSync(tempPath);

      await this.sendEmail({
        to,
        subject,
        html,
        attachments: [
          {
            filename: `invoice_${data.orderNumber}.pdf`,
            content: pdfBuffer,
          },
        ],
      });
      this.logger.log(
        `Order confirmation email sent to ${to} for order ${data.orderNumber}`,
      );
    } finally {
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (e) {
          this.logger.warn(`Failed to clean up temp file ${tempPath}`, e);
        }
      }
    }
  }

  async sendPaymentReceipt(to: string, data: PdfInvoiceData): Promise<void> {
    const subject = `Payment Receipt - ${data.orderNumber}`;
    const html = this.buildPaymentReceiptHtml(data);

    const tempPath = path.join(os.tmpdir(), `receipt_${data.orderNumber}.pdf`);
    try {
      await generateInvoicePdf(data, tempPath);
      const pdfBuffer = fs.readFileSync(tempPath);

      await this.sendEmail({
        to,
        subject,
        html,
        attachments: [
          {
            filename: `receipt_${data.orderNumber}.pdf`,
            content: pdfBuffer,
          },
        ],
      });
      this.logger.log(
        `Payment receipt email sent to ${to} for order ${data.orderNumber}`,
      );
    } finally {
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (e) {
          this.logger.warn(`Failed to clean up temp file ${tempPath}`, e);
        }
      }
    }
  }

  private getFromAddress(): string {
    return (
      this.configService.get<string>('EMAIL_FROM') || 'no-reply@example.com'
    );
  }

  private async verifyTransporter(): Promise<void> {
    if (!this.transporter) return;

    try {
      await this.transporter.verify();
      this.logger.log('SMTP transporter configured successfully');
    } catch (err) {
      this.logger.error('SMTP transporter verification failed', err as Error);
      this.transporter = null;
    }
  }

  private async sendEmail(options: SendMailOptions): Promise<void> {
    if (!this.transporter) {
      throw new Error('SMTP transporter is not configured');
    }

    await this.transporter.sendMail({
      from: this.getFromAddress(),
      ...options,
    });
  }

  private buildOtpHtml(otp: string, orderDetails?: string): string {
    return this.wrapHtml(`
      <div class="email-header">
        <p class="eyebrow">Secure login</p>
        <h1>Verify your NUTS login</h1>
      </div>
      <div class="email-body">
        ${orderDetails ? `<div class="details-box"><p>${orderDetails}</p></div>` : ''}
        <p>Use the code below to continue. It will expire in 10 minutes.</p>
        <div class="otp-box">
          <span>${otp}</span>
        </div>
        <p>If you did not request this verification, simply ignore this email.</p>
      </div>
    `);
  }

  private buildWelcomeHtml(name: string): string {
    return this.wrapHtml(`
      <div class="email-header">
        <p class="eyebrow">Welcome aboard</p>
        <h1>Welcome to NUTS</h1>
      </div>
      <div class="email-body">
        <p>Hello ${name || 'Customer'},</p>
        <p>Thanks for joining NUTS. Your account is ready, and you can now explore our curated collection of products.</p>
        <div class="hero-card">
          <p><strong>Ready to shop?</strong></p>
          <p>Discover top products, exclusive offers, and fast checkout.</p>
        </div>
        <p>We’re excited to help you shop smarter.</p>
      </div>
    `);
  }

  private buildPasswordResetHtml(name: string): string {
    return this.wrapHtml(`
      <div class="email-header">
        <p class="eyebrow">Account security</p>
        <h1>Password reset complete</h1>
      </div>
      <div class="email-body">
        <p>Hello ${name || 'Customer'},</p>
        <p>Your password has been successfully reset. If you did not make this change, please contact our support team immediately.</p>
        <div class="hero-card">
          <p><strong>Need help?</strong></p>
          <p>Reach out to support if anything looks unfamiliar.</p>
        </div>
      </div>
    `);
  }

  private buildOrderConfirmationHtml(data: PdfInvoiceData): string {
    const itemsHtml = data.items
      .map(
        (item) => `
        <tr>
          <td>
            ${item.productName}
            ${item.variantName ? `<div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">${item.variantName}</div>` : ''}
          </td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">${data.currency.toUpperCase()} ${item.price.toFixed(2)}</td>
        </tr>
      `,
      )
      .join('');

    const discountHtml =
      data.discountAmount > 0
        ? `
        <div class="summary-card">
          <div>
            <span>Subtotal</span>
            <strong>${data.currency.toUpperCase()} ${data.totalAmount.toFixed(2)}</strong>
          </div>
          <div>
            <span>Discount${data.discountCode ? ` (${data.discountCode})` : ''}</span>
            <strong style="color: #059669;">-${data.currency.toUpperCase()} ${data.discountAmount.toFixed(2)}</strong>
          </div>
          <div style="border-top: 2px solid #e2e8f0; padding-top: 12px;">
            <span><strong>Total</strong></span>
            <strong>${data.currency.toUpperCase()} ${data.finalAmount.toFixed(2)}</strong>
          </div>
        </div>`
        : `
        <div class="summary-card">
          <div>
            <span>Order total</span>
            <strong>${data.currency.toUpperCase()} ${data.totalAmount.toFixed(2)}</strong>
          </div>
        </div>`;

    return this.wrapHtml(`
      <div class="email-header">
        <p class="eyebrow">Order confirmation</p>
        <h1>Order received</h1>
      </div>
      <div class="email-body">
        <p>Hello ${data.customerName},</p>
        <p>Your order <strong>#${data.orderNumber}</strong> has been placed successfully. A proforma invoice is attached for your reference.</p>
        <div class="details-box">
          <p>Shipping to: ${data.shippingAddress}</p>
        </div>
        ${discountHtml}
        <table class="table">
          <thead>
            <tr>
              <th>Product</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>
    `);
  }

  private buildPaymentReceiptHtml(data: PdfInvoiceData): string {
    const itemsHtml = data.items
      .map(
        (item) => `
        <tr>
          <td>
            ${item.productName}
            ${item.variantName ? `<div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">${item.variantName}</div>` : ''}
          </td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">${data.currency.toUpperCase()} ${item.price.toFixed(2)}</td>
        </tr>
      `,
      )
      .join('');

    const discountHtml =
      data.discountAmount > 0
        ? `
        <div class="summary-card">
          <div>
            <span>Subtotal</span>
            <strong>${data.currency.toUpperCase()} ${data.totalAmount.toFixed(2)}</strong>
          </div>
          <div>
            <span>Discount${data.discountCode ? ` (${data.discountCode})` : ''}</span>
            <strong style="color: #059669;">-${data.currency.toUpperCase()} ${data.discountAmount.toFixed(2)}</strong>
          </div>
          <div style="border-top: 2px solid #e2e8f0; padding-top: 12px;">
            <span><strong>Total paid</strong></span>
            <strong>${data.currency.toUpperCase()} ${data.finalAmount.toFixed(2)}</strong>
          </div>
        </div>`
        : '';

    return this.wrapHtml(`
      <div class="email-header">
        <p class="eyebrow">Payment received</p>
        <h1>Payment confirmed</h1>
      </div>
      <div class="email-body">
        <p>Hello ${data.customerName},</p>
        <p>We've successfully received your payment of <strong>${data.currency.toUpperCase()} ${data.finalAmount.toFixed(2)}</strong> for order <strong>#${data.orderNumber}</strong>.</p>
        ${discountHtml}
        <table class="table">
          <thead>
            <tr>
              <th>Product</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="hero-card">
          <p>Your receipt is attached for your records.</p>
        </div>
      </div>
    `);
  }

  private wrapHtml(content: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <style>
            body { margin: 0; padding: 0; background: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
            .container { width: 100%; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 20px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08); }
            .email-header { text-align: center; padding-bottom: 24px; border-bottom: 1px solid #e2e8f0; }
            .eyebrow { margin: 0 0 8px; font-size: 12px; letter-spacing: 1.5px; color: #7c3aed; text-transform: uppercase; }
            .email-header h1 { margin: 0; font-size: 28px; line-height: 1.1; color: #111827; }
            .email-body { padding-top: 24px; color: #475569; line-height: 1.7; }
            .email-body p { margin: 0 0 18px; }
            .details-box { background: #eef2ff; border-radius: 14px; padding: 16px; margin: 0 0 18px; color: #1e293b; }
            .details-box p { margin: 0; font-weight: 600; }
            .otp-box, .hero-card, .summary-card { background: #f8fafc; border-radius: 16px; padding: 20px; margin: 18px 0; }
            .otp-box span { display: block; text-align: center; font-size: 28px; letter-spacing: 12px; font-weight: 700; color: #111827; }
            .hero-card p { margin: 0; color: #111827; }
            .summary-card { display: grid; gap: 12px; }
            .summary-card div { display: flex; justify-content: space-between; align-items: center; font-size: 14px; color: #475569; }
            .summary-card strong { color: #111827; }
            .table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            .table th, .table td { padding: 14px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
            .table th { font-size: 13px; letter-spacing: 0.03em; text-transform: uppercase; color: #667085; }
            .table td { color: #475569; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            ${content}
            <div class="footer">NUTS E-Commerce — Secure shopping made simple.</div>
          </div>
        </body>
      </html>
    `;
  }
}
