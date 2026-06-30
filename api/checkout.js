const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const YOUR_DOMAIN = 'https://radhumans.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'mode': 'payment',
        'allow_promotion_codes': 'true',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': 'Rad Humans Portal — First Wave Access',
        'line_items[0][price_data][product_data][description]': 'Full portal access, $147 instead of $177. Surprise gift unlocks when we go live.',
        'line_items[0][price_data][unit_amount]': '14700',
        'line_items[0][quantity]': '1',
        'success_url': `${YOUR_DOMAIN}/success.html`,
        'cancel_url': `${YOUR_DOMAIN}/#join`,
      }),
    });

    const session = await response.json();
    if (!response.ok) throw new Error(session.error?.message || 'Stripe error');
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
