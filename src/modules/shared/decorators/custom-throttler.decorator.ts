import { Throttle } from '@nestjs/throttler';

export const StrictThrottle = () =>
  Throttle({
    default: {
      ttl: 60_000, // 1 minute
      limit: 5, // 5 attempts per minute
    },
  });

export const ModerateThrottle = () =>
  Throttle({
    default: {
      ttl: 60_000, // 1 minute
      limit: 20, // 20 attempts per minute
    },
  });

export const RelaxedThrottle = () =>
  Throttle({
    default: {
      ttl: 60_000, // 1 minute
      limit: 100, // 100 attempts per minute
    },
  });
