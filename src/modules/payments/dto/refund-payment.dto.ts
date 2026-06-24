import { IsNotEmpty, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefundPaymentDto {
  @ApiProperty({ description: 'The payment ID to refund' })
  @IsUUID()
  @IsNotEmpty()
  paymentId!: string;

  @ApiProperty({
    description:
      'Optional partial refund amount. If omitted, full refund is processed.',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;
}
