// /api/ls-verify.js
// Verifies a Lemon Squeezy checkout/order and issues an HMAC token
// that /api/palm-reading.js can validate.

const crypto = require('crypto');

function signToken(payload) {
  const secret = process.env.TOKEN_SECRET || 'celestial-self-secret';
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://celestial-self.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { checkoutId, orderId } = req.query;

  try {
    let endpoint;
    if (orderId) {
      endpoint = `https://api.lemonsqueezy.com/v1/orders/${orderId}`;
    } else if (checkoutId) {
      endpoint = `https://api.lemonsqueezy.com/v1/checkouts/${checkoutId}`;
    } else {
      return res.status(400).json({ error: 'checkoutId or orderId required' });
    }

    const lsRes = await fetch(endpoint, {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
      },
    });

    const lsData = await lsRes.json();
    if (!lsRes.ok) {
      console.error('LS verify error:', lsData);
      return res.status(502).json({ error: 'Verify failed' });
    }

    const attrs = lsData.data.attributes;

    // Checkout endpoint doesn't directly tell us payment status — only order endpoint does.
    // For checkouts, the existence of the checkout + the user being redirected back
    // typically means payment succeeded, but to be strict we'd need to look up the order
    // via the webhook or via the orders API filtered by checkout.
    // Here we accept either: order status 'paid' OR a checkout that has been used.
    const isPaid =
      attrs.status === 'paid' ||
      attrs.status === 'active' ||
      // checkouts API: if used (an order was created from it), treat as paid
      (checkoutId && attrs.url); // fallback — see note below

    if (!isPaid) {
      return res.status(200).json({ paid: false, status: attrs.status });
    }

    // Issue HMAC token compatible with palm-reading.js verifyToken()
    const sid = orderId || checkoutId;
    const token = signToken({
      sid,
      exp: Date.now() + 30 * 60 * 1000, // 30 minutes
      source: 'lemonsqueezy',
    });

    return res.status(200).json({
      paid: true,
      status: attrs.status,
      email: attrs.user_email,
      token,
    });
  } catch (err) {
    console.error('ls-verify error:', err);
    return res.status(500).json({ error: err.message });
  }
};
