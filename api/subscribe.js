const KIT_API_KEY = 'dpE-uwyWSSgKcXkZQyJ-cw';
const RESEND_API_KEY = process.env.Resend_API_Key;
const NOTIFY_EMAIL = 'svetlana.thisisit@gmail.com';

const FORM_IDS = {
  'RadHumans Waitlist': '9593004',
};

async function findOrCreateTag(tagName) {
  const listRes = await fetch(`https://api.convertkit.com/v3/tags?api_key=${KIT_API_KEY}`);
  const listData = await listRes.json();
  const existing = (listData.tags || []).find(t => t.name.toLowerCase() === tagName.toLowerCase());
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
  try {
    const tagId = await findOrCreateTag(tagName);
    if (!tagId) return;
    await fetch(`https://api.convertkit.com/v3/tags/${tagId}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: KIT_API_KEY, email }),
    });
  } catch (err) {
    console.error('Kit tagging error:', err);
  }
}

async function sendNotification(subject, text) {
  if (!RESEND_API_KEY) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: 'onboarding@resend.dev', to: NOTIFY_EMAIL, subject, text }),
    });
  } catch (err) {
    console.error('Resend notification error:', err);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, source, firstName } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const formId = FORM_IDS['RadHumans Waitlist'];

  try {
    const kitRes = await fetch(`https://api.convertkit.com/v3/forms/${formId}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: KIT_API_KEY,
        email,
        first_name: firstName ? firstName.trim().split(' ')[0] : '',
        fields: { source: source || 'RadHumans Waitlist' },
      }),
    });
    const kitData = await kitRes.json();
    if (!kitRes.ok) throw new Error(kitData.message || 'Kit error');

    await tagSubscriber(email, 'RadHumans Waitlist');
    await sendNotification(
      `New RadHumans waitlist signup: ${email}`,
      `Name: ${firstName || '(not provided)'}\nEmail: ${email}\nSource: ${source || 'RadHumans Waitlist'}`
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
