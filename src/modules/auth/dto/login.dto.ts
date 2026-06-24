import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { NormalizeEmail } from 'src/modules/shared/decorators/normalize-email.decorator';
import { Trim } from 'src/modules/shared/decorators/string-trim.decorator';

export class LoginDto {
  @ApiProperty()
  @NormalizeEmail()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @MinLength(6)
  password!: string;
}
