import crypto from 'crypto';

const WEBHOOK_SECRET = 'celestial-self-ls-webhook-2026-secret';

// Vercel: bodyParser を無効化して raw body を取る
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['x-signature'];

    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    const digest = hmac.update(rawBody).digest('hex');

    if (!signature || !crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(rawBody.toString());
    const eventName = event.meta?.event_name;
    const custom = event.meta?.custom_data || {};
    const attrs = event.data?.attributes || {};

    switch (eventName) {
      case 'order_created':
        // 単発購入完了 ($2.99)
        await handleOrderCreated({
          orderId: event.data.id,
          email: attrs.user_email,
          userId: custom.user_id,
          product: custom.product,
          status: attrs.status,
        });
        break;

      case 'subscription_created':
      case 'subscription_updated':
        // Unlimited サブスク状態同期
        await handleSubscription({
          subscriptionId: event.data.id,
          email: attrs.user_email,
          userId: custom.user_id,
          status: attrs.status, // active / cancelled / expired など
          renewsAt: attrs.renews_at,
          endsAt: attrs.ends_at,
        });
        break;

      case 'subscription_cancelled':
      case 'subscription_expired':
        await handleSubscriptionEnd({
          subscriptionId: event.data.id,
          userId: custom.user_id,
        });
        break;

      default:
        console.log('Unhandled event:', eventName);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ↓ 既存DB処理に合わせて実装してください
async function handleOrderCreated(data) {
  console.log('Order created:', data);
  // TODO: DBに購入記録、ユーザーに single reading クレジット付与
}

async function handleSubscription(data) {
  console.log('Subscription updated:', data);
  // TODO: ユーザーの unlimited フラグを active かどうかで更新
}

async function handleSubscriptionEnd(data) {
  console.log('Subscription ended:', data);
  // TODO: unlimited フラグを false に
}
