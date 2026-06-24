import { ApiPropertyOptional } from '@nestjs/swagger';
import { ROLE } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from 'src/modules/shared/dto/pagination-query.dto';
import { ToBoolean } from 'src/modules/shared/decorators/to-boolean.decorator';

export class QueryUserDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by email, first or last name' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ROLE })
  @IsEnum(ROLE)
  @IsOptional()
  role?: ROLE;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @ToBoolean()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
