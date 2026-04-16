import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyWebhook, EventName, type PaddleEnv } from '../_shared/paddle.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const env = (url.searchParams.get('env') || 'sandbox') as PaddleEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log('Received event:', event.eventType, 'env:', env);

    switch (event.eventType) {
      case EventName.SubscriptionCreated:
        await handleSubscriptionCreated(event.data, env);
        break;
      case EventName.SubscriptionUpdated:
        await handleSubscriptionUpdated(event.data, env);
        break;
      case EventName.SubscriptionCanceled:
        await handleSubscriptionCanceled(event.data, env);
        break;
      case EventName.TransactionCompleted:
        console.log('Transaction completed:', event.data.id, 'env:', env);
        break;
      case EventName.TransactionPaymentFailed:
        await handlePaymentFailed(event.data, env);
        break;
      default:
        console.log('Unhandled event:', event.eventType);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Webhook error:', e);
    return new Response('Webhook error', { status: 400 });
  }
});

const planMap: Record<string, string> = {
  starter_plan: 'starter',
  pro_plan: 'pro',
  business_plan: 'business',
};

async function findOrgId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  return data?.organization_id ?? null;
}

async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData } = data;

  const userId = customData?.userId;
  if (!userId) {
    console.error('No userId in customData');
    return;
  }

  const item = items[0];
  const priceId = item.price.importMeta?.externalId || item.price.id;
  const productId = item.product.importMeta?.externalId || item.product.id;

  await supabase.from('subscriptions').upsert({
    user_id: userId,
    paddle_subscription_id: id,
    paddle_customer_id: customerId,
    product_id: productId,
    price_id: priceId,
    status,
    current_period_start: currentBillingPeriod?.startsAt,
    current_period_end: currentBillingPeriod?.endsAt,
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,environment' });

  const plan = planMap[productId] || 'starter';
  const orgId = await findOrgId(userId);
  if (orgId) {
    await supabase
      .from('organizations')
      .update({ plan, is_active: true, payment_status: 'active' })
      .eq('id', orgId);
  }
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange, items } = data;

  await supabase.from('subscriptions')
    .update({
      status,
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      cancel_at_period_end: scheduledChange?.action === 'cancel',
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', id)
    .eq('environment', env);

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('paddle_subscription_id', id)
    .eq('environment', env)
    .maybeSingle();

  if (!sub) return;
  const orgId = await findOrgId(sub.user_id);
  if (!orgId) return;

  // Plan change (upgrade/downgrade)
  const item = items?.[0];
  const productId = item?.product?.importMeta?.externalId || item?.product?.id;
  const newPlan = productId ? planMap[productId] : null;

  const paymentStatus =
    status === 'past_due' ? 'past_due'
    : scheduledChange?.action === 'cancel' ? 'canceled_grace'
    : 'active';

  const update: Record<string, any> = { payment_status: paymentStatus };
  if (newPlan && status === 'active') update.plan = newPlan;

  await supabase.from('organizations').update(update).eq('id', orgId);
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  const { id, currentBillingPeriod } = data;

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('paddle_subscription_id', id)
    .eq('environment', env)
    .maybeSingle();

  await supabase.from('subscriptions')
    .update({
      status: 'canceled',
      current_period_end: currentBillingPeriod?.endsAt,
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', id)
    .eq('environment', env);

  // Revert org plan to free (access continues until period end via frontend check)
  if (sub) {
    const orgId = await findOrgId(sub.user_id);
    if (orgId) {
      await supabase
        .from('organizations')
        .update({ payment_status: 'canceled_grace' })
        .eq('id', orgId);
    }
  }
}

async function handlePaymentFailed(data: any, env: PaddleEnv) {
  console.log('Payment failed:', data.id, 'env:', env);
  const subId = data.subscriptionId;
  if (!subId) return;

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('paddle_subscription_id', subId)
    .eq('environment', env)
    .maybeSingle();

  if (!sub) return;
  const orgId = await findOrgId(sub.user_id);
  if (orgId) {
    await supabase
      .from('organizations')
      .update({ payment_status: 'past_due' })
      .eq('id', orgId);
  }
}
