import { ApiProperty } from '@nestjs/swagger';

export class ShippingAddressResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the shipping address',
    example: 'sh-7a8b9c0d-1e2f-4a3b-8c7d-9e0f1a2b3c4d',
  })
  id!: string;

  @ApiProperty({
    description: 'ID of the user who owns this shipping address',
    example: 'usr-a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  userId!: string;

  @ApiProperty({
    description: 'Full name of the recipient',
    example: 'Jane Doe',
  })
  fullName!: string;

  @ApiProperty({
    description: 'Phone number of the recipient',
    example: '+2348012345678',
  })
  phone!: string;

  @ApiProperty({
    description: 'Street address for delivery',
    example: '42 Bourdillon Road, Ikoyi',
  })
  street!: string;

  @ApiProperty({
    description: 'City for delivery',
    example: 'Lagos',
  })
  city!: string;

  @ApiProperty({
    description: 'State or region for delivery',
    example: 'Lagos State',
  })
  state!: string;

  @ApiProperty({
    description: 'Country for delivery',
    example: 'Nigeria',
  })
  country!: string;

  @ApiProperty({
    description: "Whether this is the user's default shipping address",
    example: true,
  })
  isDefault!: boolean;

  @ApiProperty({
    description: 'Timestamp when the shipping address was created',
    example: '2025-04-10T09:15:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Timestamp when the shipping address was last updated',
    example: '2025-06-01T14:20:00.000Z',
  })
  updatedAt!: Date;
}
