import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { AuditLogService } from 'src/modules/shared/audit-log/audit-log.service';
import { UsersService } from 'src/modules/users/users.service';
import { DiscountCodeService } from 'src/modules/promotions/discount-code.service';
import { ReferralService } from 'src/modules/referral/referral.service';
import { EmailService } from 'src/modules/infrastructure/mail/email.service';
import { CheckoutDto } from './dto/checkout.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { AdminOrderResponseDto } from './dto/admin-order-response.dto';
import { CreatorOrderResponseDto } from './dto/creator-order-response.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { ShippingAddressesService } from 'src/modules/shipping-addresses/shipping-addresses.service';
import { customAlphabet } from 'nanoid';
import { PaymentsService } from 'src/modules/payments/payments.service';
import { WalletService } from 'src/modules/wallet/wallet.service';
import { DomainEvents } from 'src/modules/shared/events/domain-events';
import type {
  OrderShippedPayload,
  OrderDeliveredPayload,
  OrderCancelledPayload,
} from 'src/modules/shared/events/event-payloads';
import { createPaginationMeta } from 'src/modules/shared/utils/pagination-meta.util';
import { getPagination } from 'src/modules/shared/utils/pagination.util';
import { PaginationQueryDto } from 'src/modules/shared/dto/pagination-query.dto';
import { CHECKOUT_IDEMPOTENCY_TTL_HOURS } from 'src/modules/shared/constants/checkout.constants';
import {
  assertValidOrderTransition,
  generateStatusNote,
  resolvePaymentStatusAfterOrderChange,
  shouldRestoreStock,
} from './constants/order-status.constants';

const orderInclude = {
  orderItems: {
    include: {
      product: { select: { name: true, slug: true, sku: true } },
      variant: { select: { id: true, options: true } },
    },
  },
  payment: {
    select: {
      id: true,
      paymentLink: true,
      transactionReference: true,
    },
  },
} satisfies Prisma.OrderInclude;

/** Lighter include for order list views — omits payment details */
const orderListInclude = {
  orderItems: {
    include: {
      product: { select: { name: true, slug: true, sku: true } },
      variant: { select: { id: true, options: true } },
    },
  },
} satisfies Prisma.OrderInclude;

const statusHistoryInclude = {
  orderBy: { createdAt: 'desc' as const },
  take: 50,
  include: {
    changedByUser: {
      select: { id: true, email: true, firstName: true, lastName: true },
    },
    changedByCreator: {
      select: { id: true, email: true, firstName: true, lastName: true },
    },
    changedByAdmin: {
      select: { id: true, email: true, firstName: true, lastName: true },
    },
  },
};

const creatorOrderInclude = {
  orderItems: {
    include: {
      product: { select: { name: true, slug: true, sku: true } },
      variant: { select: { id: true, options: true } },
    },
  },
  user: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
  statusHistory: statusHistoryInclude,
} satisfies Prisma.OrderInclude;

const creatorOrderListInclude = {
  orderItems: {
    include: {
      product: { select: { name: true, slug: true, sku: true } },
      variant: { select: { id: true, options: true } },
    },
  },
  user: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
  statusHistory: statusHistoryInclude,
} satisfies Prisma.OrderInclude;

const adminOrderInclude = {
  orderItems: {
    include: {
      product: { select: { name: true, slug: true, sku: true } },
      variant: { select: { id: true, options: true } },
    },
  },
  user: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
  payment: {
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      transactionId: true,
    },
  },
  statusHistory: statusHistoryInclude,
} satisfies Prisma.OrderInclude;

