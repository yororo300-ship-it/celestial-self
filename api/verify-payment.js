// /api/verify-payment.js
// Verifies Stripe Checkout session and returns a signed access token

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');

function createToken(sessionId) {
  const payload = {
    sid: sessionId,
    exp: Date.now() + 1000 * 60 * 30, // 30 min expiry
    product: 'palm_reading'
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = process.env.TOKEN_SECRET || 'celestial-self-secret';
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  try {
    const [data, sig] = token.split('.');
    const secret = process.env.TOKEN_SECRET || 'celestial-self-secret';
    const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://celestial-self.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'Missing session ID' });

    // Retrieve the Checkout Session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Check payment status
    const paid = session.payment_status === 'paid';
    const isSubscription = session.mode === 'subscription';

    // For subscriptions, also check subscription status
    if (isSubscription && session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        return res.status(402).json({ error: 'Subscription not active', paid: false });
      }
    }

    if (!paid) {
      return res.status(402).json({ error: 'Payment not completed', paid: false });
    }

    // Generate access token
    const token = createToken(sessionId);

    res.status(200).json({
      paid: true,
      token,
      mode: session.mode,
      customerEmail: session.customer_details?.email || null
    });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
};

// Export verifyToken for use by other API routes
module.exports.verifyToken = verifyToken;
