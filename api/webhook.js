// /api/webhook.js
// Stripe webhook handler for payment events

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Vercel serverless functions need raw body for webhook signature verification
// Set this in vercel.json: "functions": { "api/webhook.js": { "maxDuration": 10 } }

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    // For Vercel, the body comes pre-parsed. We need the raw body.
    // Vercel provides req.body as a Buffer when Content-Type isn't JSON
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log(`✅ Payment succeeded: ${session.id} | ${session.mode} | $${(session.amount_total / 100).toFixed(2)}`);
      // You can add database logging, email notifications, etc. here
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      console.log(`❌ Subscription canceled: ${subscription.id}`);
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      console.log(`🔄 Subscription updated: ${subscription.id} | status: ${subscription.status}`);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log(`⚠️ Payment failed: ${invoice.id} | customer: ${invoice.customer}`);
      break;
    }

    default:
      console.log(`Unhandled event: ${event.type}`);
  }

  res.status(200).json({ received: true });
};
