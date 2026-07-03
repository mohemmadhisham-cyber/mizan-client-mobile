import type { BillingPlan, Invoice, PaymentMethodInfo } from './types';

/** Billing & Subscriptions. Fixture-backed (real interface) -- swap to a live
 * query once a client-facing billing/invoices endpoint exists. */

const PLAN: BillingPlan = {
  name: 'Professional',
  status: 'active',
  priceMinor: 14_900,
  currency: 'USD',
  nextPaymentDate: '2023-10-24',
};

const PAYMENT_METHOD: PaymentMethodInfo = { brand: 'VISA', last4: '4242', expiry: '12/25' };

const INVOICES: Invoice[] = [
  { id: 'i1', date: '2023-09-24', amountMinor: 14_900, currency: 'USD' },
  { id: 'i2', date: '2023-08-24', amountMinor: 14_900, currency: 'USD' },
  { id: 'i3', date: '2023-07-24', amountMinor: 14_900, currency: 'USD' },
];

export const billingService = {
  async getPlan(): Promise<BillingPlan> {
    return PLAN;
  },
  async getPaymentMethod(): Promise<PaymentMethodInfo> {
    return PAYMENT_METHOD;
  },
  async getInvoices(): Promise<Invoice[]> {
    return INVOICES;
  },
};
