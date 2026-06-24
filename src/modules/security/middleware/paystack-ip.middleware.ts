import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { SECURITY } from 'src/modules/shared/constants';

/**
 * Middleware to verify that incoming Paystack webhook requests
 * originate from Paystack's known IP addresses.
 */
@Injectable()
export class PaystackIpMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PaystackIpMiddleware.name);
  private readonly allowedIps: Set<string>;
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    this.allowedIps = new Set(SECURITY.PAYSTACK_IPS);
    this.isProduction = configService.get<string>('NODE_ENV') === 'production';
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // In development, allow all IPs for testing
    if (!this.isProduction) {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || '';

    // Try x-forwarded-for header (Paystack sends requests via load balancers)
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp =
      (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) || ip;

    if (!this.allowedIps.has(clientIp)) {
      this.logger.warn(
        { ip: clientIp, path: req.path },
        'Blocked webhook request from unauthorized IP',
      );
      throw new UnauthorizedException('Invalid webhook source');
    }

    next();
  }
}
