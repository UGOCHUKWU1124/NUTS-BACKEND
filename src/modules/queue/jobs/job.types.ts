import { QueueJobData } from 'src/modules/shared/interfaces/queue.interface';

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
  items: { productName: string; quantity: number; price: number }[];
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
  items: { productName: string; quantity: number; price: number }[];
  totalAmount: number;
  currency: string;
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
