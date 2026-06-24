import { SetMetadata } from '@nestjs/common';

export const OTP_REQUIRED_KEY = 'otpRequired';

export const OtpRequired = () => SetMetadata(OTP_REQUIRED_KEY, true);
