const SUPABASE_URL = 'https://jppknnixrwzdarrzfvqp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwcGtubml4cnd6ZGFycnpmdnFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MzAzNDcsImV4cCI6MjA5MjIwNjM0N30.FJJw1lU8KUUnsp1vUJcv_jdTKxu6b2ZelyLm3GVn0Z4';
const SB_HEADERS = { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code, lang, user_id } = req.body;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  // Check and enforce usage limit
  if (user_id) {
    const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user_id}&select=usage_count`, { headers: SB_HEADERS });
    const users = await userRes.json();
    if (users.length && users[0].usage_count >= 3) {
      return res.status(403).json({ error: 'Free limit reached' });
    }
  }

  const prompt = `You are Mergly, a merge risk analyzer.
Compare the MAIN BRANCH and PULL REQUEST code below and respond in JSON only with this exact structure:
{"merge_verdict":"","risk_score":0,"summary":"","issues":[{"line":"","issue":"","impact":"","fix":""}],"simulation_report":""}

Rules:
- risk_score 0-20: merge_verdict = "SAFE"
- risk_score 21-40: merge_verdict = "CAUTION"
- risk_score 41-60: merge_verdict = "MODERATE"
- risk_score 61-80: merge_verdict = "DO NOT MERGE"
- risk_score 81-100: merge_verdict = "CRITICAL"
- Focus on runtime errors, undefined variables, logic breaks, security risks
- Be specific: include file name and line number where identifiable
- No extra text. JSON only.

${lang && lang !== 'Auto-detect' ? `Language: ${lang}` : ''}
${code}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    const text = data.content.map(i => i.text || '').join('');
    const result = JSON.parse(text.replace(/```json|```/g, '').trim());

    // Increment usage count
    if (user_id) {
      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user_id}`, {
        method: 'PATCH',
        headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ usage_count: (users?.[0]?.usage_count || 0) + 1 })
      });
    }

    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
