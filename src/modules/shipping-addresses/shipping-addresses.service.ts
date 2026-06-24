import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { CreateShippingAddressDto } from './dto/create-shipping-address.dto';
import { ShippingAddressResponseDto } from './dto/shipping-address-response.dto';

@Injectable()
export class ShippingAddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<ShippingAddressResponseDto[]> {
    const addresses = await this.prisma.shippingAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    return addresses.map((a) => this.toResponseDto(a));
  }

  async findDefault(userId: string): Promise<ShippingAddressResponseDto> {
    const address = await this.prisma.shippingAddress.findFirst({
      where: { userId, isDefault: true },
    });
    if (!address) {
      throw new NotFoundException(
        'No default shipping address found. Please provide a shipping address at checkout',
      );
    }
    return this.toResponseDto(address);
  }

  async create(
    userId: string,
    dto: CreateShippingAddressDto,
  ): Promise<ShippingAddressResponseDto> {
    const address = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.shippingAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.shippingAddress.create({
        data: {
          userId,
          fullName: dto.fullName,
          phone: dto.phone,
          street: dto.street,
          city: dto.city,
          state: dto.state,
          country: dto.country ?? 'Nigeria',
          isDefault: dto.isDefault ?? false,
        },
      });
    });

    return this.toResponseDto(address);
  }

  async setDefault(
    userId: string,
    addressId: string,
  ): Promise<ShippingAddressResponseDto> {
    const address = await this.prisma.shippingAddress.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException('Shipping address not found');
    }

    if (address.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this shipping address',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.shippingAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });

      return tx.shippingAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
      });
    });

    return this.toResponseDto(updated);
  }

  async remove(userId: string, addressId: string): Promise<void> {
    const address = await this.prisma.shippingAddress.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException('Shipping address not found');
    }

    if (address.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this shipping address',
      );
    }

    if (address.isDefault) {
      throw new BadRequestException(
        'Cannot delete the default shipping address. Set a different address as default first.',
      );
    }

    const count = await this.prisma.shippingAddress.count({
      where: { userId },
    });

    if (count <= 1) {
      throw new BadRequestException(
        'Cannot delete the only shipping address. You must have at least one address.',
      );
    }

    await this.prisma.shippingAddress.delete({
      where: { id: addressId },
    });
  }

  private toResponseDto(a: {
    id: string;
    userId: string;
    fullName: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    country: string;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ShippingAddressResponseDto {
    return {
      id: a.id,
      userId: a.userId,
      fullName: a.fullName,
      phone: a.phone,
      street: a.street,
      city: a.city,
      state: a.state,
      country: a.country,
      isDefault: a.isDefault,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }
}
