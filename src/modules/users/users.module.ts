import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserAccountCleanupService } from './user-account-cleanup.service';
import { AuthCookiesModule } from 'src/modules/auth/auth-cookies.module';
@Module({
  imports: [AuthCookiesModule],
  controllers: [UsersController],
  providers: [UsersService, UserAccountCleanupService],
  exports: [UsersService],
})
export class UsersModule {}
