import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { WalletTransactionReason, WalletTransactionType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);
  private readonly REFERRED_USER_REWARD_PERCENT = 0.1; // 10% of order total
  private readonly REFERRED_USER_REWARD_CAP = 5_000; // max ₦5,000
  private readonly REFERRER_REWARD_PERCENT = 0.05; // 5% of order total
  private readonly REFERRER_REWARD_CAP = 10_000; // max ₦10,000

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a unique 8-character uppercase alphanumeric referral code.
   */
  async generateCode(tx: Prisma.TransactionClient): Promise<string> {
    const code = randomBytes(6).toString('hex').toUpperCase().slice(0, 8);
    const existing = await tx.referralCode.findUnique({
      where: { code },
    });
    if (existing) {
      return this.generateCode(tx);
    }
    return code;
  }

  /**
   * Create a ReferralCode record for a newly registered user.
   * Called inside the registration transaction.
   */
  async createReferralCode(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    const code = await this.generateCode(tx);
    await tx.referralCode.create({
      data: { userId, code },
    });
  }

  /**
   * Validate a referral code at signup.
   */
  async validateReferralCode(
    code: string,
    registrantEmail: string,
  ): Promise<{ id: string; userId: string }> {
    const referralCode = await this.prisma.referralCode.findUnique({
      where: { code },
      select: {
        id: true,
        userId: true,
        user: { select: { email: true } },
      },
    });

    if (!referralCode) {
      throw new BadRequestException('Invalid referral code');
    }

    if (referralCode.user.email === registrantEmail) {
      throw new BadRequestException('You cannot use your own referral code');
    }

    return { id: referralCode.id, userId: referralCode.userId };
  }

  /**
   * Apply a referral code at signup.
   * Creates a Referral record linking referrer to the new user with rewardGranted: false.
   */
  async applyReferralAtSignup(
    newUserId: string,
    referralCode: string,
  ): Promise<void> {
    const codeRecord = await this.prisma.referralCode.findUnique({
      where: { code: referralCode },
    });

    if (!codeRecord) {
      throw new BadRequestException('Referral code is invalid');
    }

    if (codeRecord.userId === newUserId) {
      throw new BadRequestException('Cannot refer yourself');
    }

    await this.prisma.referral.create({
      data: {
        referralCodeId: codeRecord.id,
        referrerId: codeRecord.userId,
        referredUserId: newUserId,
        rewardGranted: false,
      },
    });
  }

  async applyReferralAtSignupById(
    newUserId: string,
    referralCodeId: string,
    referrerUserId: string,
  ): Promise<void> {
    await this.prisma.referral.create({
      data: {
        referralCodeId,
        referrerId: referrerUserId,
        referredUserId: newUserId,
        rewardGranted: false,
      },
    });
  }

  /**
   * Grant referral rewards after a referred user's order is delivered.
   *
   * - Referred user gets a wallet credit (10% of order total, capped)
   * - Referrer gets a wallet credit (5% of order total, capped)
   *
   * Both are granted inside a single transaction and the referral is
   * marked as rewarded to prevent duplicate payouts.
   */
  async grantReferralRewards(orderId: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const referral = await tx.referral.findUnique({
        where: { referredUserId: userId },
      });

      if (!referral || referral.rewardGranted) {
        return; // no referral to reward or already rewarded
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { totalAmount: true },
      });

      if (!order) {
        this.logger.warn(
          `Order ${orderId} not found when granting referral rewards for user ${userId}`,
        );
        return;
      }

      const orderTotal = Number(order.totalAmount);
      if (orderTotal <= 0) return;

      // --- Credit the referred user ---
      const userRewardRaw = orderTotal * this.REFERRED_USER_REWARD_PERCENT;
      const userReward = new Prisma.Decimal(
        Math.min(
          Number(userRewardRaw.toFixed(2)),
          this.REFERRED_USER_REWARD_CAP,
        ),
      );

      if (userReward.gt(0)) {
        await this.creditWallet(
          tx,
          userId,
          userReward,
          WalletTransactionReason.REFERRAL_DISCOUNT,
          orderId,
        );
      }

      // --- Credit the referrer ---
      const referrerRewardRaw = orderTotal * this.REFERRER_REWARD_PERCENT;
      const referrerReward = new Prisma.Decimal(
        Math.min(
          Number(referrerRewardRaw.toFixed(2)),
          this.REFERRER_REWARD_CAP,
        ),
      );

      if (referrerReward.gt(0)) {
        await this.creditWallet(
          tx,
          referral.referrerId,
          referrerReward,
          WalletTransactionReason.REFERRAL_REWARD,
          orderId,
        );
      }

      // Mark the referral as rewarded
      await tx.referral.update({
        where: { id: referral.id },
        data: { rewardGranted: true },
      });
    });
  }

  /**
   * Returns the unrewarded referral record for this user, if any.
   */
  async getUnrewardedReferral(
    userId: string,
  ): Promise<{ id: string; referrerId: string } | null> {
    const referral = await this.prisma.referral.findUnique({
      where: { referredUserId: userId },
      select: { id: true, referrerId: true, rewardGranted: true },
    });
    if (!referral || referral.rewardGranted) {
      return null;
    }
    return { id: referral.id, referrerId: referral.referrerId };
  }

  /**
   * Check if this user has an unrewarded referral that qualifies.
   */
  async hasPendingReferral(userId: string): Promise<boolean> {
    const referral = await this.prisma.referral.findUnique({
      where: { referredUserId: userId },
      select: { rewardGranted: true },
    });
    return !!referral && !referral.rewardGranted;
  }

  private async creditWallet(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: Prisma.Decimal,
    reason: WalletTransactionReason,
    referenceId: string,
  ): Promise<void> {
    const wallet = await tx.userWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      this.logger.warn(`User wallet not found for user ${userId}`);
      return;
    }

    await tx.userWallet.update({
      where: { userId },
      data: { balance: { increment: amount } },
    });

    await tx.walletTransaction.create({
      data: {
        amount,
        type: WalletTransactionType.CREDIT,
        reason,
        referenceId,
        userWalletId: wallet.id,
      },
    });
  }
}
