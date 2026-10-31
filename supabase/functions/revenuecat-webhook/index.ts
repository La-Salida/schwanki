import { createClient } from '@supabase/supabase-js';
import { serve } from '../_shared/monitoring.ts';
import { handleRevenueCatWebhook } from './handler.ts';

// RevenueCat's dedicated Authorization header authenticates this public endpoint.
serve('revenuecat-webhook', req => handleRevenueCatWebhook(req, Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '', async event => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await admin.rpc('apply_revenuecat_purchase', event);
  return error;
}));
