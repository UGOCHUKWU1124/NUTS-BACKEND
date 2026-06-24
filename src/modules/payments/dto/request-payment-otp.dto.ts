import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class RequestPaymentOtpDto {
  @ApiPropertyOptional({
    description:
      'Optional order ID to include payment details in the OTP email',
  })
  @IsOptional()
  @IsUUID()
  orderId?: string;
}
