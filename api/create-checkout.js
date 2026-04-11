// Lemon Squeezy チェックアウトセッション作成
const STORE_ID = '342370';
const VARIANTS = {
  single: '31ed6ff5-13bd-4fe3-948b-6bb314b09319', // $2.99 Single Reading
  unlimited: '07ee4b08-ddd6-4942-bf79-ae07ebbfb562', // $4.99/月 Unlimited
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { product, email, userId } = req.body;
    const variantId = VARIANTS[product];
    if (!variantId) return res.status(400).json({ error: 'Invalid product' });

    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              email: email || '',
              custom: { user_id: userId || '', product },
            },
            product_options: {
              redirect_url: `${process.env.SITE_URL}/success?session={checkout_id}`,
            },
          },
          relationships: {
            store: { data: { type: 'stores', id: STORE_ID } },
            variant: { data: { type: 'variants', id: variantId } },
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('LS checkout error:', data);
      return res.status(500).json({ error: 'Checkout creation failed' });
    }

    return res.status(200).json({
      url: data.data.attributes.url,
      checkoutId: data.data.id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
