export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  console.log('Request body:', JSON.stringify(req.body));
  console.log('API Key exists:', !!process.env.ANTHROPIC_API_KEY);

  const { code, lang, mode } = req.body;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  const prompt = `You are a senior software engineer reviewing a merge simulation. Analyze the code and respond ONLY with a JSON object (no markdown, no backticks).

STRICT RULES for bugs, security, and performance fields:
- Be specific and concrete. No vague language.
- Format each issue as: "In [filename or 'line X']: [exact problem] will cause [exact consequence]."
- If multiple issues exist, separate with a space. Max 2 issues per field.
- If no issues: write exactly "No issues found."
- Example: "In auth.js line 14: missing null check on user.token will cause a TypeError crash on login."

Respond with this exact structure:
{"bugs":"...","security":"...","performance":"...","fixed":"full corrected code","scores":{"bugs":"good|warn|bad","security":"good|warn|bad","performance":"good|warn|bad"}}

${lang && lang !== 'Auto-detect' ? `Language: ${lang}` : ''}
Code:
\`\`\`
${code}
\`\`\``;

  try {
    console.log('Calling Anthropic API...');
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
    console.log('Anthropic status:', response.status);
    const data = await response.json();
    console.log('Anthropic response:', JSON.stringify(data));
    if (data.error) return res.status(400).json({ error: data.error.message });
    const text = data.content.map(i => i.text || '').join('');
    const result = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.status(200).json(result);
  } catch (e) {
    console.log('Caught error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
