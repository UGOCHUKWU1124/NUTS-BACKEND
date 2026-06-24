import { DomainEvents } from 'src/modules/shared/events/domain-events';

// These event constants map 1:1 to DomainEvents but are provided
// here for the notification module's internal use.
export const NOTIFICATION_EVENTS = {
  ORDER_CONFIRMED: DomainEvents.ORDER_PROCESSING,
  ORDER_SHIPPED: DomainEvents.ORDER_SHIPPED,
  ORDER_DELIVERED: DomainEvents.ORDER_DELIVERED,
  ORDER_CANCELLED: DomainEvents.ORDER_CANCELLED,
  PAYMENT_CONFIRMED: DomainEvents.PAYMENT_CONFIRMED,
  PAYMENT_FAILED: DomainEvents.PAYMENT_FAILED,
  REFERRAL_REWARD_CREDITED: DomainEvents.REFERRAL_REWARD_CREDITED,
} as const;
