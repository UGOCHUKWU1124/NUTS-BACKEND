import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { UsersService } from 'src/modules/users/users.service';
import { ConfigService } from '@nestjs/config';
import { EmailService } from 'src/modules/infrastructure/mail/email.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '@prisma/client';

const mockPrisma = {
  payment: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  order: {
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  orderStatusHistory: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockUsersService = {
  assertActiveAccount: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'PAYSTACK_SECRET_KEY') return 'sk_test_abc123';
    return undefined;
  }),
  getOrThrow: jest.fn((key: string) => {
    if (key === 'PAYSTACK_SECRET_KEY') return 'sk_test_abc123';
    throw new Error(`Missing env: ${key}`);
  }),
};

const mockEmailService = {
  sendPaymentReceipt: jest.fn(),
  sendOrderConfirmation: jest.fn(),
};

describe('PaymentsService – refund', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UsersService, useValue: mockUsersService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  const makePayment = (overrides = {}) => ({
    id: 'pay_1',
    orderId: 'order_1',
    amount: 5000,
    currency: 'ngn',
    status: PaymentStatus.COMPLETED,
    transactionId: 'txn_abc',
    transactionReference: 'ref_abc',
    paymentMethod: 'paystack',
    paymentLink: null,
    order: {
      id: 'order_1',
      status: OrderStatus.PROCESSING,
    },
    ...overrides,
  });

  it('should throw NotFoundException when payment does not exist', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(null);

    await expect(service.refund('pay_1', 'admin_1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw BadRequestException when payment is not COMPLETED', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(
      makePayment({ status: PaymentStatus.PENDING }),
    );

    await expect(service.refund('pay_1', 'admin_1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException for invalid refund amount (exceeds payment)', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(makePayment());

    await expect(service.refund('pay_1', 'admin_1', 99999)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException for zero or negative refund amount', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(makePayment());

    await expect(service.refund('pay_1', 'admin_1', 0)).rejects.toThrow(
      BadRequestException,
    );
  });
});
