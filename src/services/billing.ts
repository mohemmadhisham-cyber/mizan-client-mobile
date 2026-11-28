import { supabase } from '@/lib/supabase';

import type { BillingPlan, Invoice } from './types';

/** Billing & Subscriptions, read-only for a client_user.
 * Subscriptions are firm-scoped (the accountant's firm pays Mizan, not the
 * individual SME client) -- get_my_firm_billing_summary/get_my_firm_invoices
 * resolve the caller's own firm server-side and expose only safe display
 * fields (no payment method/card data, which this app never shows a client). */

interface BillingSummaryRow {
  firm_name: string;
  plan_name: string | null;
  plan_price_monthly: number | null;
  plan_currency: string | null;
  next_invoice_due: string | null;
}

interface InvoiceRow {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string | null;
  created_at: string;
}

export const billingService = {
  async getPlan(): Promise<BillingPlan | null> {
    const { data, error } = await supabase.rpc('get_my_firm_billing_summary');
    // Thrown, so the screen can say it could not be read: an empty answer would read as "none".
    if (error) throw new Error(error.message);
    if (!data || (data as BillingSummaryRow[]).length === 0) return null;
    const row = (data as BillingSummaryRow[])[0];
    return {
      firmName: row.firm_name,
      planName: row.plan_name,
      priceMinor: Math.round((row.plan_price_monthly ?? 0) * 100),
      currency: (row.plan_currency ?? 'AED') as BillingPlan['currency'],
      nextPaymentDue: row.next_invoice_due,
    };
  },

  async getInvoices(): Promise<Invoice[]> {
    const { data, error } = await supabase.rpc('get_my_firm_invoices');
    // Thrown, so the screen can say it could not be read: an empty answer would read as "none".
    if (error) throw new Error(error.message);
    if (!data) return [];
    return (data as InvoiceRow[]).map((r) => ({
      id: r.id,
      number: r.number,
      date: r.created_at.slice(0, 10),
      status: r.status,
      amountMinor: Math.round(r.amount * 100),
      currency: r.currency as Invoice['currency'],
    }));
  },
};
