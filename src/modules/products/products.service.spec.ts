/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  product: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  category: {
    findUnique: jest.fn(),
  },
};

describe('ProductsService – Products CRUD', () => {
  let service: ProductsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  const mockProduct = {
    id: 'prod-123',
    name: 'Premium Almonds',
    slug: 'premium-almonds',
    description: 'Crispy and fresh',
    price: 2500,
    stock: 100,
    sku: 'ALM-123',
    imageUrl: null,
    isActive: true,
    categoryId: 'cat-456',
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: false,
    deletedAt: null,
  };

  describe('findOne', () => {
    it('should return a product by ID if found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findOne('prod-123');

      expect(result.id).toBe('prod-123');
      expect(result.name).toBe('Premium Almonds');
    });

    it('should throw NotFoundException if product is not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing-prod')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('restore', () => {
    it('should restore a soft-deleted product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        isDeleted: true,
      });
      mockPrisma.product.update.mockResolvedValue(mockProduct);

      const result = await service.restore('prod-123');

      expect(result.isActive).toBe(true);
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prod-123' },
          data: expect.objectContaining({ isDeleted: false }),
        }),
      );
    });
  });
});
