import { ApiProperty } from '@nestjs/swagger';

export class CreatorStatusResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the creator',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id!: string;

  @ApiProperty({
    description: 'Whether the creator account is currently active',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'Whether the creator has been approved by an administrator',
    example: true,
  })
  isApproved!: boolean;

  @ApiProperty({
    description: 'Whether the creator identity has been verified',
    example: false,
  })
  isVerified!: boolean;

  @ApiProperty({
    description: 'Timestamp when the creator status was last updated',
    example: '2024-06-10T14:22:00.000Z',
  })
  updatedAt!: Date;
}
