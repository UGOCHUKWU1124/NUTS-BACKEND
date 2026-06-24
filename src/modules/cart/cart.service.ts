import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { UsersService } from 'src/modules/users/users.service';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { AddToCartResponseDto } from './dto/responses/add-to-cart.response';
import { ClearCartResponseDto } from './dto/responses/clear-cart.response';
import { GetCartResponseDto } from './dto/responses/get-cart.response';
import { RemoveCartItemResponseDto } from './dto/responses/remove-cart-item.response';
import { UpdateCartItemResponseDto } from './dto/responses/update-cart-item.response';
import { AddedFromDto } from './dto/add-to-cart-quantity.dto';

const cartInclude = {
  cartItems: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          price: true,
          stock: true,
          lowStockThreshold: true,
          hasVariants: true,
          description: true,
          isActive: true,
          isDeleted: true,
          images: {
            select: { url: true, isPrimary: true },
            orderBy: { position: 'asc' },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              parentId: true,
              parent: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
          creator: {
            select: {
              id: true,
              storeName: true,
            },
          },
        },
      },
      variant: {
        select: {
          id: true,
          options: true,
          stock: true,
          isActive: true,
          isDeleted: true,
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async getCart(userId: string): Promise<GetCartResponseDto> {
    await this.usersService.assertActiveAccount(userId);
    const cart = await this.getCartWithSyncedPrices(userId);
    return this.toResponse(cart);
  }

  async addToCart(
    userId: string,
    productId: string,
    quantity: number,
    variantId?: string,
    addedFrom?: AddedFromDto,
  ): Promise<AddToCartResponseDto> {
    await this.usersService.assertActiveAccount(userId);
    const normalizedVariantId = this.normalizeVariantId(variantId);

    // Validate product existence and variant rules
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isActive: true, isDeleted: false },
      select: { id: true, hasVariants: true, price: true, stock: true },
    });

    if (!product) {
      throw new NotFoundException('Product not available');
    }

    // Variant-first validation
    if (product.hasVariants && !normalizedVariantId) {
      throw new BadRequestException('Please select a product variant');
    }
    if (!product.hasVariants && normalizedVariantId) {
      throw new BadRequestException('This product does not support variants');
    }

    // Fetch variant and check stock
    let availableStock = product.stock;
    if (normalizedVariantId) {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: normalizedVariantId, productId },
        select: { id: true, options: true, stock: true },
      });
      if (!variant) {
        throw new BadRequestException(
          'Variant not found or does not belong to this product',
        );
      }
      availableStock = variant.stock;
    }

    const cart = await this.getOrCreateActiveCart(userId);

    // Update the cart source if provided and different from current
    if (addedFrom) {
      const currentType = (cart.addedFrom as { type?: string } | null)?.type;
      if (currentType !== addedFrom.type) {
        await this.prisma.cart.update({
          where: { id: cart.id },
          data: { addedFrom: { type: addedFrom.type } },
        });
      }
    }

    await this.prisma.$transaction(async (prisma) => {
      const existingItem = await prisma.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId,
          variantId: normalizedVariantId,
        },
      });

      const unitPrice = Number(product.price);
      const newQuantity = (existingItem?.quantity ?? 0) + quantity;

      if (newQuantity > availableStock) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${availableStock}, requested: ${newQuantity}`,
        );
      }

      if (existingItem) {
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: newQuantity,
            unitPrice,
            totalPrice: unitPrice * newQuantity,
          },
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId,
            variantId: normalizedVariantId,
            quantity,
            unitPrice,
            totalPrice: unitPrice * quantity,
          },
        });
      }
    });

    // Return full cart + the specific item that was added/incremented
    const fullCart = await this.getCartWithSyncedPrices(userId);
    const response = this.toResponse(fullCart);
    const addedItem =
      response.cartItems.find(
        (i) =>
          i.productId === productId &&
          i.variant?.id === (normalizedVariantId ?? undefined),
      ) ?? response.cartItems.find((i) => i.productId === productId);
    return { cart: response.cart, addedItem: addedItem! };
  }

  async updateItem(
    userId: string,
    productId: string,
    variantId: string | undefined,
    dto: UpdateCartItemDto,
  ): Promise<UpdateCartItemResponseDto> {
    await this.usersService.assertActiveAccount(userId);
    const normalizedVariantId = this.normalizeVariantId(variantId);
    const cart = await this.getOrCreateActiveCart(userId);
    const cartItem = cart.cartItems.find(
      (item) =>
        item.productId === productId && item.variantId === normalizedVariantId,
    );
    if (!cartItem) throw new NotFoundException('Cart item not found');

    const delta = dto.quantity;
    const newQuantity = cartItem.quantity + delta;

    if (newQuantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: cartItem.id } });
      cart.cartItems = cart.cartItems.filter((i) => i.id !== cartItem.id);
    } else {
      const stock = cartItem.variant
        ? (cartItem.variant.stock ?? 0)
        : cartItem.product.stock;

      if (delta > 0 && newQuantity > stock) {
        throw new BadRequestException('Insufficient stock');
      }

      const unitPrice = Number(cartItem.unitPrice);

      await this.prisma.cartItem.update({
        where: { id: cartItem.id },
        data: {
          quantity: newQuantity,
          totalPrice: unitPrice * newQuantity,
        },
      });
      cartItem.quantity = newQuantity;
      cartItem.totalPrice = new Prisma.Decimal(unitPrice * newQuantity);
    }

    const response = this.toResponse(cart);
    const updatedItem =
      response.cartItems.find(
        (i) =>
          i.productId === productId &&
          i.variant?.id === (normalizedVariantId ?? undefined),
      ) ??
      response.cartItems.find((i) => i.productId === productId) ??
      null;
    return { cart: response.cart, updatedItem };
  }

  async removeItem(
    userId: string,
    productId: string,
    variantId: string | undefined,
  ): Promise<RemoveCartItemResponseDto> {
    await this.usersService.assertActiveAccount(userId);
    const normalizedVariantId = this.normalizeVariantId(variantId);
    const cart = await this.getOrCreateActiveCart(userId);
    const cartItem = cart.cartItems.find(
      (item) =>
        item.productId === productId && item.variantId === normalizedVariantId,
    );
    if (!cartItem) throw new NotFoundException('Cart item not found');

    const removedItemId = cartItem.id;
    await this.prisma.cartItem.delete({ where: { id: cartItem.id } });
    cart.cartItems = cart.cartItems.filter((i) => i.id !== cartItem.id);
    return { cart: this.toResponse(cart).cart, removedItemId };
  }

  async clearCart(userId: string): Promise<ClearCartResponseDto> {
    await this.usersService.assertActiveAccount(userId);
    const cart = await this.getOrCreateActiveCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    cart.cartItems = [];
    return this.toResponse(cart);
  }

  private async getOrCreateActiveCart(userId: string): Promise<CartWithItems> {
    let cart = await this.prisma.cart.findFirst({
      where: { userId, checkedOut: false },
      include: cartInclude,
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: cartInclude,
      });
    }

    return cart;
  }

  /**
   * Fetches the active cart, syncs prices in-place on the returned object,
   * and returns the cart + updated items — all without a redundant re-fetch.
   * Optimized to use batch updates instead of sequential N+1 pattern.
   */
  private async getCartWithSyncedPrices(
    userId: string,
  ): Promise<CartWithItems> {
    const cart = await this.getOrCreateActiveCart(userId);

    // Identify orphaned items and items needing price updates
    const orphanedItemIds: string[] = [];
    const priceUpdates: Array<{
      id: string;
      unitPrice: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
    }> = [];

    for (const item of cart.cartItems) {
      if (item.variantId && !item.variant) {
        orphanedItemIds.push(item.id);
        continue;
      }
      if (item.product.isDeleted || !item.product.isActive) {
        orphanedItemIds.push(item.id);
        continue;
      }
      if (item.variant && (item.variant.isDeleted || !item.variant.isActive)) {
        orphanedItemIds.push(item.id);
        continue;
      }

      // Determine live price based on variant-first purchasing model
      const livePrice = item.product.price;

      if (livePrice.toString() !== item.unitPrice.toString()) {
        const totalPrice = livePrice.mul(item.quantity);
        priceUpdates.push({ id: item.id, unitPrice: livePrice, totalPrice });
        // Update in-memory
        item.unitPrice = livePrice;
        item.totalPrice = totalPrice;
      }
    }

    // Batch update prices in parallel
    if (priceUpdates.length > 0) {
      await Promise.all(
        priceUpdates.map((update) =>
          this.prisma.cartItem.update({
            where: { id: update.id },
            data: {
              unitPrice: update.unitPrice,
              totalPrice: update.totalPrice,
            },
          }),
        ),
      );
    }

    // Batch delete orphaned items
    if (orphanedItemIds.length > 0) {
      await this.prisma.cartItem.deleteMany({
        where: { id: { in: orphanedItemIds } },
      });
      this.logger.warn(
        `Removed ${orphanedItemIds.length} orphaned cart item(s) during price sync for cart ${cart.id}`,
      );
      // Remove orphaned items from the in-memory cart
      cart.cartItems = cart.cartItems.filter(
        (ci) => !orphanedItemIds.includes(ci.id),
      );
    }

    return cart;
  }

  private normalizeVariantId(
    variantId: string | undefined | null,
  ): string | null {
    return variantId?.trim() || null;
  }

  private transformOptions(
    options: unknown,
  ): { name: string; value: string }[] {
    if (!options) return [];
    // New DB format: already an array of { name, value, stock? }
    if (Array.isArray(options)) {
      return (options as any[]).map((o) => ({
        name: o.name,
        value: o.value,
      }));
    }
    // Legacy DB format: object { size: "M", color: "Black" }
    if (typeof options === 'object') {
      return Object.entries(options as Record<string, string>).map(
        ([name, value]) => ({ name, value }),
      );
    }
    return [];
  }

  private toResponse(cart: CartWithItems): CartResponseDto {
    const cartItems = cart.cartItems.map((item) => {
      const price = Number(item.unitPrice);
      const product = item.product;

      const inStockQuantity = item.variantId
        ? (item.variant?.stock ?? 0)
        : product.stock;
      const isVariant = !!item.variantId;
      const lowStockQuantity = product.lowStockThreshold;
      const lowStockAlert = inStockQuantity <= lowStockQuantity;

      // Determine category vs subcategory
      const directCategory = product.category
        ? {
            id: product.category.id,
            name: product.category.name,
            slug: product.category.slug,
          }
        : undefined;
      const parentCategory = product.category?.parent
        ? {
            id: product.category.parent.id,
            name: product.category.parent.name,
            slug: product.category.parent.slug,
          }
        : undefined;

      // If the direct category has a parent, it's a subcategory; otherwise it IS the main category
      const category = product.category?.parentId
        ? parentCategory
        : directCategory;
      const subcategory = product.category?.parentId
        ? directCategory
        : undefined;

      return {
        id: item.id,
        cartId: item.cartId,
        productId: item.productId,
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          price: Number(product.price),
          inStockQuantity,
          hasVariants: product.hasVariants,
          description: product.description ?? undefined,
          isActive: product.isActive,
          isVariant,
          lowStockAlert,
          lowStockQuantity,
          hasDiscount: false,
          discountDetails: null,
          imageUrl: null,
          images:
            product.images?.map((img) => ({
              url: img.url,
            })) ?? [],
          category,
          subcategory,
          vendor: product.creator
            ? {
                id: product.creator.id,
                name: product.creator.storeName,
              }
            : undefined,
          productAvailability: {
            canAddToCart:
              product.isActive && !product.isDeleted && inStockQuantity > 0,
            isAvailable: product.isActive && !product.isDeleted,
            sku: product.sku,
          },
        },
        variant: item.variant
          ? {
              id: item.variant.id,
              options: this.transformOptions(
                item.variant.options as Record<string, string>,
              ),
              isActive: item.variant.isActive,
              isDeleted: item.variant.isDeleted,
            }
          : null,
        quantity: item.quantity,
        price,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    const subtotal = cartItems.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0,
    );

    const discountAmount = Number(cart.discountAmount);
    const deliveryCharge = Number(cart.deliveryCharge);
    const serviceCharge = Number(cart.serviceCharge);
    const totalAmount =
      subtotal - discountAmount + deliveryCharge + serviceCharge;

    const totalItemCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

    return {
      cart: {
        id: cart.id,
        userId: cart.userId,
        subtotal,
        discountAmount,
        deliveryCharge,
        serviceCharge,
        totalAmount,
        totalItemCount,
        abandonedCartAlerted: cart.abandonedCartAlerted ?? false,
        addedFrom: cart.addedFrom as Record<string, string> | null | undefined,
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt,
        checkedOut: cart.checkedOut,
      },
      cartItems,
    };
  }

  /**
   * Background job to purge abandoned carts older than 30 days.
   * Runs daily at midnight.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeAbandonedCarts() {
    this.logger.log('Starting purge of abandoned carts...');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Actually, let's delete any unchecked cart that hasn't been touched in 30 days
    const totalDeleted = await this.prisma.cart.deleteMany({
      where: {
        checkedOut: false,
        updatedAt: { lte: thirtyDaysAgo },
      },
    });

    this.logger.log(`Purged ${totalDeleted.count} abandoned carts.`);
  }
}
