import { randomUUID } from 'crypto';
import { Params } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'http';

export const pinoLoggerConfig = (): Params => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    pinoHttp: {
      level: isProduction ? 'info' : 'debug',
      ...(isProduction
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: { singleLine: true, colorize: true },
            },
          }),
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const header = req.headers['x-request-id'];
        const requestId =
          (Array.isArray(header) ? header[0] : header) ?? randomUUID();
        res.setHeader('X-Request-Id', requestId);
        return requestId;
      },
      customProps: (req: IncomingMessage & { id?: string }) => ({
        requestId: req.id,
      }),
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
        remove: true,
      },
      autoLogging: {
        ignore: (req: IncomingMessage) => req.url?.includes('/health') ?? false,
      },
    },
  };
};