type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
type OrderWithItemsList = Prisma.OrderGetPayload<{
  include: typeof orderListInclude;
}>;
type CreatorOrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof creatorOrderInclude;
}>;
type CreatorOrderWithRelationsList = Prisma.OrderGetPayload<{
  include: typeof creatorOrderListInclude;
}>;
type AdminOrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof adminOrderInclude;
}>;
// Removed unused CheckoutCart, ShippingAddressRecord, ShippingAddressDelegate types

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly revalidatePrices: boolean;
  private readonly defaultCurrency: string;
  private readonly generateOrderId = customAlphabet(
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    6,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly discountCodeService: DiscountCodeService,
    private readonly referralService: ReferralService,
    private readonly shippingAddressesService: ShippingAddressesService,
    private readonly paymentsService: PaymentsService,
    private readonly emailService: EmailService,
    private readonly auditLog: AuditLogService,
    private readonly walletService: WalletService,
    private readonly eventEmitter: EventEmitter2,
    config: ConfigService,
  ) {
    this.revalidatePrices =
      config.getOrThrow<string>('CHECKOUT_REVALIDATE_PRICES') !== 'false';
    this.defaultCurrency = config.getOrThrow<string>('DEFAULT_CURRENCY');
  }

  async checkout(
    userId: string,
    dto: CheckoutDto,
    addressId: string | undefined,
    idempotencyKey: string,
  ): Promise<CheckoutResponseDto> {
    const idempKey = idempotencyKey.trim();

    // 1. Idempotency check — at the very top before any other logic
    const existingRecord = await this.prisma.checkoutIdempotency.findUnique({
      where: {
        userId_idempotencyKey: { userId, idempotencyKey: idempKey },
      },
    });

    if (existingRecord) {
      if (existingRecord.expiresAt > new Date()) {
        // Valid replay — fetch the existing order and return immediately
        const order = await this.prisma.order.findUnique({
          where: { id: existingRecord.orderId },
          include: orderInclude,
        });
        if (!order) {
          throw new BadRequestException(
            'Referenced order not found for idempotency key',
          );
        }
        return this.toCheckoutResponse(order);
      } else {
        // Expired record — clean it up and proceed fresh
        await this.prisma.checkoutIdempotency.delete({
          where: {
            userId_idempotencyKey: { userId, idempotencyKey: idempKey },
          },
        });
      }
    }

    // 2. Proceed with full checkout
    await this.usersService.assertActiveAccount(userId);

    const hasAddressId = !!addressId?.trim();
    const hasInlineAddress = !!dto.shippingAddress;
    if (hasAddressId && hasInlineAddress) {
      throw new BadRequestException(
        'Provide either addressId (query param) or shippingAddress (body), not both.',
      );
    }
    if (!hasAddressId && !hasInlineAddress) {
      throw new BadRequestException(
        'A shipping address is required. Provide addressId (query param) or shippingAddress (body).',
      );
    }

    // Resolve shipping address before the transaction
    let resolvedShippingAddress: string;
    let resolvedShippingAddressId: string | null;

    if (hasAddressId) {
      const savedAddress = await this.prisma.shippingAddress.findUnique({
        where: { id: addressId!.trim() },
        select: {
          id: true,
          userId: true,
          fullName: true,
          phone: true,
          street: true,
          city: true,
          state: true,
          country: true,
        },
      });
      if (!savedAddress) {
        throw new BadRequestException('Shipping address not found.');
      }
      if (savedAddress.userId !== userId) {
        throw new ForbiddenException(
          'You do not have access to this shipping address.',
        );
      }
      const parts = [
        savedAddress.fullName,
        savedAddress.street,
        savedAddress.city,
        savedAddress.state,
        savedAddress.country,
      ].filter(Boolean);
      resolvedShippingAddress = `${parts.join(', ')} (Tel: ${savedAddress.phone})`;
      resolvedShippingAddressId = savedAddress.id;
    } else {
      // Inline address — save to the user's address book for future use
      const inlineAddr = dto.shippingAddress!;
      const created = await this.shippingAddressesService.create(userId, {
        fullName: inlineAddr.fullName,
        phone: inlineAddr.phone,
        street: inlineAddr.street,
        city: inlineAddr.city,
        state: inlineAddr.state,
        country: inlineAddr.country ?? 'Nigeria',
        isDefault: false,
      });
      const parts = [
        created.fullName,
        created.street,
        created.city,
        created.state,
        created.country,
      ].filter(Boolean);
      resolvedShippingAddress = `${parts.join(', ')} (Tel: ${created.phone})`;
      resolvedShippingAddressId = created.id;
    }

    const order = await this.executeCheckout(
      userId,
      dto,
      addressId,
      resolvedShippingAddress,
      resolvedShippingAddressId,
      idempKey,
    );

    // Initialize Paystack payment outside the transaction
    await this.paymentsService.initializeForOrder(userId, order.id);

    const responseDto = this.toResponse(order);
    this.sendOrderConfirmationEmail(userId, responseDto).catch((err) => {
      this.logger.error(
        `Background sendOrderConfirmationEmail failed for order ${order.id}`,
        err,
      );
    });

    return this.toCheckoutResponse(order);
  }

  async cancelMine(userId: string, orderId: string): Promise<OrderResponseDto> {
    await this.usersService.assertActiveAccount(userId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    await this.transitionOrderStatus({
      orderId,
      nextStatus: OrderStatus.CANCELLED,
      changedByUserId: userId,
    });

    return this.findOne(userId, orderId);
  }

  async findMine(userId: string, query: PaginationQueryDto) {
    await this.usersService.assertActiveAccount(userId);
    const { page = 1, limit = 10 } = query;
    const where = { userId };
    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: orderListInclude,
        orderBy: { createdAt: 'desc' },
        ...getPagination(page, limit),
      }),
    ]);

    return {
      data: orders.map((o) => this.toResponse(o)),
      meta: createPaginationMeta(total, page, limit),
    };
  }

  private assertOwnership(ownerId: string, userId: string, entityName: string) {
    if (ownerId !== userId) {
      throw new ForbiddenException(
        `You do not have permission to access this ${entityName}`,
      );
    }
  }

  async findOne(userId: string, orderId: string): Promise<OrderResponseDto> {
    await this.usersService.assertActiveAccount(userId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    this.assertOwnership(order.userId, userId, 'order');
    return this.toResponse(order);
  }

  async findAllAdmin(query: QueryOrderDto) {
    const {
      page = 1,
      limit = 10,
      status,
      userId,
      search,
      fromDate,
      toDate,
    } = query;
    const where: Prisma.OrderWhereInput = {};

    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (search?.trim()) {
      const term = search.trim();
      where.OR = [
        { orderNumber: { contains: term, mode: 'insensitive' } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
      ];
    }
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: adminOrderInclude,
        orderBy: { createdAt: 'desc' },
        ...getPagination(page, limit),
      }),
    ]);

    return {
      data: orders.map((o) => this.toAdminResponse(o)),
      meta: createPaginationMeta(total, page, limit),
    };
  }

  async findOneAdmin(orderId: string): Promise<AdminOrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: adminOrderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.toAdminResponse(order);
  }

  async findAllForCreator(
    creatorId: string,
    params: {
      page?: number;
      limit?: number;
      status?: string;
      fromDate?: string;
      toDate?: string;
    },
  ): Promise<{
    data: CreatorOrderResponseDto[];
    meta: ReturnType<typeof createPaginationMeta>;
  }> {
    const { page = 1, limit = 10, status, fromDate, toDate } = params;

    const where: Prisma.OrderWhereInput = {
      orderItems: {
        some: { creatorId },
      },
    };

    if (status) {
      where.status = status as OrderStatus;
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: creatorOrderListInclude,
        orderBy: { createdAt: 'desc' },
        ...getPagination(page, limit),
      }),
    ]);

    return {
      data: orders.map((order) => this.toCreatorResponse(order)),
      meta: createPaginationMeta(total, page, limit),
    };
  }

  async findOneForCreator(
    creatorId: string,
    orderId: string,
  ): Promise<CreatorOrderResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        orderItems: { some: { creatorId } },
      },
      include: creatorOrderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.toCreatorResponse(order);
  }

  async updateStatusAdmin(
    orderId: string,
    nextStatus: OrderStatus,
    adminId: string,
    note?: string,
  ): Promise<AdminOrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === nextStatus) {
      return this.findOneAdmin(orderId);
    }

    await this.transitionOrderStatus({
      orderId,
      nextStatus,
      changedByAdminId: adminId,
      note,
    });

    await this.auditLog.log({
      action: 'UPDATE_ORDER_STATUS',
      entity: 'Order',
      entityId: orderId,
      adminId,
      payload: { fromStatus: order.status, toStatus: nextStatus, note },
    });

    return this.findOneAdmin(orderId);
  }

  async updateStatusForCreator(
    creatorId: string,
    orderId: string,
    nextStatus: OrderStatus,
    note?: string,
  ): Promise<CreatorOrderResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        orderItems: { some: { creatorId } },
      },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    // Creators may only advance fulfillment statuses
    const allowed: OrderStatus[] = [OrderStatus.SHIPPED, OrderStatus.DELIVERED];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `Creators can only transition an order to: ${allowed.join(', ')}`,
      );
    }

    await this.transitionOrderStatus({
      orderId,
      nextStatus,
      changedByCreatorId: creatorId,
      note,
    });

    return this.findOneForCreator(creatorId, orderId);
  }

  async updateShippingMine(
    userId: string,
    orderId: string,
    shippingAddress: string,
  ): Promise<OrderResponseDto> {
    await this.usersService.assertActiveAccount(userId);

    const result = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        userId,
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.DELIVERED] },
      },
      data: { shippingAddress },
    });

    if (result.count === 0) {
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, userId },
        select: { status: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      throw new BadRequestException(
        'Cannot update shipping on cancelled or delivered orders',
      );
    }

    return this.findOne(userId, orderId);
  }

  private async transitionOrderStatus(params: {
    orderId: string;
    nextStatus: OrderStatus;
    changedByUserId?: string;
    changedByCreatorId?: string;
    changedByAdminId?: string;
    note?: string;
  }): Promise<string> {
    const {
      orderId,
      nextStatus,
      changedByUserId,
      changedByCreatorId,
      changedByAdminId,
      note,
    } = params;

    let orderUserId: string | undefined;
    let originalStatus: OrderStatus | undefined;

    try {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            orderItems: true,
            payment: true,
          },
        });
        if (!current) throw new NotFoundException('Order not found');

        orderUserId = current.userId;
        originalStatus = current.status;

        if (originalStatus === nextStatus) return;

        assertValidOrderTransition(originalStatus, nextStatus);

        const updated = await tx.order.updateMany({
          where: { id: orderId, status: originalStatus },
          data: { status: nextStatus },
        });

        if (updated.count === 0) {
          throw new ConflictException(
            'Order status was updated by another request; refresh and retry',
          );
        }

        const restoreStock =
          shouldRestoreStock(originalStatus, nextStatus) &&
          !current.stockRestored;

        if (restoreStock) {
          for (const item of current.orderItems) {
            if (item.variantId) {
              // Restore variant stock by incrementing directly
              const v = await tx.productVariant.findFirst({
                where: { id: item.variantId! },
                select: { id: true, stock: true, productId: true },
              });
              if (v) {
                const oldStock = v.stock;
                const newStock = v.stock + item.quantity;
                await tx.productVariant.update({
                  where: { id: item.variantId! },
                  data: { stock: newStock },
                });
                await tx.stockHistory.create({
                  data: {
                    productId: v.productId,
                    variantId: item.variantId!,
                    adjustment: item.quantity,
                    oldStockQuantity: oldStock,
                    newStockQuantity: newStock,
                    description: 'Stock restored (order cancelled)',
                  },
                });
              }
            } else {
              // Restore product base stock
              const prod = await tx.product.findFirst({
                where: { id: item.productId },
                select: { id: true, stock: true },
              });
              if (prod) {
                const oldStock = prod.stock;
                await tx.product.update({
                  where: { id: item.productId },
                  data: { stock: { increment: item.quantity } },
                });
                await tx.stockHistory.create({
                  data: {
                    productId: item.productId,
                    adjustment: item.quantity,
                    oldStockQuantity: oldStock,
                    newStockQuantity: oldStock + item.quantity,
                    description: 'Stock restored (order cancelled)',
                  },
                });
              }
            }
          }
          await tx.order.update({
            where: { id: orderId },
            data: { stockRestored: true },
          });
        }

        if (current.payment) {
          const nextPaymentStatus = resolvePaymentStatusAfterOrderChange(
            current.payment.status,
            nextStatus,
          );
          if (
            nextPaymentStatus &&
            nextPaymentStatus !== current.payment.status
          ) {
            await tx.payment.update({
              where: { id: current.payment.id },
              data: { status: nextPaymentStatus },
            });
          }
        }

        await tx.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: originalStatus,
            toStatus: nextStatus,
            changedByUserId,
            changedByCreatorId,
            changedByAdminId,
            note: generateStatusNote({
              fromStatus: originalStatus,
              toStatus: nextStatus,
              changedByAdminId,
              changedByCreatorId,
              changedByUserId,
              manualNote: note?.trim() || undefined,
            }),
          },
        });

        // Settle creator earnings when order is delivered
        if (nextStatus === OrderStatus.DELIVERED) {
          const creatorEarnings = new Map<string, Prisma.Decimal>();
          for (const item of current.orderItems) {
            const earning = new Prisma.Decimal(
              Number(
                (Number(item.unitPrice) * item.quantity * 0.85).toFixed(2),
              ),
            );
            const existing =
              creatorEarnings.get(item.creatorId) ?? new Prisma.Decimal(0);
            creatorEarnings.set(item.creatorId, existing.add(earning));
          }

          for (const [creatorId, earning] of creatorEarnings) {
            await this.walletService.settleCreatorEarning(
              creatorId,
              earning,
              orderId,
              tx,
            );
          }
        }

        // Reverse pending creator earnings when order is cancelled (only pending, not settled)
        if (nextStatus === OrderStatus.CANCELLED) {
          const creatorEarnings = new Map<string, Prisma.Decimal>();
          for (const item of current.orderItems) {
            const earning = new Prisma.Decimal(
              Number(
                (Number(item.unitPrice) * item.quantity * 0.85).toFixed(2),
              ),
            );
            const existing =
              creatorEarnings.get(item.creatorId) ?? new Prisma.Decimal(0);
            creatorEarnings.set(item.creatorId, existing.add(earning));
          }

          for (const [creatorId, earning] of creatorEarnings) {
            await this.walletService.debitCreatorPending(
              creatorId,
              earning,
              orderId,
              tx,
            );
          }
        }
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith('Invalid order transition:')
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    // Grant referral rewards when a referred user's order is delivered.
    // Both the referred user and the referrer receive wallet credits.
    if (nextStatus === OrderStatus.DELIVERED && orderUserId) {
      this.referralService
        .grantReferralRewards(orderId, orderUserId)
        .catch((err) =>
          this.logger.error(
            `Failed to grant referral rewards for order ${orderId}`,
            err,
          ),
        );
    }

    // Emit domain events for status changes so email notifications are sent
    this.emitStatusChangeEvents(orderId, nextStatus, orderUserId).catch((err) =>
      this.logger.error(
        `Failed to emit status change events for order ${orderId}`,
        err,
      ),
    );

    return orderId;
  }

  private async executeCheckout(
    userId: string,
    dto: CheckoutDto,
    addressId: string | undefined,
    resolvedShippingAddress: string,
    resolvedShippingAddressId: string | null,
    idempotencyKey?: string,
  ): Promise<OrderWithItems> {
    // 10s transaction timeout covers stock deduction, order + payment creation.
    // FK pre-validation runs outside the transaction so we keep this lean.
    const TX_TIMEOUT = 10_000;
    return this.prisma.$transaction(
      async (tx) => {
        // Fetch and lock the cart inside the transaction
        const lockedCart = await tx.cart.findFirst({
          where: { userId, checkedOut: false },
          include: {
            cartItems: {
              include: {
                product: { include: { images: { select: { url: true } } } },
                variant: true,
              },
            },
          },
        });

        if (!lockedCart || !lockedCart.cartItems.length) {
          throw new BadRequestException('Cart is empty');
        }

        // Remove invalid items
        const invalidCartItemIds = lockedCart.cartItems
          .filter(
            (item) =>
              item.product.isDeleted ||
              !item.product.isActive ||
              !item.product.creatorId ||
              (item.variantId &&
                (!item.variant ||
                  item.variant.isDeleted ||
                  !item.variant.isActive)),
          )
          .map((item) => item.id);

        if (invalidCartItemIds.length > 0) {
          await tx.cartItem.deleteMany({
            where: { id: { in: invalidCartItemIds } },
          });
          this.logger.warn(
            `Dropped ${invalidCartItemIds.length} invalid cart item(s) from cart ${lockedCart.id} during checkout`,
          );
          throw new BadRequestException(
            'Some items in your cart became unavailable during checkout. Refresh your cart and try again.',
          );
        }

        // Validate products, prices, and stock
        // Deduct stock - collect updates for batch processing
        const stockUpdatePromises: Promise<{
          success: boolean;
          itemName: string;
          variantLabel: string | null;
        }>[] = [];

        for (const item of lockedCart.cartItems) {
          if (item.product.isDeleted || !item.product.isActive) {
            throw new BadRequestException(
              `Product "${item.product.name}" is no longer available`,
            );
          }

          if (
            item.variantId &&
            (!item.variant || item.variant.isDeleted || !item.variant.isActive)
          ) {
            throw new BadRequestException(
              `Selected variant for "${item.product.name}" is no longer available`,
            );
          }

          if (!item.product.creatorId) {
            throw new BadRequestException(
              `Product "${item.product.name}" is missing a creator assignment. Please contact support.`,
            );
          }

          // Price determination: use product.price
          const livePrice = Number(item.product.price);
          const cartPrice = Number(item.unitPrice);
          if (this.revalidatePrices && livePrice !== cartPrice) {
            // Update cart item price to reflect current live price
            await tx.cartItem.update({
              where: { id: item.id },
              data: { unitPrice: new Prisma.Decimal(livePrice) },
            });
            // Update in-memory price so the order uses the live price, not the stale one
            item.unitPrice = new Prisma.Decimal(livePrice);
            this.logger.warn(
              `Cart item unit price updated for product "${item.product.name}" (cartItemId=${item.id}) from ${cartPrice} to ${livePrice}`,
            );
          }

          const variantLabel = item.variant
            ? Object.values(item.variant.options as Record<string, any>).join(
                ', ',
              )
            : null;

          // Collect stock update promises
          if (item.variantId) {
            stockUpdatePromises.push(
              (async () => {
                const v = await tx.productVariant.findFirst({
                  where: { id: item.variantId! },
                  select: { id: true, stock: true },
                });
                if (!v)
                  return {
                    success: false,
                    itemName: item.product.name,
                    variantLabel,
                  };

                if (v.stock < item.quantity) {
                  return {
                    success: false,
                    itemName: item.product.name,
                    variantLabel,
                  };
                }

                const oldVariantStock = v.stock;
                const newVariantStock = v.stock - item.quantity;

                await tx.productVariant.update({
                  where: { id: item.variantId! },
                  data: { stock: newVariantStock },
                });

                await tx.stockHistory.create({
                  data: {
                    productId: item.productId,
                    variantId: item.variantId!,
                    adjustment: -item.quantity,
                    oldStockQuantity: oldVariantStock,
                    newStockQuantity: newVariantStock,
                    description: 'Order placed',
                  },
                });

                return {
                  success: true,
                  itemName: item.product.name,
                  variantLabel,
                };
              })(),
            );
          } else {
            stockUpdatePromises.push(
              (async () => {
                const prod = await tx.product.findFirst({
                  where: { id: item.productId },
                  select: { id: true, stock: true },
                });
                if (!prod || prod.stock < item.quantity) {
                  return {
                    success: false,
                    itemName: item.product.name,
                    variantLabel: null,
                  };
                }
                const oldStock = prod.stock;
                const result = await tx.product.updateMany({
                  where: {
                    id: item.productId,
                    isDeleted: false,
                    isActive: true,
                    stock: { gte: item.quantity },
                  },
                  data: { stock: { decrement: item.quantity } },
                });
                if (result.count > 0) {
                  await tx.stockHistory.create({
                    data: {
                      productId: item.productId,
                      adjustment: -item.quantity,
                      oldStockQuantity: oldStock,
                      newStockQuantity: oldStock - item.quantity,
                      description: 'Order placed',
                    },
                  });
                }
                return {
                  success: result.count > 0,
                  itemName: item.product.name,
                  variantLabel: null,
                };
              })(),
            );
          }
        }

        // Execute all stock updates in parallel and validate results
        const stockUpdateResults = await Promise.all(stockUpdatePromises);
        for (const result of stockUpdateResults) {
          if (!result.success) {
            throw new BadRequestException(
              result.variantLabel
                ? `Insufficient stock for "${result.itemName}" (variant: ${result.variantLabel})`
                : `Insufficient stock for "${result.itemName}"`,
            );
          }
        }

        // Calculate subtotal using updated prices
        const totalAmount = lockedCart.cartItems.reduce(
          (sum, item) => sum + Number(item.unitPrice) * item.quantity,
          0,
        );

        // Apply discount code if provided
        let discountAmount = 0;
        let discountCode: string | null = null;
        let discountRecord: Awaited<
          ReturnType<typeof this.discountCodeService.validate>
        > | null = null;

        if (dto.discountCode) {
          const validatedCode = await this.discountCodeService.validate(
            dto.discountCode,
            userId,
            new Prisma.Decimal(totalAmount),
          );
          discountRecord = validatedCode;
          discountCode = validatedCode.code;

          // Product-level scoping: PLATFORM codes skip checks; CREATOR codes validate against cart products
          if (
            validatedCode.scope === 'CREATOR' &&
            !validatedCode.platformwide &&
            validatedCode.applicableProductIds.length > 0
          ) {
            const cartProductIds = lockedCart.cartItems.map(
              (item) => item.productId,
            );
            const hasApplicableProduct = cartProductIds.some((pid) =>
              validatedCode.applicableProductIds.includes(pid),
            );
            if (!hasApplicableProduct) {
              throw new BadRequestException(
                'This discount code does not apply to any products in your cart',
              );
            }
          }

          const calculatedDiscount = this.discountCodeService.calculateDiscount(
            validatedCode,
            new Prisma.Decimal(totalAmount),
          );
          discountAmount = Number(calculatedDiscount);
        }

        const finalAmount = Number(
          Math.max(totalAmount - discountAmount, 0).toFixed(2),
        );

        // Mark cart as checked out
        const locked = await tx.cart.updateMany({
          where: { id: lockedCart.id, userId, checkedOut: false },
          data: { checkedOut: true },
        });
        if (locked.count === 0) {
          throw new BadRequestException('Cart is empty or already checked out');
        }

        // Build order items with snapshots, normalizing empty variantId to null
        const orderItemData = lockedCart.cartItems.map((item) => {
          const unitPriceVal = Number(item.unitPrice);
          const totalPriceVal = Number(
            (unitPriceVal * item.quantity).toFixed(2),
          );
          const productSnapshot = {
            name: item.product.name,
            sku: item.product.sku,
            images: item.product.images?.map((img) => img.url) ?? [],
          } as Prisma.InputJsonValue;
          const variantSnapshot = item.variant
            ? (item.variant.options as Prisma.InputJsonValue)
            : Prisma.DbNull;

          return {
            productId: item.productId,
            variantId: item.variantId?.trim() || null,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(unitPriceVal),
            totalPrice: new Prisma.Decimal(totalPriceVal),
            productSnapshot,
            variantSnapshot,
            creatorId: item.product.creatorId,
          };
        });

        // Create the order without nested creates
        const now = new Date();
        const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
        const orderNumber = `ORD-${datePart}-${this.generateOrderId()}`;

        const order = await tx.order.create({
          data: {
            orderNumber,
            userId,
            cartId: lockedCart.id,
            status: OrderStatus.PENDING,
            totalAmount,
            discountAmount: new Prisma.Decimal(discountAmount),
            finalAmount: new Prisma.Decimal(finalAmount),
            discountCode,
            shippingAddress: resolvedShippingAddress,
            ...(resolvedShippingAddressId
              ? { shippingAddressId: resolvedShippingAddressId }
              : {}),
          },
        });

        // Create order items via createMany
        await tx.orderItem.createMany({
          data: orderItemData.map((item) => ({
            ...item,
            orderId: order.id,
          })),
        });

        // Create status history
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: null,
            toStatus: OrderStatus.PENDING,
            note: 'Order placed',
          },
        });

        // Re-fetch the full order with includes for the response
        const fullOrder = await tx.order.findUnique({
          where: { id: order.id },
          include: orderInclude,
        });
        if (!fullOrder) {
          throw new BadRequestException('Failed to retrieve created order');
        }

        // Consume discount code if one was applied
        if (discountRecord) {
          if (!order?.id) {
            throw new BadRequestException('Failed to create order');
          }
          await this.discountCodeService.recordUsage(
            discountRecord.id,
            order.id,
            userId,
            new Prisma.Decimal(discountAmount),
            tx,
          );
        }

        // Create a PENDING payment record
        await tx.payment.create({
          data: {
            amount: new Prisma.Decimal(finalAmount),
            status: PaymentStatus.PENDING,
            currency: this.defaultCurrency,
            userId,
            orderId: order.id,
          },
        });

        // Idempotency record
        if (idempotencyKey) {
          const expiresAt = new Date();
          expiresAt.setHours(
            expiresAt.getHours() + CHECKOUT_IDEMPOTENCY_TTL_HOURS,
          );
          await tx.checkoutIdempotency.create({
            data: {
              userId,
              idempotencyKey,
              orderId: order.id,
              expiresAt,
            },
          });
        }

        return fullOrder;
      },
      { timeout: TX_TIMEOUT },
    );
  }

  private toResponse(
    order: OrderWithItems | OrderWithItemsList,
  ): OrderResponseDto {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      discountAmount: Number(order.discountAmount),
      referralDiscountAmount: Number(order.referralDiscountAmount),
      finalAmount: Number(order.finalAmount),
      discountCode: order.discountCode ?? null,
      referralCode: order.referralCode ?? null,
      shippingAddress: order.shippingAddress,
      shippingAddressId: order.shippingAddressId ?? null,
      createdAt: order.createdAt,
      items: order.orderItems.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        productSnapshot: item.productSnapshot as {
          name: string;
          sku: string;
          images: string[];
        },
        variantSnapshot: this.normalizeVariantSnapshot(item.variantSnapshot),
      })),
    };
  }

  private normalizeVariantSnapshot(
    snapshot: unknown,
  ): { options: { name: string; value: string }[] } | null {
    if (!snapshot) return null;

    // New DB format: already an array of { name, value }
    if (Array.isArray(snapshot)) {
      return { options: snapshot as { name: string; value: string }[] };
    }

    // Legacy DB format: object { size: "M", color: "Black" }
    if (typeof snapshot === 'object' && snapshot !== null) {
      const options = Object.entries(snapshot as Record<string, string>).map(
        ([name, value]) => ({ name, value }),
      );
      return { options };
    }

    return null;
  }

  private toCheckoutResponse(order: OrderWithItems): CheckoutResponseDto {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      discountAmount: Number(order.discountAmount),
      referralDiscountAmount: Number(order.referralDiscountAmount),
      finalAmount: Number(order.finalAmount),
      discountCode: order.discountCode ?? null,
      referralCode: order.referralCode ?? null,
      items: order.orderItems.map((item) => {
        const productSnapshot = item.productSnapshot as {
          name: string;
          sku: string;
          images: string[];
        } | null;
        const variantSnapshot = this.normalizeVariantSnapshot(
          item.variantSnapshot,
        );
        return {
          productName: productSnapshot?.name ?? item.product.name,
          variantName: variantSnapshot
            ? variantSnapshot.options.map((o) => o.value).join(', ')
            : undefined,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
        };
      }),
      shippingAddress: order.shippingAddress ?? null,
      createdAt: order.createdAt,
    };
  }

  private toCreatorResponse(
    order: CreatorOrderWithRelations | CreatorOrderWithRelationsList,
  ): CreatorOrderResponseDto {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      discountAmount: Number(order.discountAmount),
      referralDiscountAmount: Number(order.referralDiscountAmount),
      finalAmount: Number(order.finalAmount),
      discountCode: order.discountCode ?? null,
      referralCode: order.referralCode ?? null,
      shippingAddress: order.shippingAddress,
      stockRestored: order.stockRestored,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      customer: {
        id: order.user.id,
        email: order.user.email,
        firstName: order.user.firstName,
        lastName: order.user.lastName,
      },
      items: order.orderItems.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        productSnapshot: item.productSnapshot as {
          name: string;
          sku: string;
          images: string[];
        },
        variantSnapshot: this.normalizeVariantSnapshot(item.variantSnapshot),
      })),
      statusHistory: (order as CreatorOrderWithRelations).statusHistory
        ? (order as CreatorOrderWithRelations).statusHistory.map((h) => {
            const actor =
              h.changedByUser ?? h.changedByCreator ?? h.changedByAdmin;
            return {
              id: h.id,
              fromStatus: h.fromStatus ?? null,
              toStatus: h.toStatus,
              note: h.note ?? null,
              createdAt: h.createdAt,
              changedBy: actor
                ? {
                    id: actor.id,
                    email: actor.email,
                    firstName: actor.firstName,
                    lastName: actor.lastName,
                  }
                : null,
            };
          })
        : [],
    };
  }

  private toAdminResponse(
    order: AdminOrderWithRelations,
  ): AdminOrderResponseDto {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.payment?.status ?? PaymentStatus.PENDING,
      totalAmount: Number(order.totalAmount),
      discountAmount: Number(order.discountAmount),
      referralDiscountAmount: Number(order.referralDiscountAmount),
      finalAmount: Number(order.finalAmount),
      discountCode: order.discountCode ?? null,
      referralCode: order.referralCode ?? null,
      platformFee: 0,
      creatorRevenue: 0,
      shippingAddress: order.shippingAddress,
      stockRestored: order.stockRestored,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      customer: {
        id: order.user.id,
        email: order.user.email,
        firstName: order.user.firstName,
        lastName: order.user.lastName,
      },
      payment: order.payment
        ? {
            id: order.payment.id,
            status: order.payment.status,
            amount: Number(order.payment.amount),
            currency: order.payment.currency,
            transactionId: order.payment.transactionId,
          }
        : null,
      items: order.orderItems.map((item) => ({
        productId: item.productId,
        productSku: (item.productSnapshot as any)?.sku ?? item.product.sku,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        productSnapshot: item.productSnapshot as {
          name: string;
          sku: string;
          images: string[];
        },
        variantSnapshot: this.normalizeVariantSnapshot(item.variantSnapshot),
      })),
      statusHistory: order.statusHistory.map((entry) => {
        const actor =
          entry.changedByUser ?? entry.changedByCreator ?? entry.changedByAdmin;
        return {
          id: entry.id,
          fromStatus: entry.fromStatus,
          toStatus: entry.toStatus,
          note: entry.note,
          createdAt: entry.createdAt,
          changedBy: actor
            ? {
                id: actor.id,
                email: actor.email,
                firstName: actor.firstName,
                lastName: actor.lastName,
              }
            : null,
        };
      }),
    };
  }

  private async sendOrderConfirmationEmail(
    userId: string,
    order: OrderResponseDto,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true },
      });
      if (!user) return;

      const items = order.items.map((i) => {
        const variantSnapshot = i.variantSnapshot as {
          options: { name: string; value: string }[];
        } | null;
        const variantName = variantSnapshot?.options
          ? variantSnapshot.options
              .map((o) => `${o.name}: ${o.value}`)
              .join(', ')
          : undefined;
        return {
          productName: i.productSnapshot?.name ?? 'Unknown Product',
          quantity: i.quantity,
          price: i.unitPrice,
          variantName,
        };
      });

      await this.emailService.sendOrderConfirmation(user.email, {
        orderNumber: order.orderNumber,
        customerName:
          `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
          'Valued Customer',
        customerEmail: user.email,
        shippingAddress: order.shippingAddress || '',
        totalAmount: order.totalAmount,
        discountAmount: order.discountAmount,
        discountCode: order.discountCode,
        finalAmount: order.finalAmount,
        currency: this.defaultCurrency,
        createdAt: order.createdAt,
        items,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send order confirmation email for order ${order.id}`,
        err,
      );
    }
  }

  private async emitStatusChangeEvents(
    orderId: string,
    nextStatus: OrderStatus,
    orderUserId: string | undefined,
  ): Promise<void> {
    if (!orderUserId) return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, email: true, firstName: true } },
        orderItems: {
          include: {
            product: { select: { name: true } },
            variant: { select: { options: true } },
            creator: { select: { id: true, email: true, storeName: true } },
          },
        },
      },
    });

    if (!order || !order.user) return;

    const mapItems = () =>
      order.orderItems.map((item) => ({
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        variantOptions: item.variant
          ? (item.variant.options as { name: string; value: string }[])
          : undefined,
      }));

    switch (nextStatus) {
      case OrderStatus.SHIPPED: {
        const payload: OrderShippedPayload = {
          orderId: order.id,
          orderNumber: order.orderNumber,
          userId: order.userId,
          userEmail: order.user.email,
          userFirstName: order.user.firstName,
          creatorEmails: order.orderItems.map((item) => ({
            creatorId: item.creator.id,
            email: item.creator.email,
            storeName: item.creator.storeName,
          })),
          trackingNumber: undefined,
          items: mapItems(),
        };
        this.eventEmitter.emit(DomainEvents.ORDER_SHIPPED, payload);
        break;
      }
      case OrderStatus.DELIVERED: {
        const payload: OrderDeliveredPayload = {
          orderId: order.id,
          orderNumber: order.orderNumber,
          userId: order.userId,
          userEmail: order.user.email,
          userFirstName: order.user.firstName,
          items: mapItems(),
        };
        this.eventEmitter.emit(DomainEvents.ORDER_DELIVERED, payload);
        break;
      }
      case OrderStatus.CANCELLED: {
        const payload: OrderCancelledPayload = {
          orderId: order.id,
          orderNumber: order.orderNumber,
          userId: order.userId,
          userEmail: order.user.email,
          userFirstName: order.user.firstName,
          reason: undefined,
          refundProcessed: false,
          items: mapItems(),
        };
        this.eventEmitter.emit(DomainEvents.ORDER_CANCELLED, payload);
        break;
      }
    }
  }
}
