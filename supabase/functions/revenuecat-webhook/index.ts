import { createClient } from '@supabase/supabase-js';
import { serve } from '../_shared/monitoring.ts';
import { handleRevenueCatWebhook } from './handler.ts';

// RevenueCat's dedicated Authorization header authenticates this public endpoint.
serve('revenuecat-webhook', req => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  return handleRevenueCatWebhook(req, Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '', async event => {
    const { error } = await admin.rpc('apply_revenuecat_purchase', event);
    return error;
  }, async userId => {
    const allowed = (Deno.env.get('REVENUECAT_SANDBOX_EMAILS') ?? '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
    if (!allowed.length) return false;
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) { if (error.status === 404) return false; throw error; }
    return Boolean(data.user?.email_confirmed_at && !data.user.is_anonymous
      && allowed.includes(data.user.email?.toLowerCase() ?? ''));
  });
});
