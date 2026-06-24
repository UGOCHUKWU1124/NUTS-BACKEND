export const QUEUE_NAMES = {
  EMAIL: 'nuts-email',
  ANALYTICS: 'nuts-analytics',
  CART: 'nuts-cart',
  INVENTORY: 'nuts-inventory',
} as const;

export const QUEUE_JOB_NAMES = {
  // ── Email Jobs ─────────────────────────────────────
  EMAIL_SEND: 'email.send',
  EMAIL_ORDER_CONFIRMATION: 'email.order.confirmation',
  EMAIL_ORDER_SHIPPED: 'email.order.shipped',
  EMAIL_ORDER_DELIVERED: 'email.order.delivered',
  EMAIL_NEW_ORDER_CREATOR: 'email.new.order.creator',
  EMAIL_ORDER_CANCELLED: 'email.order.cancelled',
  EMAIL_PAYMENT_CONFIRMED: 'email.payment.confirmed',
  EMAIL_CREATOR_PAYMENT_CONFIRMED: 'email.creator.payment.confirmed',
  EMAIL_PAYMENT_FAILED: 'email.payment.failed',
  EMAIL_REFERRAL_REWARD: 'email.referral.reward',
  EMAIL_WEEKLY_CREATOR_SUMMARY: 'email.weekly.creator.summary',
  EMAIL_ABANDONED_CART_REMINDER: 'email.abandoned.cart.reminder',
  EMAIL_LOW_STOCK_ALERT: 'email.low.stock.alert',

  // ── Analytics Jobs ─────────────────────────────────
  ANALYTICS_TRACK_PRODUCT_VIEW: 'analytics.track.product.view',
  ANALYTICS_TRACK_SEARCH: 'analytics.track.search',
  ANALYTICS_FLUSH_VIEWS: 'analytics.flush.views',
  ANALYTICS_SNAPSHOT: 'analytics.snapshot',

  // ── Cart Jobs ──────────────────────────────────────
  CART_ABANDONED_FIRST_REMINDER: 'cart.abandoned.first.reminder',
  CART_ABANDONED_SECOND_REMINDER: 'cart.abandoned.second.reminder',

  // ── Inventory Jobs ─────────────────────────────────
  INVENTORY_LOW_STOCK_CHECK: 'inventory.low.stock.check',
  INVENTORY_STOCK_RESTORED: 'inventory.stock.restored',
} as const;
