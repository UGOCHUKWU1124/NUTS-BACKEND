import { Request } from 'express';
import { ExtractJwt } from 'passport-jwt';

export function jwtFromCookieOrBearer(cookieName: string) {
  return (req?: Request): string | null => {
    if (!req) return null;

    const cookies = req.cookies as Record<string, string> | undefined;

    const fromCookie = cookies?.[cookieName];

    if (fromCookie?.trim()) {
      return fromCookie;
    }

    return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  };
}
