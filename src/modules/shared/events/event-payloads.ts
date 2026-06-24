export interface OrderProcessingPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  userFirstName: string | null;
  totalAmount: number;
  finalAmount: number;
  currency: string;
  creatorIds: string[];
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    variantOptions?: { name: string; value: string }[];
  }[];
  shippingAddress: string;
}

export interface OrderShippedPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  userFirstName: string | null;
  creatorEmails: { creatorId: string; email: string; storeName: string }[];
  trackingNumber?: string;
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    variantOptions?: { name: string; value: string }[];
  }[];
}

export interface OrderDeliveredPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  userFirstName: string | null;
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    variantOptions?: { name: string; value: string }[];
  }[];
}

export interface OrderCancelledPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  userFirstName: string | null;
  reason?: string;
  refundProcessed: boolean;
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    variantOptions?: { name: string; value: string }[];
  }[];
}

export interface PaymentConfirmedPayload {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  userFirstName: string | null;
  amount: number;
  currency: string;
  paymentReference: string;
}

export interface PaymentFailedPayload {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  userFirstName: string | null;
  reason?: string;
}

export interface ReferralRewardCreditedPayload {
  referralId: string;
  referrerId: string;
  referrerEmail: string;
  referredUserId: string;
  referrerName: string;
  rewardAmount: number;
}

export interface LowStockDetectedPayload {
  productId: string;
  productName: string;
  creatorId: string;
  creatorEmail: string;
  creatorStoreName: string;
  currentStock: number;
  variantId?: string;
  variantName?: string;
}

export interface NewOrderForCreatorPayload {
  orderId: string;
  orderNumber: string;
  creatorId: string;
  creatorEmail: string;
  creatorStoreName: string;
  customerName: string;
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    variantOptions?: { name: string; value: string }[];
  }[];
  totalAmount: number;
  currency: string;
}

export interface CreatorPaymentConfirmedPayload {
  creatorId: string;
  creatorEmail: string;
  creatorStoreName: string;
  amount: number;
  currency: string;
  transactionReference: string;
}

export interface CreatorWeeklySummaryPayload {
  creatorId: string;
  creatorEmail: string;
  creatorStoreName: string;
  ordersCount: number;
  revenue: number;
  pendingBalance: number;
  settledBalance: number;
  bestSellingProducts: { name: string; quantity: number; revenue: number }[];
  weekStart: string;
  weekEnd: string;
}
