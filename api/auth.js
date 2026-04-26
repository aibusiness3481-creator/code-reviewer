const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  if (action === 'signup') {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ email, password })
    }).then(r => r.json());

    if (r.error) return res.status(400).json({ error: r.error.message });

    // Insert into users table to track usage_count
    await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ id: r.user.id, email: r.user.email, usage_count: 0 })
    });

    return res.status(200).json({ user: { id: r.user.id, email: r.user.email } });
  }

  if (action === 'login') {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ email, password })
    }).then(r => r.json());

    if (r.error) return res.status(401).json({ error: r.error.message });
    return res.status(200).json({ user: { id: r.user.id, email: r.user.email } });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
