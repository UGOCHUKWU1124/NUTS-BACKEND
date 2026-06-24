import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({
    description: 'Unique identifier of the user',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id!: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'jane@example.com',
  })
  email!: string;

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
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'Authenticated user details',
    type: AuthUserDto,
  })
  user!: AuthUserDto;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken!: string;

  @ApiProperty({
    description: 'Authenticated user details',
    type: AuthUserDto,
  })
  user!: AuthUserDto;
}

export class RegisterResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the newly created user',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  userId!: string;

  @ApiProperty({
    description: 'Email address of the registered user',
    example: 'jane@example.com',
  })
  email!: string;

  @ApiProperty({
    description:
      'Indicates if email verification is required before the account can be used',
    example: true,
  })
  requiresVerification!: boolean;
}

export class VerifyOtpResponseDto {
  @ApiProperty({
    description: 'Indicates whether the OTP verification was successful',
    example: true,
  })
  verified!: boolean;
}
