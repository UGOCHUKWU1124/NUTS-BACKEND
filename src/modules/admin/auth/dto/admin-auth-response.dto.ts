import { ApiProperty } from '@nestjs/swagger';
import { AdminAuthUserDto } from './admin-auth-user.dto';

export class AdminAuthResponseDto {
  @ApiProperty({
    description: 'Authenticated admin user details',
    type: AdminAuthUserDto,
  })
  user!: AdminAuthUserDto;
}
