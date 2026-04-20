const SUPABASE_URL = 'https://jppknnixrwzdarrzfvqp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwcGtubml4cnd6ZGFycnpmdnFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MzAzNDcsImV4cCI6MjA5MjIwNjM0N30.FJJw1lU8KUUnsp1vUJcv_jdTKxu6b2ZelyLm3GVn0Z4';

async function query(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  if (action === 'signup') {
    const existing = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    }).then(r => r.json());

    if (existing.length > 0) return res.status(400).json({ error: 'Email already registered' });

    const result = await query('users', { email, password });
    if (result.error) return res.status(400).json({ error: result.error.message });
    return res.status(200).json({ user: { id: result[0].id, email: result[0].email } });
  }

  if (action === 'login') {
    const result = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&password=eq.${encodeURIComponent(password)}&select=id,email`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    }).then(r => r.json());

    if (!result.length) return res.status(401).json({ error: 'Invalid email or password' });
    return res.status(200).json({ user: { id: result[0].id, email: result[0].email } });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
