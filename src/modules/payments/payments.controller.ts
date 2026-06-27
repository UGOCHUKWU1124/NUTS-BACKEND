import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from 'src/modules/shared/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/shared/guards/roles.guard';
import { Public } from 'src/modules/shared/decorators/public.decorator';
import { Roles } from 'src/modules/shared/decorators/role.decorator';
import { OtpRequired } from 'src/modules/shared/decorators/otp-required.decorator';
import { ROLE } from '@prisma/client';
import { GetUser } from 'src/modules/shared/decorators/get-user.decorator';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { PAYSTACK_WEBHOOK_SIGNATURE_KEY } from 'src/modules/shared/constants/payment.constants';
import { PaymentsService } from './payments.service';
import { OtpService } from 'src/modules/auth/services/otp.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { RequestPaymentOtpDto } from './dto/request-payment-otp.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import {
  InitializePaymentResponseDto,
  PaystackCallbackQueryDto,
  PaymentResponseDto,
} from './dto/payment-response.dto';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('PAYMENTS')
@Controller('payment')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly otpService: OtpService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('otp/request')
  @ApiBearerAuth('JWT-auth')
  @Message('Payment OTP requested successfully')
  @ApiOperation({
    summary: 'Request OTP before payment',
    description:
      'Sends a one-time verification code to the authenticated user email before payment authorization.',
  })
  @ApiQuery({ type: RequestPaymentOtpDto })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiOkResponse({
    type: ApiResponseDto<null>,
    description: 'Payment OTP requested successfully',
  })
  async requestPaymentOtp(
    @GetUser('id') userId: string,
    @GetUser('email') email: string,
    @Query() query: RequestPaymentOtpDto,
  ): Promise<null> {
    let otpOptions:
      | {
          subject: string;
          orderDetails: string;
        }
      | undefined = undefined;

    if (query.orderId) {
      const paymentContext = await this.paymentsService.getPaymentOtpContext(
        userId,
        query.orderId,
      );
      otpOptions = {
        subject: `Payment OTP for order ${paymentContext.orderNumber}`,
        orderDetails: `Order ${paymentContext.orderNumber} • ${paymentContext.currency} ${paymentContext.amount.toFixed(2)}`,
      };
    }

    await this.otpService.createOtp(email, otpOptions);
    return null;
  }

  @UseGuards(JwtAuthGuard)
  @OtpRequired()
  @Post('initialize')
  @ApiBearerAuth('JWT-auth')
  @Message('Payment initialized successfully')
  @ApiOperation({
    summary: 'Initialize Paystack payment for an order',
    description:
      'Order must belong to you, be unpaid, and have status PENDING. Returns authorization URL to complete payment.',
  })
  @ApiQuery({
    name: 'orderId',
    required: true,
    type: String,
    description: 'Order ID to pay for (must be PENDING with PENDING payment)',
  })
  @ApiBody({ type: InitializePaymentDto })
  @ApiResponse({
    status: 201,
    type: ApiResponseDto<InitializePaymentResponseDto>,
    description: 'Payment initialized with authorization URL',
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({ description: 'Invalid request' })
  @ApiConflictResponse({
    description: 'Payment already completed for this order',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication' })
  initialize(
    @GetUser('id') userId: string,
    @Query('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<InitializePaymentResponseDto> {
    return this.paymentsService.initializeForOrder(userId, orderId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('order/:orderId')
  @ApiBearerAuth('JWT-auth')
  @Message('Payment retrieved successfully')
  @ApiOperation({
    summary: 'Get payment status for your order',
    description:
      'Retrieves the payment details and status for a specific order belonging to the authenticated user.',
  })
  @ApiParam({
    name: 'orderId',
    description: 'Order ID to retrieve payment for',
  })
  @ApiResponse({ status: 200, type: ApiResponseDto<PaymentResponseDto> })
  @ApiNotFoundResponse({ description: 'Payment or order not found' })
  findByOrder(
    @GetUser('id') userId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.findByOrder(userId, orderId);
  }

  @Public()
  @Get('callback')
  @Message('Payment verified successfully')
  @ApiOperation({
    summary: 'Paystack redirect callback (verify payment)',
    description: 'Public endpoint used by Paystack after customer pays.',
  })
  @ApiQuery({ name: 'reference', required: true })
  @ApiResponse({ status: 200, type: ApiResponseDto<PaymentResponseDto> })
  @ApiBadRequestResponse({ description: 'Missing payment reference' })
  verifyCallback(
    @Query() query: PaystackCallbackQueryDto,
  ): Promise<PaymentResponseDto> {
    const reference = query.reference || query.trxref;
    if (!reference) {
      throw new BadRequestException('Missing payment reference');
    }
    return this.paymentsService.verifyByReference(reference);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @Message('Payment webhook processed successfully')
  @ApiOperation({
    summary: 'Paystack webhook (signature verified)',
    description:
      'Receives Paystack payment event notifications. The webhook signature is verified before processing.',
  })
  @ApiBadRequestResponse({
    description: 'Missing webhook body or invalid signature',
  })
  @ApiOkResponse({
    type: ApiResponseDto<null>,
    description: 'Payment webhook processed successfully',
  })
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers(PAYSTACK_WEBHOOK_SIGNATURE_KEY) signature?: string,
  ): Promise<null> {
    const rawBody =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : (req.rawBody?.toString('utf8') ?? '');

    if (!rawBody) {
      throw new BadRequestException('Missing webhook body');
    }

    await this.paymentsService.handleWebhook(rawBody, signature);
    return null;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE.ADMIN)
  @Post('refund')
  @ApiBearerAuth('JWT-auth')
  @Message('Payment refunded successfully')
  @ApiOperation({
    summary: 'Refund a completed payment (admin)',
    description:
      'Initiates a refund for a completed payment. Requires admin privileges.',
  })
  @ApiBody({ type: RefundPaymentDto })
  @ApiResponse({ status: 200, type: ApiResponseDto<PaymentResponseDto> })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  @ApiForbiddenResponse({ description: 'Forbidden. Admin role required.' })
  @ApiBadRequestResponse({ description: 'Invalid refund amount' })
  refund(
    @GetUser('id') adminId: string,
    @Body() body: RefundPaymentDto,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.refund(body.paymentId, adminId, body.amount);
  }
}
