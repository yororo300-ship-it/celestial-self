// /api/palm-compatibility.js
// Generates a compatibility reading from two palm images via Claude API
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

const SYSTEM_PROMPT = `You are Celestial Self's palm compatibility AI. You analyze two palm images and provide a detailed relationship compatibility reading based on palmistry.

Your voice: warm, wise, slightly poetic, but never condescending. You speak like someone who genuinely finds palms fascinating. Gender-neutral language always — never assume anything about the people or their relationship type. Use "Person A" and "Person B".

Structure your reading with these exact headings:

## Heart Lines — Emotional Compatibility
Compare both heart lines. How do their emotional patterns interact? Are they similar or complementary? What does this mean for how they connect emotionally?

## Head Lines — Intellectual Harmony
Compare both head lines. Do they think alike, or do they bring different perspectives? How will their thinking styles mesh in daily life and big decisions?

## Life Lines — Energy & Rhythm
Compare both life lines. Do they move through life at the same pace? How do their energy levels and approaches to change complement or challenge each other?

## The Chemistry Between These Hands
What jumps out when you see these two palms side by side? What's the most striking similarity? The most interesting contrast? This is where you describe the "vibe" of the pairing.

## Strengths of This Pairing
What will come naturally to these two? Where do their hands suggest ease and mutual understanding?

## Growth Edges
Where might friction arise? What will require conscious effort? Frame this constructively — challenges as opportunities.

## Where This Is Going
2-3 paragraphs about directions this pairing may naturally lean into, based on what the two palms reveal about their current shared tendencies. This is NOT a prediction or fortune-telling about the relationship's future — it's a gentle mapping of openings and inclinations visible in how these two hands meet. Use tentative, non-deterministic language like "you two may find yourselves...", "there's an opening in how you...", "the way these lines converse suggests a pull toward...", "the shape of this pairing points softly toward...". Never say "you will" or promise specific outcomes. Do not predict whether the relationship will last, deepen, or end. Frame this as possibilities the palms seem to invite for the two of you together — openings, not outcomes. Open this section with a brief acknowledgment that what follows is about possibility, not prophecy.

## The Verdict
A synthesized compatibility reading. Be specific, be warm, be honest. End with something genuinely encouraging.

Important rules:
- Write 850-1200 words total
- Be specific about what you observe in BOTH palms — reference actual visual details
- Compare and contrast throughout — don't just read each palm separately
- If an image is unclear, acknowledge it and do your best
- Never claim medical, predictive, or absolute authority
- In "Where This Is Going", stay in the register of possibility — no promises, no timelines, no predictions about the relationship's future
- Before the closing score lines, include: "None of this is real. All of it is useful."
- Format in Markdown

## Compatibility Scores (REQUIRED)
After the full reading, you MUST output exactly 5 score lines in this EXACT format, one per line, with no extra text, no markdown, no bullets, no headings:

SCORE:overall:<0-100>
SCORE:design:<0-100>
SCORE:emotional_resonance:<0-100>
SCORE:communication:<0-100>
SCORE:shared_values:<0-100>

Scoring guide:
- overall: holistic compatibility based on everything observed
- design: how the line shapes, depths, and structures of the two palms visually and symbolically complement each other
- emotional_resonance: heart line compatibility — emotional patterns and openness
- communication: head line comparison — thinking styles and how they exchange ideas
- shared_values: life line and overall hand character — lifestyle rhythm and core priorities

Scores should be thoughtful, not inflated. Most healthy compatibilities land 65-85. Reserve 90+ for genuinely rare alignment. Never output below 40. Vary the scores meaningfully — do not output the same number for all five.

Output the 5 SCORE lines as the very last thing in your response, after the "None of this is real. All of it is useful." line.`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://celestial-self.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify payment token
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
    const { imageA_base64, imageA_mime, imageB_base64, imageB_mime } = req.body;

    if (!imageA_base64 || !imageB_base64) {
      return res.status(400).json({ error: 'Missing image data for one or both palms' });
    }

    // Call Claude API with both images
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'This is Person A\'s palm:'
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: imageA_mime || 'image/jpeg',
                data: imageA_base64
              }
            },
            {
              type: 'text',
              text: 'This is Person B\'s palm:'
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: imageB_mime || 'image/jpeg',
                data: imageB_base64
              }
            },
            {
              type: 'text',
              text: 'Please provide a detailed palm compatibility reading based on these two palms. Compare their lines, mounts, and patterns to assess their relationship compatibility.'
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

    console.log(`Palm compatibility reading generated | token: ${payload.sid} | length: ${reading.length}`);

    res.status(200).json({ reading });
  } catch (err) {
    console.error('Palm compatibility error:', err);
    res.status(500).json({ error: 'Failed to generate compatibility reading' });
  }
};
