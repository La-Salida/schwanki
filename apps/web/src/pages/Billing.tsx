import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { formatPrice, STARTER_CREDITS } from "@schwanki/mnemonic";
import { useAccount } from "@/lib/account";
import { loadBillingHistory, type BillingHistory, type Purchase } from "@/lib/billing";
import { loadCreditsStatus, startCheckout, UNKNOWN_STATUS, type CreditsStatus } from "@/lib/credits";

export default function Billing() {
  const { balance, balanceError, refreshBalance } = useAccount();
  const [status, setStatus] = useState<CreditsStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [history, setHistory] = useState<BillingHistory | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyRetry, setHistoryRetry] = useState<"refresh" | "more">("refresh");
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const checkout = params.get("credits");
  useEffect(() => {
    if (location.hash === "#credit-packs") document.getElementById("credit-packs")?.scrollIntoView({ block: "start" });
  }, [location.key, location.hash]);
  const loadStatus = useCallback(async () => {
    try { setStatus(await loadCreditsStatus()); setStatusError(false); }
    catch { setStatusError(true); }
  }, []);
  const loadHistory = useCallback(async () => {
    try { setHistory(await loadBillingHistory()); setHistoryError(null); }
    catch (failure) { setHistoryError((failure as Error).message); setHistoryRetry("refresh"); }
  }, []);
  // Both loaders synchronize remote data and update state after awaiting the response.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void loadStatus(); void loadHistory(); }, [loadStatus, loadHistory]);
  useEffect(() => {
    if (checkout !== "success") return;
    void refreshBalance();
    const timers = [2000, 5000, 10000].map(ms => setTimeout(() => { void refreshBalance(); void loadHistory(); }, ms));
    return () => timers.forEach(clearTimeout);
  }, [checkout, refreshBalance, loadHistory]);
  async function buy(id: CreditsStatus["packs"][number]["id"]) {
    if (buying) return;
    setBuying(id); setCheckoutError(null);
    try { window.location.assign(await startCheckout(id)); }
    catch (failure) { setCheckoutError((failure as Error).message); setBuying(null); }
  }
  async function more() {
    if (loadingMore || history?.nextOffset == null) return;
    setLoadingMore(true); setHistoryError(null);
    try {
      const next = await loadBillingHistory(history.nextOffset);
      setHistory(current => ({ ...next, purchases: [...(current?.purchases ?? []), ...next.purchases] }));
    } catch (failure) { setHistoryError((failure as Error).message); setHistoryRetry("more"); }
    finally { setLoadingMore(false); }
  }
  async function refreshHistory() {
    if (refreshing || loadingMore) return;
    setRefreshing(true);
    try { await loadHistory(); } finally { setRefreshing(false); }
  }
  return <main id="main-content" className="page-shell space-y-8">
    <header className="page-header"><p className="app-eyebrow">Your account</p><h1>Billing &amp; invoices</h1><p>Buy credits when you need them. Your purchases and payment documents live here.</p></header>
    {checkout === "success" && <p role="status" className="notice">You're back from checkout. Your balance and purchase history will update once payment is confirmed.</p>}
    {checkout === "cancelled" && <p role="status" className="notice">Checkout cancelled. No credits were purchased. <button className="font-bold underline" onClick={() => setParams({}, { replace: true })}>Dismiss</button></p>}
    <section className="paper-panel billing-summary" aria-label="Your credit balance">
      <div><p className="app-eyebrow">Schwanki AI credits</p><p className="billing-balance">{balanceError ? "Unavailable" : balance === null ? "…" : balance.toLocaleString()} <span>credits</span></p><p className="text-sm text-ink/70">Pay as you go · No subscription</p></div>
      <a href="#credit-packs" className="primary-button">Buy credits</a>
      {balanceError && <button onClick={() => void refreshBalance()} className="text-sm font-bold underline">Retry balance</button>}
      <p className="w-full text-sm text-ink/70">New accounts start with {STARTER_CREDITS} free AI credits to try pictures and audio. This is a one-time gift; no payment details needed.</p>
    </section>
    <section className="paper-panel space-y-5" aria-labelledby="history-heading">
      <div><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="history-heading" className="text-2xl font-black">Purchase history</h2><button onClick={() => void refreshHistory()} disabled={refreshing || loadingMore} className="row-button" aria-label="Refresh purchase history">{refreshing ? "Refreshing…" : "Refresh"}</button></div><p className="mt-2 text-sm text-ink/70">Receipts and invoices are provided by Stripe. Older purchases may have a receipt without an invoice.</p></div>
      {!history && !historyError && <p role="status">Loading your purchases…</p>}
      {history?.purchases.length === 0 && <div className="billing-empty"><p className="font-bold">No credit purchases yet.</p><p className="text-sm text-ink/70">Your first purchase will appear here after payment is confirmed.</p></div>}
      {history && !history.billingConfigured && <p className="notice">Payment documents aren't available right now.</p>}
      {history && history.purchases.length > 0 && <ul className="purchase-list">{history.purchases.map(purchase => <PurchaseRow key={purchase.id} purchase={purchase} />)}</ul>}
      {historyError && <p role="alert" className="error-notice">{historyError} <button className="font-bold underline" onClick={() => void (historyRetry === "more" ? more() : loadHistory())}>Retry purchase history</button></p>}
      {history?.nextOffset != null && <button disabled={loadingMore || refreshing} onClick={() => void more()} className="secondary-button">{loadingMore ? "Loading…" : "Load more purchases"}</button>}
    </section>
    <section id="credit-packs" className="space-y-4" aria-labelledby="packs-heading">
      <div><h2 id="packs-heading" className="text-2xl font-black">Buy credits</h2><p className="mt-2 text-sm text-ink/70">Sentences are free. A picture and audio together cost 1 credit; either one alone also costs 1 credit.</p></div>
      <div className="credit-pack-grid">{(status?.packs ?? UNKNOWN_STATUS.packs).map(pack => <div key={pack.id} className="paper-panel credit-pack">
        <p className="app-eyebrow">{pack.label}</p><p className="credit-pack-count">{pack.credits.toLocaleString()} <span>credits</span></p><p className="text-ink/70">{formatPrice(pack.priceCents)} · one-time payment</p>
        <button onClick={() => void buy(pack.id)} disabled={!status?.purchasesEnabled || buying !== null} className="primary-button w-full">{buying === pack.id ? "Opening checkout…" : `Buy for ${formatPrice(pack.priceCents)}`}</button>
      </div>)}</div>
      {!status && !statusError && <p role="status" className="text-sm text-ink/70">Checking credit availability…</p>}
      {status && !status.purchasesEnabled && <p className="notice">Credit purchases aren't available right now. You can still import and review your decks.</p>}
      {statusError && <p role="alert" className="error-notice">Couldn't check credit availability. <button className="font-bold underline" onClick={() => void loadStatus()}>Try again</button></p>}
      {checkoutError && <p role="alert" className="error-notice">{checkoutError}</p>}
      <p className="text-sm text-ink/70">Prices are in USD. Payments are handled by Stripe.</p>
      <p className="text-sm text-ink/70">Using your own AI provider? <Link className="font-bold underline" to="/settings">Manage your keys in AI settings</Link>.</p>
    </section>
  </main>;
}

function PurchaseRow({ purchase }: { purchase: Purchase }) {
  const amount = purchase.amountCents !== null && purchase.currency ? new Intl.NumberFormat(undefined, { style: "currency", currency: purchase.currency.toUpperCase() }).format(purchase.amountCents / 100) : null;
  return <li className="purchase-row"><div><p className="font-bold">{purchase.credits.toLocaleString()} credits</p><p className="text-sm text-ink/70">{new Date(purchase.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}{amount ? ` · ${amount}` : ""}</p></div><div className="purchase-documents">
    {purchase.receiptUrl && <a href={purchase.receiptUrl} target="_blank" rel="noreferrer" className="row-button">Receipt <span aria-hidden="true">↗</span></a>}
    {purchase.invoiceUrl && <a href={purchase.invoiceUrl} target="_blank" rel="noreferrer" className="row-button">Invoice <span aria-hidden="true">↗</span></a>}
    {purchase.invoicePdf && <a href={purchase.invoicePdf} target="_blank" rel="noreferrer" className="row-button">Invoice PDF <span aria-hidden="true">↗</span></a>}
    {!purchase.receiptUrl && !purchase.invoiceUrl && !purchase.invoicePdf && <p className="text-sm text-ink/60">{purchase.documentsUnavailable ? "Documents temporarily unavailable" : "Payment documents aren't ready yet"}</p>}
  </div></li>;
}
