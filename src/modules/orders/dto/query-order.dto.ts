import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from 'src/modules/shared/dto/pagination-query.dto';

export class QueryOrderDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Filter by customer user ID' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Search by order number or customer email',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Orders created on or after this date' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  fromDate?: Date;

  @ApiPropertyOptional({ description: 'Orders created on or before this date' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  toDate?: Date;
}
