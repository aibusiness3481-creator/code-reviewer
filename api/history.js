const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer': 'return=representation'
  };

  if (req.method === 'POST') {
    const { user_id, main_code, pr_code, result } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const save = await fetch(`${SUPABASE_URL}/rest/v1/history`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id, main_code, pr_code, result })
    }).then(r => r.json());

    // Keep only latest 10 per user
    const all = await fetch(`${SUPABASE_URL}/rest/v1/history?user_id=eq.${user_id}&order=created_at.desc&select=id`, {
      headers
    }).then(r => r.json());

    if (all.length > 10) {
      const toDelete = all.slice(10).map(h => h.id);
      await fetch(`${SUPABASE_URL}/rest/v1/history?id=in.(${toDelete.join(',')})`, {
        method: 'DELETE', headers
      });
    }

    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const history = await fetch(`${SUPABASE_URL}/rest/v1/history?user_id=eq.${user_id}&order=created_at.desc&limit=10`, {
      headers
    }).then(r => r.json());

    return res.status(200).json({ history });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
