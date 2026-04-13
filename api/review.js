export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code, lang, mode } = req.body;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  const teachExtra = mode === 'teach' ? ',"explanation":"plain English explanation of all issues and why they matter, 3-5 sentences"' : '';
  const prompt = `You are an expert code reviewer. Review the following ${lang === 'Auto-detect' ? '' : lang} code and respond ONLY with a JSON object (no markdown, no backticks):
{"bugs":"1-2 sentences or No bugs found.","security":"1-2 sentences or No security issues.","performance":"1-2 sentences or Looks good.","fixed":"full corrected code"${teachExtra},"scores":{"bugs":"good|warn|bad","security":"good|warn|bad","performance":"good|warn|bad"}}
Code:
\`\`\`
${code}
\`\`\``;

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    const text = data.content.map(i => i.text || '').join('');
    const result = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
