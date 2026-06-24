import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreatorJwtAuthGuard } from '../guards/creator-auth.guard';
import { AuthStrategy } from 'src/modules/shared/decorators/auth-strategy.decorator';
import { GetCreator } from 'src/modules/shared/decorators/get-creator.decorator';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { WalletService } from 'src/modules/wallet/wallet.service';
import { CreatorWalletResponseDto } from '../dto/creator-wallet-response.dto';
import { WalletTransactionResponseDto } from 'src/modules/wallet/dto/wallet-transaction-response.dto';
import {
  ApiResponseDto,
  PaginationMetaDto,
} from 'src/modules/shared/dto/api-response.dto';

@ApiTags('CREATOR - WALLET')
@Controller('creators/wallet')
@AuthStrategy('creator-jwt')
@UseGuards(CreatorJwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CreatorWalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @Message('Wallet retrieved successfully')
  @ApiOperation({
    summary: 'Get creator wallet',
    description:
      'Returns the authenticated creator wallet balance, pending balance, lifetime earnings, and last 20 wallet transactions ordered by creation date descending.',
  })
  @ApiOkResponse({
    type: ApiResponseDto<CreatorWalletResponseDto>,
    description:
      'Creator wallet with balance, pending, lifetime earnings, and transactions',
  })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async getWallet(
    @GetCreator('id') creatorId: string,
  ): Promise<CreatorWalletResponseDto> {
    return this.walletService.getCreatorWalletWithTransactions(creatorId, 20);
  }

  @Get('transactions')
  @Message('Transactions retrieved successfully')
  @ApiOperation({
    summary: 'Get creator wallet transactions',
    description:
      'Returns paginated transaction history for the authenticated creator wallet.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 20, max: 100)',
    example: 20,
  })
  @ApiOkResponse({
    type: ApiResponseDto<WalletTransactionResponseDto[]>,
    description: 'Paginated wallet transactions',
  })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async getTransactions(
    @GetCreator('id') creatorId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{
    data: WalletTransactionResponseDto[];
    meta: PaginationMetaDto;
  }> {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);

    const result =
      await this.walletService.getCreatorWalletTransactionsPaginated(
        creatorId,
        safePage,
        safeLimit,
      );

    return result;
  }
}
