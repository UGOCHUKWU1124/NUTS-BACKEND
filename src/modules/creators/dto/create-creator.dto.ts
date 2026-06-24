import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CreateCreatorDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  storeName!: string;

  @ApiPropertyOptional({
    description:
      'Optional store slug. If omitted, the slug is generated from the storeName.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  storeSlug?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  storeDescription?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  businessPhone?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  businessEmail?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ description: 'OTP code sent to the email address' })
  @IsString()
  otpCode!: string;
}
