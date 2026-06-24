import { Injectable } from '@nestjs/common';

interface OrderConfirmationData {
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

interface NewOrderForCreatorData {
  creatorStoreName: string;
  orderNumber: string;
  customerName: string;
  items: { productName: string; quantity: number; price: number }[];
  totalAmount: number;
  currency: string;
}

interface WeeklySummaryData {
  creatorStoreName: string;
  ordersCount: number;
  revenue: number;
  pendingBalance: number;
  settledBalance: number;
  bestSellingProducts: { name: string; quantity: number; revenue: number }[];
  weekStart: string;
  weekEnd: string;
}

interface AbandonedCartData {
  firstName: string | null;
  itemCount: number;
  totalAmount: number;
  currency: string;
  reminderType: 'first' | 'second';
}

interface LowStockData {
  creatorStoreName: string;
  productName: string;
  currentStock: number;
  variantName?: string;
}

@Injectable()
export class EmailTemplatesService {
  orderConfirmation(data: OrderConfirmationData): string {
    const itemsHtml = data.items
      .map(
        (item) => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#475569">${item.productName}</td>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#475569;text-align:center">${item.quantity}</td>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#475569;text-align:right">${data.currency.toUpperCase()} ${item.price.toFixed(2)}</td>
        </tr>`,
      )
      .join('');

    return this.baseHtml(`
      <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e2e8f0">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:1.5px;color:#7c3aed;text-transform:uppercase">Order confirmation</p>
        <h1 style="margin:0;font-size:28px;color:#111827">Order received!</h1>
      </div>
      <div style="padding-top:24px;color:#475569;line-height:1.7">
        <p>Hello ${data.customerName},</p>
        <p>Your order <strong>#${data.orderNumber}</strong> has been placed successfully.</p>
        <div style="background:#f8fafc;border-radius:16px;padding:20px;margin:18px 0">
          <div style="display:flex;justify-content:space-between;padding:8px 0">
            <span>Order Total</span>
            <strong>${data.currency.toUpperCase()} ${data.finalAmount.toFixed(2)}</strong>
          </div>
          ${
            data.discountAmount > 0
              ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #e2e8f0">
            <span>Discount${data.discountCode ? ` (${data.discountCode})` : ''}</span>
            <strong style="color:#059669">-${data.currency.toUpperCase()} ${data.discountAmount.toFixed(2)}</strong>
          </div>`
              : ''
          }
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #e2e8f0;margin-top:8px">
            <span><strong>Total Paid</strong></span>
            <strong>${data.currency.toUpperCase()} ${data.finalAmount.toFixed(2)}</strong>
          </div>
        </div>
        <p><strong>Shipping to:</strong> ${data.shippingAddress}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:18px">
          <thead>
            <tr style="background:#f8fafc">
              <th style="padding:12px;text-align:left;font-size:13px;text-transform:uppercase;color:#667085">Product</th>
              <th style="padding:12px;text-align:center;font-size:13px;text-transform:uppercase;color:#667085">Qty</th>
              <th style="padding:12px;text-align:right;font-size:13px;text-transform:uppercase;color:#667085">Price</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
      </div>
    `);
  }

  orderShipped(data: {
    orderNumber: string;
    customerName: string;
    trackingNumber?: string;
  }): string {
    return this.baseHtml(`
      <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e2e8f0">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:1.5px;color:#7c3aed;text-transform:uppercase">Shipping update</p>
        <h1 style="margin:0;font-size:28px;color:#111827">Your order has shipped!</h1>
      </div>
      <div style="padding-top:24px;color:#475569;line-height:1.7">
        <p>Hello ${data.customerName},</p>
        <p>Your order <strong>#${data.orderNumber}</strong> is on its way!</p>
        ${
          data.trackingNumber
            ? `<div style="background:#f8fafc;border-radius:16px;padding:20px;margin:18px 0;text-align:center">
          <p style="margin:0;font-size:14px;color:#667085">Tracking Number</p>
          <p style="margin:8px 0 0;font-size:20px;font-weight:700;color:#111827">${data.trackingNumber}</p>
        </div>`
            : ''
        }
        <p>We'll notify you when it's delivered.</p>
      </div>
    `);
  }

  orderDelivered(data: { orderNumber: string; customerName: string }): string {
    return this.baseHtml(`
      <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e2e8f0">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:1.5px;color:#7c3aed;text-transform:uppercase">Delivery confirmed</p>
        <h1 style="margin:0;font-size:28px;color:#111827">Order delivered!</h1>
      </div>
      <div style="padding-top:24px;color:#475569;line-height:1.7">
        <p>Hello ${data.customerName},</p>
        <p>Your order <strong>#${data.orderNumber}</strong> has been delivered. We hope you love your purchase!</p>
        <div style="background:#f8fafc;border-radius:16px;padding:20px;margin:18px 0;text-align:center">
          <p style="margin:0;color:#111827">Love your order? Leave a review and help other shoppers!</p>
        </div>
      </div>
    `);
  }

  newOrderForCreator(data: NewOrderForCreatorData): string {
    const itemsHtml = data.items
      .map(
        (item) =>
          `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${item.productName}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center">${item.quantity}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${data.currency.toUpperCase()} ${item.price.toFixed(2)}</td></tr>`,
      )
      .join('');

    return this.baseHtml(`
      <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e2e8f0">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:1.5px;color:#7c3aed;text-transform:uppercase">New sale</p>
        <h1 style="margin:0;font-size:28px;color:#111827">You've got a new order!</h1>
      </div>
      <div style="padding-top:24px;color:#475569;line-height:1.7">
        <p>Hello ${data.creatorStoreName},</p>
        <p>A new order <strong>#${data.orderNumber}</strong> has been placed by <strong>${data.customerName}</strong>.</p>
        <div style="background:#f8fafc;border-radius:16px;padding:20px;margin:18px 0">
          <div style="display:flex;justify-content:space-between">
            <span>Order Total</span>
            <strong>${data.currency.toUpperCase()} ${data.totalAmount.toFixed(2)}</strong>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-top:12px">
          <thead><tr style="background:#f8fafc"><th style="padding:8px;text-align:left;font-size:13px;color:#667085">Product</th><th style="padding:8px;text-align:center;font-size:13px;color:#667085">Qty</th><th style="padding:8px;text-align:right;font-size:13px;color:#667085">Price</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
      </div>
    `);
  }

  creatorPaymentConfirmed(data: {
    creatorStoreName: string;
    amount: number;
    currency: string;
    transactionReference: string;
  }): string {
    return this.baseHtml(`
      <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e2e8f0">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:1.5px;color:#7c3aed;text-transform:uppercase">Payment confirmed</p>
        <h1 style="margin:0;font-size:28px;color:#111827">Earnings credited!</h1>
      </div>
      <div style="padding-top:24px;color:#475569;line-height:1.7">
        <p>Hello ${data.creatorStoreName},</p>
        <p>Your earnings of <strong>${data.currency.toUpperCase()} ${data.amount.toFixed(2)}</strong> have been credited to your wallet.</p>
        <p>Reference: ${data.transactionReference}</p>
      </div>
    `);
  }

  paymentFailed(data: {
    customerName: string;
    orderNumber: string;
    reason?: string;
  }): string {
    return this.baseHtml(`
      <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e2e8f0">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:1.5px;color:#dc2626;text-transform:uppercase">Payment failed</p>
        <h1 style="margin:0;font-size:28px;color:#111827">Payment unsuccessful</h1>
      </div>
      <div style="padding-top:24px;color:#475569;line-height:1.7">
        <p>Hello ${data.customerName},</p>
        <p>The payment for order <strong>#${data.orderNumber}</strong> could not be processed.</p>
        ${data.reason ? `<p>Reason: ${data.reason}</p>` : ''}
        <p>Please try again or use a different payment method.</p>
      </div>
    `);
  }

  referralRewardCredited(data: {
    referrerName: string;
    rewardAmount: number;
    currency: string;
  }): string {
    return this.baseHtml(`
      <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e2e8f0">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:1.5px;color:#7c3aed;text-transform:uppercase">Reward</p>
        <h1 style="margin:0;font-size:28px;color:#111827">Referral reward credited!</h1>
      </div>
      <div style="padding-top:24px;color:#475569;line-height:1.7">
        <p>Hello ${data.referrerName},</p>
        <p>You've earned a referral reward of <strong>${data.currency.toUpperCase()} ${data.rewardAmount.toFixed(2)}</strong>!</p>
        <p>Keep sharing your referral code to earn more.</p>
      </div>
    `);
  }

  weeklyCreatorSummary(data: WeeklySummaryData): string {
    const productsHtml = data.bestSellingProducts
      .map(
        (p) =>
          `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${p.name}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center">${p.quantity}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${p.revenue.toFixed(2)}</td></tr>`,
      )
      .join('');

    return this.baseHtml(`
      <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e2e8f0">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:1.5px;color:#7c3aed;text-transform:uppercase">Weekly summary</p>
        <h1 style="margin:0;font-size:28px;color:#111827">Your weekly earnings report</h1>
      </div>
      <div style="padding-top:24px;color:#475569;line-height:1.7">
        <p>Hello ${data.creatorStoreName},</p>
        <p>Here's your performance summary for ${data.weekStart} — ${data.weekEnd}.</p>
        <div style="background:#f8fafc;border-radius:16px;padding:20px;margin:18px 0;display:grid;gap:12px">
          <div style="display:flex;justify-content:space-between"><span>Orders</span><strong>${data.ordersCount}</strong></div>
          <div style="display:flex;justify-content:space-between"><span>Revenue</span><strong>₦${data.revenue.toFixed(2)}</strong></div>
          <div style="display:flex;justify-content:space-between"><span>Pending Balance</span><strong>₦${data.pendingBalance.toFixed(2)}</strong></div>
          <div style="display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:12px"><span>Settled Balance</span><strong>₦${data.settledBalance.toFixed(2)}</strong></div>
        </div>
        ${
          data.bestSellingProducts.length
            ? `
          <h3 style="color:#111827;margin:24px 0 12px">Best Selling Products</h3>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr style="background:#f8fafc"><th style="padding:8px;text-align:left;font-size:13px;color:#667085">Product</th><th style="padding:8px;text-align:center;font-size:13px;color:#667085">Sold</th><th style="padding:8px;text-align:right;font-size:13px;color:#667085">Revenue</th></tr></thead>
            <tbody>${productsHtml}</tbody>
          </table>`
            : ''
        }
      </div>
    `);
  }

  abandonedCartReminder(data: AbandonedCartData): string {
    const greeting = data.firstName ? `Hello ${data.firstName}` : 'Hello';
    const message =
      data.reminderType === 'first'
        ? "You left some items in your cart. They're still waiting for you!"
        : 'Your cart is about to expire! Complete your purchase before the items are gone.';

    return this.baseHtml(`
      <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e2e8f0">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:1.5px;color:#7c3aed;text-transform:uppercase">Cart reminder</p>
        <h1 style="margin:0;font-size:28px;color:#111827">You left something behind!</h1>
      </div>
      <div style="padding-top:24px;color:#475569;line-height:1.7">
        <p>${greeting},</p>
        <p>${message}</p>
        <div style="background:#f8fafc;border-radius:16px;padding:20px;margin:18px 0;text-align:center">
          <p style="margin:0 0 8px">You have <strong>${data.itemCount} item${data.itemCount > 1 ? 's' : ''}</strong> in your cart</p>
          <p style="margin:0;font-size:24px;font-weight:700;color:#111827">${data.currency.toUpperCase()} ${data.totalAmount.toFixed(2)}</p>
        </div>
      </div>
    `);
  }

  lowStockAlert(data: LowStockData): string {
    const itemName = data.variantName
      ? `${data.productName} - ${data.variantName}`
      : data.productName;

    return this.baseHtml(`
      <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e2e8f0">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:1.5px;color:#dc2626;text-transform:uppercase">Low stock alert</p>
        <h1 style="margin:0;font-size:28px;color:#111827">Stock running low!</h1>
      </div>
      <div style="padding-top:24px;color:#475569;line-height:1.7">
        <p>Hello ${data.creatorStoreName},</p>
        <p>Your product <strong>${itemName}</strong> is running low on stock.</p>
        <div style="background:#fef2f2;border-radius:16px;padding:20px;margin:18px 0;text-align:center">
          <p style="margin:0;font-size:14px;color:#667085">Current Stock</p>
          <p style="margin:8px 0 0;font-size:32px;font-weight:700;color:#dc2626">${data.currentStock}</p>
        </div>
        <p>Please restock soon to avoid missing out on sales.</p>
      </div>
    `);
  }

  private baseHtml(content: string): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  .container{width:100%;max-width:600px;margin:0 auto;padding:24px;background:#fff;border-radius:20px;box-shadow:0 24px 60px rgba(15,23,42,0.08)}
  .footer{margin-top:30px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center}
</style></head>
<body>
  <div class="container">
    ${content}
    <div class="footer">NUTS E-Commerce — Secure shopping made simple.</div>
  </div>
</body>
</html>`;
  }
}
