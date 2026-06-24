import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountCodeType, DiscountCodeScope } from '@prisma/client';

export class DiscountCodeResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the discount code',
    example: 'dc-7a8b9c0d-1e2f-4a3b-8c7d-9e0f1a2b3c4d',
  })
  id!: string;

  @ApiProperty({
    description: 'The discount code string used at checkout',
    example: 'SAVE10',
  })
  code!: string;

  @ApiPropertyOptional({
    description: 'Human-readable description of the discount code terms',
    example: 'Save 10% on your first order',
    nullable: true,
  })
  description?: string | null;

  @ApiProperty({
    description: 'Type of discount: percentage off or fixed amount off',
    enum: DiscountCodeType,
    example: DiscountCodeType.PERCENTAGE,
  })
  type!: DiscountCodeType;

  @ApiProperty({
    description:
      'Discount value: percentage (e.g. 10 for 10%) or fixed amount (e.g. 500)',
    example: 10,
  })
  value!: number;

  @ApiPropertyOptional({
    description: 'Maximum discount amount allowed when type is PERCENTAGE',
    example: 5000,
    nullable: true,
  })
  maxDiscountAmount?: number | null;

  @ApiPropertyOptional({
    description: 'Minimum order amount required for this code to be valid',
    example: 2000,
    nullable: true,
  })
  minOrderAmount?: number | null;

  @ApiPropertyOptional({
    description:
      'Maximum number of times a single user may use this code. Null means unlimited.',
    example: 100,
    nullable: true,
  })
  usageLimit?: number | null;

  @ApiProperty({
    description: 'Number of times this code has been used so far',
    example: 25,
  })
  usageCount!: number;

  @ApiProperty({
    description: 'Whether the discount code is currently active',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description:
      'Whether the code applies platform-wide or is scoped to a specific creator/products',
    example: false,
  })
  platformwide!: boolean;

  @ApiPropertyOptional({
    description: 'Timestamp when the discount code becomes valid',
    example: '2025-06-01T00:00:00.000Z',
    nullable: true,
  })
  startsAt?: Date | null;

  @ApiPropertyOptional({
    description: 'Timestamp when the discount code expires',
    example: '2025-07-01T00:00:00.000Z',
    nullable: true,
  })
  expiresAt?: Date | null;

  @ApiProperty({
    description: 'Scope of the discount code (platform, creator, or product)',
    enum: DiscountCodeScope,
    example: DiscountCodeScope.CREATOR,
  })
  scope!: DiscountCodeScope;

  @ApiProperty({
    description:
      'List of product IDs this code applies to (empty if not product-scoped)',
    type: [String],
    example: ['b5f7c3e1-a2b4-4d6e-8f0a-123456789abc'],
  })
  applicableProductIds!: string[];

  @ApiPropertyOptional({
    description: 'ID of the creator this code belongs to, if creator-scoped',
    example: 'cr-1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
    nullable: true,
  })
  creatorId?: string | null;

  @ApiProperty({
    description: 'Timestamp when the discount code was created',
    example: '2025-05-20T12:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Timestamp when the discount code was last updated',
    example: '2025-05-25T08:30:00.000Z',
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description:
      'Total usage count across all users (alias for usageCount in some contexts)',
    example: 25,
  })
  usages?: number;
}
