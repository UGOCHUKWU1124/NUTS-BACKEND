import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { NormalizeEmail } from 'src/modules/shared/decorators/normalize-email.decorator';
import { Trim } from 'src/modules/shared/decorators/string-trim.decorator';

export class ResetPasswordDto {
  @ApiProperty()
  @NormalizeEmail()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  otpCode!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#]).*$/, {
    message:
      'Password must contain uppercase, lowercase, number and special character',
  })
  newPassword!: string;
}
