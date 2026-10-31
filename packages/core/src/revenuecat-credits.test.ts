import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';

const db = new PGlite();
const user = '10000000-0000-0000-0000-000000000001';
const other = '10000000-0000-0000-0000-000000000002';
beforeAll(async () => {
  await db.exec(`create schema auth; create table auth.users(id uuid primary key);
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.credit_ledger(id uuid default gen_random_uuid(),user_id uuid references auth.users(id),delta integer,reason text,grant_key text,unique(user_id,grant_key));
    insert into auth.users values('${user}'),('${other}');`);
  await db.exec(readFileSync(new URL('../../../supabase/migrations/20261031090000_revenuecat_credit_purchases.sql', import.meta.url), 'utf8'));
}, 30_000);
afterAll(() => db.close());
async function deliver(tx: string, type: string, at: number, owner = user, credits = 100) {
  await db.query('select public.apply_revenuecat_purchase($1,$2,$3,$4,$5,$6,$7)', [tx, owner, 'io.lasalida.schwanki.credits.starter', credits, `${tx}-${type}-${at}`, at, type]);
}
async function credited(tx: string) {
  return (await db.query<{ credited: number }>('select credited from revenuecat_purchases where transaction_id=$1', [tx])).rows[0]!.credited;
}
it('credits repeated deliveries and distinct event IDs for the same transaction only once', async () => {
  await deliver('duplicate', 'NON_RENEWING_PURCHASE', 100);
  await deliver('duplicate', 'NON_RENEWING_PURCHASE', 100);
  await deliver('duplicate', 'NON_RENEWING_PURCHASE', 200);
  expect(await credited('duplicate')).toBe(100);
  expect((await db.query("select delta from credit_ledger where grant_key like 'revenuecat:duplicate:%'")).rows).toEqual([{ delta: 100 }]);
});
it('applies refunds and reversals once, including late purchase and stale refund notifications', async () => {
  await deliver('refund', 'CANCELLATION', 200);
  await deliver('refund', 'NON_RENEWING_PURCHASE', 100);
  expect(await credited('refund')).toBe(0);
  await deliver('refund', 'REFUND_REVERSED', 300);
  await deliver('refund', 'CANCELLATION', 200);
  expect(await credited('refund')).toBe(100);
  await deliver('refund', 'CANCELLATION', 400);
  expect(await credited('refund')).toBe(0);
});
it('never assigns an existing transaction to a different account', async () => {
  await deliver('owner', 'NON_RENEWING_PURCHASE', 100);
  await expect(deliver('owner', 'NON_RENEWING_PURCHASE', 200, other)).rejects.toThrow('Purchase owner or product mismatch');
  expect(await credited('owner')).toBe(100);
});
it('retains quantity from a delayed purchase before reversing its refund', async () => {
  await deliver('quantity', 'CANCELLATION', 200);
  await deliver('quantity', 'NON_RENEWING_PURCHASE', 100, user, 200);
  expect(await credited('quantity')).toBe(0);
  await deliver('quantity', 'REFUND_REVERSED', 300);
  expect(await credited('quantity')).toBe(200);
  await deliver('late-quantity', 'CANCELLATION', 200);
  await deliver('late-quantity', 'REFUND_REVERSED', 300);
  await deliver('late-quantity', 'NON_RENEWING_PURCHASE', 100, user, 200);
  expect(await credited('late-quantity')).toBe(200);
});
it('rolls back the transaction state when a ledger write fails, allowing a safe retry', async () => {
  await db.exec("alter table credit_ledger add constraint reject_test check(reason <> 'App Store credit purchase') not valid");
  await expect(deliver('rollback', 'NON_RENEWING_PURCHASE', 100)).rejects.toThrow();
  expect((await db.query("select * from revenuecat_purchases where transaction_id='rollback'")).rows).toEqual([]);
  await db.exec('alter table credit_ledger drop constraint reject_test');
  await deliver('rollback', 'NON_RENEWING_PURCHASE', 100);
  expect(await credited('rollback')).toBe(100);
});
it('prevents clients from minting credits through the table or RPC', async () => {
  const rights = (await db.query(`select
    has_function_privilege('authenticated','public.apply_revenuecat_purchase(text,uuid,text,integer,text,bigint,text)','execute') as user_rpc,
    has_function_privilege('anon','public.apply_revenuecat_purchase(text,uuid,text,integer,text,bigint,text)','execute') as anon_rpc,
    has_table_privilege('authenticated','revenuecat_purchases','insert') as user_insert,
    has_function_privilege('service_role','public.apply_revenuecat_purchase(text,uuid,text,integer,text,bigint,text)','execute') as server_rpc`)).rows[0];
  expect(rights).toEqual({ user_rpc: false, anon_rpc: false, user_insert: false, server_rpc: true });
});
