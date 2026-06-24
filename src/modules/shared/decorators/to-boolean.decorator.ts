import { Transform } from 'class-transformer';

export const ToBoolean = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return undefined;

    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return undefined;
  });
