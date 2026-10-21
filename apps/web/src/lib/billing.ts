import { supabase } from "./supabase";

export interface Purchase {
  id: string;
  credits: number;
  createdAt: string;
  amountCents: number | null;
  currency: string | null;
  receiptUrl: string | null;
  invoiceUrl: string | null;
  invoicePdf: string | null;
  documentsUnavailable: boolean;
}
export interface BillingHistory { purchases: Purchase[]; nextOffset: number | null; billingConfigured: boolean }
export async function loadBillingHistory(offset = 0): Promise<BillingHistory> {
  const { data, error } = await supabase.functions.invoke("credits", { body: { action: "history", offset } });
  if (error) throw new Error("Purchase history couldn't load. Try again in a moment.");
  return data as BillingHistory;
}
