import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ROLE } from '@prisma/client';
import { ShippingInformationResponseDto } from './shipping-information-response.dto';

export class UserProfileDto {
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
  phone!: string | null;

  @ApiProperty({
    description: 'Role assigned to the user in the system',
    enum: ROLE,
    example: 'CUSTOMER',
  })
  role!: ROLE;

  @ApiProperty({
    description: 'Indicates whether the account is currently active',
    example: true,
  })
  isActive!: boolean;

  @ApiPropertyOptional({
    description: 'Unique referral code assigned to the user',
    example: 'REF-A1B2C3',
    nullable: true,
  })
  referralCode!: string | null;

  @ApiPropertyOptional({
    type: ShippingInformationResponseDto,
    description: 'Profile shipping information and saved addresses',
    nullable: true,
  })
  shippingInformation!: ShippingInformationResponseDto | null;
}
