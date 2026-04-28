const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SB_HEADERS = { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };

// Deterministic verdict engine — overrides whatever Claude returns
function enforceVerdict(risk_score, confidence_score) {
  const r = Math.min(100, Math.max(0, Number(risk_score) || 0));
  const c = Math.min(1, Math.max(0, Number(confidence_score) || 0.5));

  if (r >= 80 || (r > 70 && c > 0.85)) return 'DO_NOT_MERGE';
  if (r >= 50) return 'HIGH_RISK';
  if (r >= 20) return 'CAUTION';
  return 'SAFE';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code, lang, user_id } = req.body;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  // Check and enforce usage limit
  let users = [];
  if (user_id) {
    const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user_id}&select=usage_count`, { headers: SB_HEADERS });
    users = await userRes.json();
    if (users.length && users[0].usage_count >= 3) {
      return res.status(403).json({ error: 'Free limit reached' });
    }
  }

  const prompt = `You are Mergly, a deterministic merge risk analyzer.
Compare the MAIN BRANCH and PULL REQUEST code below and respond in JSON only. No markdown. No extra text.

Required JSON structure:
{"merge_verdict":"","confidence_score":0.0,"risk_score":0,"summary":"","issues":[{"line":"","issue":"","impact":"","fix":""}],"simulation_report":""}

Scoring rules:
- risk_score: integer 0-100 based on severity of issues found
- confidence_score: float 0.0-1.0 representing your confidence in the analysis
- merge_verdict: leave empty — it will be computed server-side
- Focus on: runtime errors, undefined variables, broken logic, security vulnerabilities
- Be specific: reference file name and line number where identifiable
- If no issues found, return empty issues array and risk_score of 0

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

    // Clamp and enforce deterministic verdict — never trust Claude's verdict directly
    result.risk_score = Math.min(100, Math.max(0, Number(result.risk_score) || 0));
    result.confidence_score = Math.min(1, Math.max(0, Number(result.confidence_score) || 0.5));
    result.merge_verdict = enforceVerdict(result.risk_score, result.confidence_score);

    // Increment usage count
    if (user_id) {
      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user_id}`, {
        method: 'PATCH',
        headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ usage_count: (users[0]?.usage_count || 0) + 1 })
      });
    }

    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
