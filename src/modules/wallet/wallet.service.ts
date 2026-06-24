import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import {
  Prisma,
  WalletTransactionReason,
  WalletTransactionType,
} from '@prisma/client';
import { PaginationMetaDto } from 'src/modules/shared/dto/pagination-meta.dto';
import { buildPaginationMeta } from 'src/modules/shared/utils/pagination-meta.util';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserWallet(userId: string) {
    return this.ensureUserWallet(userId);
  }

  async getCreatorWallet(creatorId: string) {
    return this.ensureCreatorWallet(creatorId);
  }

  async creditUserWallet(
    userId: string,
    amount: Prisma.Decimal,
    reason: WalletTransactionReason,
    referenceId?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.userWallet.findUnique({ where: { userId } });
      if (!wallet) {
        throw new NotFoundException('User wallet not found');
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
    });
  }

  async debitUserWallet(
    userId: string,
    amount: Prisma.Decimal,
    reason: WalletTransactionReason,
    referenceId?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.userWallet.findUnique({ where: { userId } });
      if (!wallet) {
        throw new NotFoundException('User wallet not found');
      }

      const newBalance = wallet.balance.sub(amount);
      if (newBalance.lt(0)) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      await tx.userWallet.update({
        where: { userId },
        data: { balance: { decrement: amount } },
      });

      await tx.walletTransaction.create({
        data: {
          amount,
          type: WalletTransactionType.DEBIT,
          reason,
          referenceId,
          userWalletId: wallet.id,
        },
      });
    });
  }

  async creditCreatorPending(
    creatorId: string,
    amount: Prisma.Decimal,
    referenceId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const execute = async (client: Prisma.TransactionClient) => {
      const wallet = await this.ensureCreatorWalletInTx(client, creatorId);

      await client.creatorWallet.update({
        where: { creatorId },
        data: {
          pendingBalance: { increment: amount },
          lifetimeEarnings: { increment: amount },
        },
      });

      await client.walletTransaction.create({
        data: {
          amount,
          type: WalletTransactionType.CREDIT,
          reason: WalletTransactionReason.ORDER_EARNING,
          referenceId,
          creatorWalletId: wallet.id,
        },
      });
    };

    if (tx) {
      await execute(tx);
    } else {
      await this.prisma.$transaction(execute);
    }
  }

  async settleCreatorEarning(
    creatorId: string,
    amount: Prisma.Decimal,
    referenceId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const execute = async (client: Prisma.TransactionClient) => {
      const wallet = await this.ensureCreatorWalletInTx(client, creatorId);

      const newPending = wallet.pendingBalance.sub(amount);
      if (newPending.lt(0)) {
        throw new BadRequestException('Insufficient pending balance');
      }

      await client.creatorWallet.update({
        where: { creatorId },
        data: {
          pendingBalance: { decrement: amount },
          balance: { increment: amount },
        },
      });

      await client.walletTransaction.create({
        data: {
          amount,
          type: WalletTransactionType.CREDIT,
          reason: WalletTransactionReason.ORDER_EARNING_SETTLED,
          referenceId,
          creatorWalletId: wallet.id,
        },
      });
    };

    if (tx) {
      await execute(tx);
    } else {
      await this.prisma.$transaction(execute);
    }
  }

  async debitCreatorPending(
    creatorId: string,
    amount: Prisma.Decimal,
    referenceId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const execute = async (client: Prisma.TransactionClient) => {
      const wallet = await this.ensureCreatorWalletInTx(client, creatorId);

      const newPending = wallet.pendingBalance.sub(amount);
      // Only reverse what is available in pending; skip if nothing to reverse
      if (newPending.lt(0)) {
        return;
      }

      await client.creatorWallet.update({
        where: { creatorId },
        data: {
          pendingBalance: { decrement: amount },
          lifetimeEarnings: { decrement: amount },
        },
      });

      await client.walletTransaction.create({
        data: {
          amount,
          type: WalletTransactionType.DEBIT,
          reason: WalletTransactionReason.ORDER_REFUND,
          referenceId,
          creatorWalletId: wallet.id,
        },
      });
    };

    if (tx) {
      await execute(tx);
    } else {
      await this.prisma.$transaction(execute);
    }
  }

  async getUserWalletWithTransactions(userId: string, limit = 20) {
    const wallet = await this.ensureUserWallet(userId, {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: limit,
      },
    });
    return {
      id: wallet.id,
      balance: Number(wallet.balance),
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
      transactions: wallet.transactions.map((tx) => ({
        id: tx.id,
        amount: Number(tx.amount),
        type: tx.type,
        reason: tx.reason,
        referenceId: tx.referenceId,
        createdAt: tx.createdAt,
      })),
    };
  }

  async getCreatorWalletWithTransactions(creatorId: string, limit = 20) {
    const wallet = await this.ensureCreatorWallet(creatorId, {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: limit,
      },
    });
    return {
      id: wallet.id,
      balance: Number(wallet.balance),
      pendingBalance: Number(wallet.pendingBalance),
      lifetimeEarnings: Number(wallet.lifetimeEarnings),
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
      transactions: wallet.transactions.map((tx) => ({
        id: tx.id,
        amount: Number(tx.amount),
        type: tx.type,
        reason: tx.reason,
        referenceId: tx.referenceId,
        createdAt: tx.createdAt,
      })),
    };
  }

  async getUserWalletTransactionsPaginated(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{
    data: Array<{
      id: string;
      amount: number;
      type: WalletTransactionType;
      reason: WalletTransactionReason;
      referenceId: string | null;
      createdAt: Date;
    }>;
    meta: PaginationMetaDto;
  }> {
    const wallet = await this.ensureUserWallet(userId);

    const skip = (page - 1) * limit;

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where: { userWalletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.walletTransaction.count({
        where: { userWalletId: wallet.id },
      }),
    ]);

    return {
      data: transactions.map((tx) => ({
        id: tx.id,
        amount: Number(tx.amount),
        type: tx.type,
        reason: tx.reason,
        referenceId: tx.referenceId,
        createdAt: tx.createdAt,
      })),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async getCreatorWalletTransactionsPaginated(
    creatorId: string,
    page: number,
    limit: number,
  ): Promise<{
    data: Array<{
      id: string;
      amount: number;
      type: WalletTransactionType;
      reason: WalletTransactionReason;
      referenceId: string | null;
      createdAt: Date;
    }>;
    meta: PaginationMetaDto;
  }> {
    const wallet = await this.ensureCreatorWallet(creatorId);

    const skip = (page - 1) * limit;

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where: { creatorWalletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.walletTransaction.count({
        where: { creatorWalletId: wallet.id },
      }),
    ]);

    return {
      data: transactions.map((tx) => ({
        id: tx.id,
        amount: Number(tx.amount),
        type: tx.type,
        reason: tx.reason,
        referenceId: tx.referenceId,
        createdAt: tx.createdAt,
      })),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  private async ensureUserWallet(
    userId: string,
  ): Promise<Prisma.UserWalletGetPayload<Record<string, never>>>;
  private async ensureUserWallet<T extends Prisma.UserWalletInclude>(
    userId: string,
    include: T,
  ): Promise<Prisma.UserWalletGetPayload<{ include: T }>>;
  private async ensureUserWallet(
    userId: string,
    include?: Prisma.UserWalletInclude,
  ) {
    let wallet = await this.prisma.userWallet.findUnique({
      where: { userId },
      include,
    });

    if (!wallet) {
      wallet = await this.prisma.userWallet.create({
        data: { userId },
        include,
      });
    }

    return wallet;
  }

  private async ensureCreatorWallet(
    creatorId: string,
  ): Promise<Prisma.CreatorWalletGetPayload<Record<string, never>>>;
  private async ensureCreatorWallet<T extends Prisma.CreatorWalletInclude>(
    creatorId: string,
    include: T,
  ): Promise<Prisma.CreatorWalletGetPayload<{ include: T }>>;
  private async ensureCreatorWallet(
    creatorId: string,
    include?: Prisma.CreatorWalletInclude,
  ) {
    let wallet = await this.prisma.creatorWallet.findUnique({
      where: { creatorId },
      include,
    });

    if (!wallet) {
      wallet = await this.prisma.creatorWallet.create({
        data: { creatorId },
        include,
      });
    }

    return wallet;
  }

  private async ensureCreatorWalletInTx(
    client: Prisma.TransactionClient,
    creatorId: string,
  ): Promise<Prisma.CreatorWalletGetPayload<Record<string, never>>> {
    let wallet = await client.creatorWallet.findUnique({
      where: { creatorId },
    });

    if (!wallet) {
      wallet = await client.creatorWallet.create({
        data: { creatorId },
      });
    }

    return wallet;
  }
}
