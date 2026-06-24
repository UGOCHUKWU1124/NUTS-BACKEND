import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { CacheService } from 'src/modules/infrastructure/cache/cache.service';
import { CreateReviewDto, ReviewResponseDto } from './dto/create-review.dto';

const PRODUCT_REVIEWS_CACHE_PREFIX = 'product:reviews:';

type ReviewWithUser = {
  id: string;
  rating: number;
  comment: string | null;
  productId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    firstName: string | null;
    lastName: string | null;
  };
};

type ReviewDelegate = {
  findUnique: (args: {
    where:
      | { id: string }
      | { userId_productId: { userId: string; productId: string } };
  }) => Promise<{ userId: string; productId: string } | null>;
  create: (args: {
    data: {
      rating: number;
      comment?: string;
      userId: string;
      productId: string;
    };
    include: { user: { select: { firstName: true; lastName: true } } };
  }) => Promise<ReviewWithUser>;
  findMany: (args: {
    where: { productId: string; isActive: true };
    include: { user: { select: { firstName: true; lastName: true } } };
    orderBy: { createdAt: 'desc' };
  }) => Promise<ReviewWithUser[]>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async create(
    userId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const reviewDelegate = (
      this.prisma as unknown as { review: ReviewDelegate }
    ).review;

    // 1. Check if user already reviewed this product
    const existing = await reviewDelegate.findUnique({
      where: {
        userId_productId: { userId, productId: dto.productId },
      },
    });

    if (existing) {
      throw new ConflictException('You have already reviewed this product');
    }

    // 2. Verify purchase (Production Grade: Only allow reviews for DELIVERED orders)
    const purchase = await this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.DELIVERED,
        orderItems: {
          some: { productId: dto.productId },
        },
      },
    });

    if (!purchase) {
      throw new BadRequestException(
        'You can only review products you have purchased and received.',
      );
    }

    const review = await reviewDelegate.create({
      data: {
        rating: dto.rating,
        comment: dto.comment,
        userId,
        productId: dto.productId,
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    // Invalidate cache for this product's reviews
    await this.cacheService.del(
      `${PRODUCT_REVIEWS_CACHE_PREFIX}${dto.productId}`,
    );

    return this.toResponseDto(review);
  }

  async findByProduct(productId: string): Promise<ReviewResponseDto[]> {
    const cacheKey = `${PRODUCT_REVIEWS_CACHE_PREFIX}${productId}`;

    return this.cacheService.wrap(cacheKey, 300, async () => {
      const reviewDelegate = (
        this.prisma as unknown as { review: ReviewDelegate }
      ).review;

      const reviews = await reviewDelegate.findMany({
        where: { productId, isActive: true },
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return reviews.map((r) => this.toResponseDto(r));
    });
  }

  async remove(userId: string, reviewId: string): Promise<void> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { userId: true, productId: true },
    });

    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) {
      throw new BadRequestException('You can only delete your own reviews');
    }

    await this.prisma.review.delete({ where: { id: reviewId } });

    // Invalidate cache for this product's reviews
    await this.cacheService.del(
      `${PRODUCT_REVIEWS_CACHE_PREFIX}${review.productId}`,
    );
  }

  private toResponseDto(review: ReviewWithUser): ReviewResponseDto {
    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      productId: review.productId,
      userId: review.userId,
      userFirstName: review.user?.firstName,
      userLastName: review.user?.lastName,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }
}
