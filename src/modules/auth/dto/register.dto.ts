import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { NormalizeEmail } from 'src/modules/shared/decorators/normalize-email.decorator';
import { Trim } from 'src/modules/shared/decorators/string-trim.decorator';

class ShippingAddressRegistrationDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName!: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phone!: string;

  @ApiProperty({ example: '123 Main Street, Victoria Island' })
  @IsString()
  @IsNotEmpty({ message: 'Street address is required' })
  street!: string;

  @ApiProperty({ example: 'Lagos' })
  @IsString()
  @IsNotEmpty({ message: 'City is required' })
  city!: string;

  @ApiProperty({ example: 'Lagos State' })
  @IsString()
  @IsNotEmpty({ message: 'State is required' })
  state!: string;

  @ApiPropertyOptional({ example: 'Nigeria', default: 'Nigeria' })
  @IsOptional()
  @IsString()
  country?: string;
}

export class RegisterDto {
  @ApiProperty()
  @NormalizeEmail()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#]).*$/, {
    message:
      'Password must contain uppercase, lowercase, number and special character',
  })
  password!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'OTP code is required' })
  otpCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Optional referral code from another user',
  })
  @IsOptional()
  @Trim()
  @IsString()
  referralCode?: string;

  @ApiProperty({
    description: 'Shipping address — required to complete registration',
    type: ShippingAddressRegistrationDto,
  })
  @IsNotEmpty({ message: 'Shipping address is required' })
  @ValidateNested()
  @Type(() => ShippingAddressRegistrationDto)
  shippingAddress!: ShippingAddressRegistrationDto;
}
