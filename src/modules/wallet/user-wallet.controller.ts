import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/shared/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/shared/decorators/get-user.decorator';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { WalletService } from './wallet.service';
import { UserWalletResponseDto } from './dto/user-wallet-response.dto';
import { WalletTransactionResponseDto } from './dto/wallet-transaction-response.dto';
import {
  ApiResponseDto,
  PaginationMetaDto,
} from 'src/modules/shared/dto/api-response.dto';

@ApiTags('USER WALLET')
@ApiBearerAuth('JWT-auth')
@Controller('users/wallet')
@UseGuards(JwtAuthGuard)
export class UserWalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @Message('Wallet retrieved successfully')
  @ApiOperation({
    summary: 'Get user wallet',
    description:
      'Returns the authenticated user wallet balance and last 20 wallet transactions ordered by creation date descending.',
  })
  @ApiOkResponse({
    type: ApiResponseDto<UserWalletResponseDto>,
    description: 'User wallet with balance and transactions',
  })
  @ApiNotFoundResponse({ description: 'Wallet not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getWallet(
    @GetUser('id') userId: string,
  ): Promise<UserWalletResponseDto> {
    return this.walletService.getUserWalletWithTransactions(userId, 20);
  }

  @Get('transactions')
  @Message('Transactions retrieved successfully')
  @ApiOperation({
    summary: 'Get user wallet transactions',
    description:
      'Returns paginated transaction history for the authenticated user wallet.',
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
  @ApiNotFoundResponse({ description: 'Wallet not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getTransactions(
    @GetUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{
    data: WalletTransactionResponseDto[];
    meta: PaginationMetaDto;
  }> {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);

    const result = await this.walletService.getUserWalletTransactionsPaginated(
      userId,
      safePage,
      safeLimit,
    );

    return result;
  }
}
