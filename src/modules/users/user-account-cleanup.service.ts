import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from './users.service';

@Injectable()
export class UserAccountCleanupService {
  private readonly logger = new Logger(UserAccountCleanupService.name);

  constructor(private readonly usersService: UsersService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgeExpiredDeactivatedAccounts(): Promise<void> {
    const deleted = await this.usersService.purgeScheduledDeletions();
    if (deleted > 0) {
      this.logger.log(`Permanently deleted ${deleted} deactivated account(s)`);
    }
  }
}
