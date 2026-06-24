import { SetMetadata } from '@nestjs/common';

export const AUTH_STRATEGY_KEY = 'authStrategy';

export const AuthStrategy = (strategy: string) =>
  SetMetadata(AUTH_STRATEGY_KEY, strategy);
