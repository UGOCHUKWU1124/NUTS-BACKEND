import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatorResponseDto {
  @ApiProperty({ description: 'Unique identifier of the creator' })
  id!: string;

  @ApiProperty({ description: 'Email of the creator' })
  email!: string;

  @ApiProperty({ description: 'First name of the creator' })
  firstName!: string;

  @ApiProperty({ description: 'Last name of the creator' })
  lastName!: string;

  @ApiProperty({ description: 'Display name of the store' })
  storeName!: string;

  @ApiProperty({ description: 'URL-friendly store slug' })
  storeSlug!: string;

  @ApiPropertyOptional({ description: 'URL of the store logo', nullable: true })
  storeLogo?: string | null;

  @ApiPropertyOptional({
    description: 'Description of the store',
    nullable: true,
  })
  storeDescription!: string | null;

  @ApiPropertyOptional({ description: 'Business phone number', nullable: true })
  businessPhone!: string | null;

  @ApiPropertyOptional({ description: 'Business email', nullable: true })
  businessEmail!: string | null;

  @ApiPropertyOptional({
    description: 'URL of the store logo (alias)',
    nullable: true,
  })
  storeLogoUrl!: string | null;

  @ApiPropertyOptional({
    description: 'Alt text for the store logo',
    nullable: true,
  })
  storeLogoAltText!: string | null;

  @ApiPropertyOptional({ description: 'Phone number', nullable: true })
  phone!: string | null;

  @ApiProperty({ description: 'Whether the creator is verified' })
  isVerified!: boolean;

  @ApiPropertyOptional({ description: 'Whether the creator account is active' })
  isActive!: boolean;

  @ApiPropertyOptional({ description: 'Whether the creator is approved' })
  isApproved!: boolean;

  @ApiProperty({ description: 'Timestamp when the creator registered' })
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when the creator was last updated',
  })
  updatedAt!: Date;
}

/** @deprecated Use CreatorResponseDto instead */
export { CreatorResponseDto as CreatorProfileDto };
