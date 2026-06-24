import { QueueJobData } from 'src/modules/shared/interfaces/queue.interface';

// ── Shared Email Item Type ────────────────────────────────

export interface EmailOrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variantOptions?: { name: string; value: string }[];
  productImage?: string;
}

// ── Email Job Types ──────────────────────────────────────

export interface EmailSendJobData extends QueueJobData {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64 encoded
    contentType?: string;
  }>;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

export interface OrderConfirmationEmailData extends QueueJobData {
  to: string;
  orderNumber: string;
  customerName: string;
  items: EmailOrderItem[];
  totalAmount: number;
  discountAmount: number;
  discountCode?: string;
  finalAmount: number;
  currency: string;
  shippingAddress: string;
}

export interface NewOrderForCreatorEmailData extends QueueJobData {
  to: string;
  creatorStoreName: string;
  orderNumber: string;
  customerName: string;
  items: EmailOrderItem[];
  totalAmount: number;
  currency: string;
  orderTotalForCreator: number;
}

export interface OrderShippedEmailData extends QueueJobData {
  to: string;
  orderNumber: string;
  customerName: string;
  items: EmailOrderItem[];
  trackingNumber?: string;
  shippingAddress: string;
  currency: string;
}

export interface OrderDeliveredEmailData extends QueueJobData {
  to: string;
  orderNumber: string;
  customerName: string;
  items: EmailOrderItem[];
  currency: string;
}

export interface OrderCancelledEmailData extends QueueJobData {
  to: string;
  orderNumber: string;
  customerName: string;
  items: EmailOrderItem[];
  reason?: string;
  refundProcessed: boolean;
  currency: string;
}

export interface PaymentConfirmedEmailData extends QueueJobData {
  to: string;
  orderNumber: string;
  customerName: string;
  items: EmailOrderItem[];
  amount: number;
  currency: string;
  paymentReference: string;
}

export interface PaymentFailedEmailData extends QueueJobData {
  to: string;
  orderNumber: string;
  customerName: string;
  reason?: string;
}

export interface ReferralRewardEmailData extends QueueJobData {
  to: string;
  referrerName: string;
  rewardAmount: number;
  currency: string;
}

export interface CreatorPaymentConfirmedEmailData extends QueueJobData {
  to: string;
  creatorStoreName: string;
  amount: number;
  currency: string;
  orderNumber: string;
}

export interface WeeklyCreatorSummaryEmailData extends QueueJobData {
  to: string;
  creatorStoreName: string;
  ordersCount: number;
  revenue: number;
  pendingBalance: number;
  settledBalance: number;
  bestSellingProducts: { name: string; quantity: number; revenue: number }[];
  weekStart: string;
  weekEnd: string;
  currency: string;
}

export interface AbandonedCartEmailData extends QueueJobData {
  to: string;
  firstName: string | null;
  cartId: string;
  itemCount: number;
  totalAmount: number;
  currency: string;
  reminderType: 'first' | 'second';
}

export interface LowStockAlertEmailData extends QueueJobData {
  to: string;
  creatorStoreName: string;
  productName: string;
  currentStock: number;
  variantName?: string;
}

// ── Analytics Job Types ──────────────────────────────────

export interface TrackProductViewData extends QueueJobData {
  productId: string;
  userId?: string;
  sessionId?: string;
  timestamp: string;
}

export interface TrackSearchData extends QueueJobData {
  query: string;
  resultsCount: number;
  userId?: string;
  sessionId?: string;
  timestamp: string;
}

// ── Cart Job Types ───────────────────────────────────────

export interface CartReminderJobData extends QueueJobData {
  cartId: string;
  userId: string;
  reminderType: 'first' | 'second';
}

// ── Inventory Job Types ──────────────────────────────────

export interface LowStockCheckJobData extends QueueJobData {
  productId: string;
  creatorId: string;
  currentStock: number;
}
