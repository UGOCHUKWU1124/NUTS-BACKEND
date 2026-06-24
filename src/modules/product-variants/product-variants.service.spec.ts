import { Test, TestingModule } from '@nestjs/testing';
import { ProductVariantsService } from './product-variants.service';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CacheService } from 'src/modules/infrastructure/cache/cache.service';

const mockPrisma = {
  product: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  productVariant: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('ProductVariantsService', () => {
  let service: ProductVariantsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductVariantsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<ProductVariantsService>(ProductVariantsService);
  });

  const mockProduct = {
    id: 'prod-456',
    name: 'Premium Cashews',
    slug: 'premium-cashews',
    description: 'Premium roasted cashews',
    price: 12000,
    stock: 150,
    sku: 'NUTS-001',
    hasVariants: true,
    isActive: true,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    creator: {
      id: 'creator-123',
      storeName: 'Best Nuts',
    },
    category: {
      id: 'cat-789',
      name: 'Nuts',
      slug: 'nuts',
    },
    images: [{ url: 'https://example.com/image.jpg' }],
  };

  const mockVariant = {
    id: 'var-123',
    options: [{ name: 'size', value: '500g' }],
    stock: 50,
    images: [],
    isActive: true,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    productId: 'prod-456',
    product: {
      id: 'prod-456',
      name: 'Premium Cashews',
      slug: 'premium-cashews',
      hasVariants: true,
      images: [{ url: 'https://example.com/image.jpg' }],
      creator: { id: 'creator-123' },
    },
  };

  describe('create', () => {
    it('should create and return a product variant', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.productVariant.findMany.mockResolvedValue([]);
      mockPrisma.productVariant.create.mockResolvedValue(mockVariant);

      const result = await service.create('prod-456', {
        options: [{ name: 'size', value: '500g' }],
        stock: 50,
      });

      expect(result.id).toBe('var-123');
      expect(result.stock).toBe(50);
      expect(result.options).toHaveLength(1);
      expect(result.options[0]).toEqual({ name: 'size', value: '500g' });
    });

    it('should throw NotFoundException if product does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.create('missing-prod', {
          options: [{ name: 'size', value: '500g' }],
          stock: 50,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all variants for a product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.productVariant.findMany.mockResolvedValue([mockVariant]);

      const result = await service.findAll('prod-456');

      expect(result.product.id).toBe('prod-456');
      expect(result.variants).toHaveLength(1);
      expect(result.variants[0].id).toBe('var-123');
    });
  });

  describe('createForCreator', () => {
    it('should create a variant when the creator owns the product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        creator: { id: 'creator-123' },
      });
      mockPrisma.productVariant.findMany.mockResolvedValue([]);
      mockPrisma.productVariant.create.mockResolvedValue(mockVariant);

      const result = await service.createForCreator('creator-123', 'prod-456', {
        options: [{ name: 'size', value: '500g' }],
        stock: 50,
      });

      expect(result.id).toBe('var-123');
      expect(result.stock).toBe(50);
    });

    it('should throw ForbiddenException when creator does not own product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        creator: { id: 'another-creator' },
      });

      await expect(
        service.createForCreator('creator-123', 'prod-456', {
          options: [{ name: 'size', value: '500g' }],
          stock: 50,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update and return the variant', async () => {
      mockPrisma.productVariant.findFirst.mockResolvedValue(mockVariant);
      mockPrisma.productVariant.findMany.mockResolvedValue([]);
      mockPrisma.productVariant.update.mockResolvedValue({
        ...mockVariant,
        stock: 30,
      });

      const result = await service.update('var-123', {
        stock: 30,
      });

      expect(result.stock).toBe(30);
    });

    it('should throw NotFoundException if variant does not exist', async () => {
      mockPrisma.productVariant.findFirst.mockResolvedValue(null);

      await expect(
        service.update('missing-var', { stock: 30 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
