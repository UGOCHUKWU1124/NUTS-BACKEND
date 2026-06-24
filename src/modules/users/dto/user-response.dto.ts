import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ROLE } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the user',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id!: string;

  @ApiPropertyOptional({
    description: 'First name of the user',
    example: 'Jane',
    nullable: true,
  })
  firstName!: string | null;

  @ApiPropertyOptional({
    description: 'Last name of the user',
    example: 'Doe',
    nullable: true,
  })
  lastName!: string | null;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'jane@example.com',
  })
  email!: string;

  @ApiPropertyOptional({
    description: 'Primary phone number for the user',
    example: '+1-555-123-4567',
    nullable: true,
  })
  phoneNumber!: string | null;

  @ApiProperty({
    description: 'Role assigned to the user in the system',
    enum: ROLE,
    example: 'CUSTOMER',
  })
  role!: ROLE;

  @ApiProperty({
    description: 'Indicates whether the user email address is verified',
    example: true,
  })
  isVerified!: boolean;

  @ApiProperty({
    description: 'Timestamp when the user record was created',
    example: '2025-01-15T08:30:00.000Z',
  })
  createdAt!: Date;

  /**
   * Sensitive fields deliberately excluded:
   * - password / hashedPassword
   * - refreshToken / refreshTokenId
   * - otp / otpCode
   * - resetPasswordToken
   * - verificationToken
   * - isActive, deactivatedAt, deactivatedBy, deactivationReason
   * - scheduledPermanentDeleteAt, updatedAt
   */
}
