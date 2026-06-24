import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class AdminRegisterDto {
  @ApiProperty({ description: 'Admin email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Admin password' })
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @ApiProperty({ description: 'Admin first name', required: false })
  @IsOptional()
  firstName?: string;

  @ApiProperty({ description: 'Admin last name', required: false })
  @IsOptional()
  lastName?: string;

  @ApiProperty({ description: 'Initial admin setup secret' })
  @IsNotEmpty()
  setupSecret!: string;
}
