// 成功ページから checkout_id / order_id で購入確認
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { checkoutId, orderId } = req.query;

  try {
    let endpoint;
    if (orderId) endpoint = `https://api.lemonsqueezy.com/v1/orders/${orderId}`;
    else if (checkoutId) endpoint = `https://api.lemonsqueezy.com/v1/checkouts/${checkoutId}`;
    else return res.status(400).json({ error: 'checkoutId or orderId required' });

    const response = await fetch(endpoint, {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
      },
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: 'Verify failed', details: data });

    const attrs = data.data.attributes;
    return res.status(200).json({
      paid: attrs.status === 'paid' || attrs.status === 'active',
      status: attrs.status,
      email: attrs.user_email,
      total: attrs.total_formatted,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
