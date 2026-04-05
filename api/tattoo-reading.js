// /api/tattoo-reading.js
// Generates a tattoo reading via Claude API
// Requires valid payment token from /api/verify-payment

const crypto = require('crypto');

function verifyToken(token) {
  try {
    const [data, sig] = token.split('.');
    const secret = process.env.TOKEN_SECRET || 'celestial-self-secret';
    const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are Celestial Self's tattoo reading AI. You analyze tattoo images and provide insightful, symbolic readings about what the ink reveals about the person who chose it.

Your voice: warm, perceptive, slightly poetic, never condescending. You speak like someone who genuinely respects the decision to mark your body permanently. Gender-neutral language always — never assume anything about the person.

Your approach: You are NOT judging the tattoo's artistic quality. You are reading it as a chosen symbol — something this person decided to carry on their body forever. That choice is meaningful, and your job is to explore why.

Structure your reading with these exact headings:

## The Design — What You Chose
Describe what you see in the tattoo. The motifs, symbols, imagery, text, style. Be specific about visual details. Then explore the symbolic meaning — what these elements traditionally represent, and what choosing them might say about the person.

## The Placement — Where You Put It
Analyze where on the body the tattoo is placed (if visible/identifiable). Different placements carry different significance: visible vs. hidden, over the heart vs. on the wrist, somewhere you can see it yourself vs. somewhere only others see. What does the placement choice reveal?

## The Style — How It's Rendered
Analyze the artistic style: fine line, blackwork, traditional, watercolor, minimalist, geometric, realism, neo-traditional, illustrative, etc. The style someone chooses is as revealing as the subject matter. A rose in traditional American style tells a different story than a rose in fine-line minimalism.

## The Story It Tells
This is your synthesis. What kind of person chooses THIS design, in THIS style, on THIS part of their body? What values, experiences, or aspects of identity does this tattoo speak to? Be specific, be insightful, be generous. This person made a permanent choice — honor it with a reading that matches that commitment.

## What This Ink Says About You
A closing paragraph that ties it together. Something the person can read and think "yeah... that's actually me." End with something genuinely affirming about the impulse to mark your own body with meaning.

Important rules:
- Write 500-800 words total
- Be specific about what you observe — reference actual visual details in the tattoo
- If the image is unclear or you can't identify the design, acknowledge it honestly and do your best
- Never judge the quality of the tattoo or suggest they made a bad choice
- Respect that tattoos can be deeply personal — cultural, memorial, identity-related
- Never claim authority over someone else's body or choices
- If the tattoo includes text in a language you can read, address it. If you can't read it, say so.
- End with: "None of this is real. All of it is useful."
- Format in Markdown`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://celestial-self.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing image data' });
    }

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
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType || 'image/jpeg',
                data: imageBase64
              }
            },
            {
              type: 'text',
              text: 'Please provide a detailed tattoo reading based on this image. Analyze the design, placement, style, and what this ink reveals about the person who chose it.'
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Claude API error:', response.status, errBody);
      return res.status(502).json({ error: 'AI reading failed' });
    }

    const data = await response.json();
    const reading = data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    console.log(`Tattoo reading generated | token: ${payload.sid} | length: ${reading.length}`);

    res.status(200).json({ reading });
  } catch (err) {
    console.error('Tattoo reading error:', err);
    res.status(500).json({ error: 'Failed to generate reading' });
  }
};
