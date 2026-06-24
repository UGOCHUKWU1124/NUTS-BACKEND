export type JwtPayload = {
  sub: string;
  email: string;
  role?: string;
  tokenVersion?: number;
  iat?: number;
  exp?: number;
};
