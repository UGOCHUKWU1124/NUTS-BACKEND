import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class InitializePaymentDto {
  @ApiProperty({
    description:
      'One-time password sent to the authenticated user email before payment',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  otpCode!: string;
}
