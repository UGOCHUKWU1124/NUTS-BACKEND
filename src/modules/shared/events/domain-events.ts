export const DomainEvents = {
  // ── Order Events ──────────────────────────────────────
  ORDER_PROCESSING: 'order.processing',
  ORDER_SHIPPED: 'order.shipped',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',

  // ── Payment Events ────────────────────────────────────
  PAYMENT_CONFIRMED: 'payment.confirmed',
  PAYMENT_FAILED: 'payment.failed',

  // ── Referral Events ───────────────────────────────────
  REFERRAL_REWARD_CREDITED: 'referral.reward.credited',

  // ── Cart Events ───────────────────────────────────────
  CART_ABANDONED: 'cart.abandoned',
  CART_CHECKED_OUT: 'cart.checked_out',

  // ── Tracking Events ──────────────────────────────────
  PRODUCT_VIEWED: 'tracking.product.viewed',
  SEARCH_PERFORMED: 'tracking.search.performed',

  // ── Inventory Events ─────────────────────────────────
  LOW_STOCK_DETECTED: 'inventory.low_stock.detected',
  STOCK_RESTORED: 'inventory.stock.restored',

  // ── Creator Events ──────────────────────────────────
  CREATOR_EARNINGS_CREDITED: 'creator.earnings.credited',
  CREATOR_WEEKLY_SUMMARY: 'creator.weekly.summary',
} as const;

export type DomainEvent = (typeof DomainEvents)[keyof typeof DomainEvents];
