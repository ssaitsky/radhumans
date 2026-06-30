import crypto from 'crypto';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const KIT_API_KEY = 'dpE-uwyWSSgKcXkZQyJ-cw';
const RESEND_API_KEY = process.env.Resend_API_Key;
const NOTIFY_EMAIL = 'svetlana.thisisit@gmail.com';

export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => p.split('='))
  );
  const signedPayload = `${parts.t}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return expected === parts.v1;
}

async function findOrCreateTag(tagName) {
  const listRes = await fetch(`https://api.convertkit.com/v3/tags?api_key=${KIT_API_KEY}`);
  const listData = await listRes.json();
  const existing = (listData.tags || []).find((t) => t.name.toLowerCase() === tagName.toLowerCase());
  if (existing) return existing.id;
  const createRes = await fetch('https://api.convertkit.com/v3/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: KIT_API_KEY, tag: { name: tagName } }),
  });
  const createData = await createRes.json();
  return createData.id;
}

async function tagSubscriber(email, tagName) {
  const tagId = await findOrCreateTag(tagName);
  if (!tagId) return;
  await fetch(`https://api.convertkit.com/v3/tags/${tagId}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: KIT_API_KEY, email }),
  });
}

async function sendNotification(subject, text) {
  if (!RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: 'onboarding@resend.dev', to: NOTIFY_EMAIL, subject, text }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const signature = req.headers['stripe-signature'];

  try {
    if (!STRIPE_WEBHOOK_SECRET || !signature || !verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET)) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(rawBody.toString());

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const email = session.customer_details?.email || session.customer_email;
      const amount = (session.amount_total / 100).toFixed(2);

      if (email) {
        await tagSubscriber(email, 'RadHumans First Wave Paid');
        await sendNotification(
          `First Wave purchase: ${email}`,
          `${email} just paid $${amount} for Rad Humans First Wave access.\n\nStripe session: ${session.id}`
        );
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
