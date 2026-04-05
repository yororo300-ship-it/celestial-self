// /api/create-checkout.js
// Creates a Stripe Checkout Session for one-time or subscription payment

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://celestial-self.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { mode, imageHash } = req.body;
    // mode: 'one_time' or 'subscription'

    const baseUrl = process.env.SITE_URL || 'https://celestial-self.vercel.app';

    let sessionConfig = {
      payment_method_types: ['card'],
      success_url: `${baseUrl}/palmreading.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/palmreading.html?canceled=true`,
      metadata: {
        imageHash: imageHash || '',
        product: 'palm_reading'
      }
    };

    if (mode === 'subscription') {
      sessionConfig.mode = 'subscription';
      sessionConfig.line_items = [{
        price: process.env.STRIPE_SUBSCRIPTION_PRICE_ID,
        quantity: 1
      }];
    } else {
      sessionConfig.mode = 'payment';
      sessionConfig.line_items = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Detailed Palm Reading',
            description: 'AI-powered deep analysis of your palm lines, mounts, and patterns',
            images: ['https://celestial-self.vercel.app/og-palm.png']
          },
          unit_amount: parseInt(process.env.ONETIME_PRICE_CENTS || '299') // $2.99
        },
        quantity: 1
      }];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
};
