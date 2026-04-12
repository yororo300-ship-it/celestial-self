// /api/tattoo-compatibility.js
// Generates a tattoo compatibility reading from two tattoo images via Claude API
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

const SYSTEM_PROMPT = `You are Celestial Self's tattoo compatibility AI. You analyze two tattoo images and provide a detailed reading about what these two people's ink choices reveal about their connection.

Your voice: warm, perceptive, slightly poetic, never condescending. You speak like someone who genuinely respects the art of tattooing and the intimacy of comparing ink. Gender-neutral language always — never assume anything about the people or their relationship type. Use "Person A" and "Person B".

Your approach: You are reading two deliberate choices side by side. These people each chose to permanently mark their bodies with something meaningful. What does it mean that THESE two designs exist in relationship with each other?

Structure your reading with these exact headings:

## The Designs — What You Each Chose
Describe both tattoos. What does Person A's ink depict? What does Person B's? Then explore the symbolic conversation between the two designs — where they echo, where they contrast, where they create an unexpected dialogue.

## The Styles — Your Aesthetic Languages
Compare the artistic styles. Are they speaking the same visual language (both minimalist, both traditional) or different ones? What does style alignment or contrast reveal about how these two people express themselves?

## The Placement — Where You Each Carry Your Ink
If visible, compare where the tattoos are placed on the body. Are both visible? Both hidden? One of each? The placement choices reveal how each person relates to being seen — and what happens when those two approaches meet.

## The Conversation Between Your Ink
This is the heart of the reading. If these two tattoos were in a room together, what would they say to each other? What themes connect them? Where do they push against each other? This section should feel like discovering a relationship dynamic through art rather than astrology.

## Where This Is Going
2-3 paragraphs about directions this pairing may naturally lean into, based on what the ink reveals about their current shared tendencies. This is NOT a prediction or fortune-telling about the relationship's future — it's a gentle mapping of openings and inclinations visible in how these two creative choices meet. Use tentative, non-deterministic language like "you two may find yourselves...", "there's an opening in how you...", "the way these designs converse suggests a pull toward...", "the shape of this pairing points softly toward...". Never say "you will" or promise specific outcomes. Do not predict whether the relationship will last, deepen, or end. Frame this as possibilities the ink seems to invite for the two of you together — openings, not outcomes. Open this section with a brief acknowledgment that what follows is about possibility, not prophecy.

## What Your Ink Says About You Two
A closing synthesis. What kind of connection do these two sets of choices suggest? What strengths? What creative tensions? End with something genuinely warm about what it means that two people chose to share their ink with each other.

Important rules:
- Write 850-1200 words total
- Be specific about what you observe in BOTH tattoos — reference actual visual details
- Compare and contrast throughout — don't just read each tattoo separately
- Never judge the quality of either tattoo
- If an image is unclear, acknowledge it and do your best
- Respect that tattoos can be deeply personal
- Never claim authority over someone else's body or choices
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
- overall: holistic compatibility based on everything observed across both tattoos
- design: how the two tattoo designs visually and symbolically complement each other
- emotional_resonance: what each tattoo reveals about emotional depth and how those emotional languages meet
- communication: what the style and placement choices say about how these two people express and share themselves
- shared_values: the underlying themes, priorities, and life philosophies visible in the ink

Scores should be thoughtful, not inflated. Most healthy compatibilities land 65-85. Reserve 90+ for genuinely rare alignment. Never output below 40. Vary the scores meaningfully — do not output the same number for all five.

Output the 5 SCORE lines as the very last thing in your response, after the "None of this is real. All of it is useful." line.`;

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
    const { imageA_base64, imageA_mime, imageB_base64, imageB_mime } = req.body;

    if (!imageA_base64 || !imageB_base64) {
      return res.status(400).json({ error: 'Missing image data for one or both tattoos' });
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
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'This is Person A\'s tattoo:' },
            { type: 'image', source: { type: 'base64', media_type: imageA_mime || 'image/jpeg', data: imageA_base64 } },
            { type: 'text', text: 'This is Person B\'s tattoo:' },
            { type: 'image', source: { type: 'base64', media_type: imageB_mime || 'image/jpeg', data: imageB_base64 } },
            { type: 'text', text: 'Please provide a detailed tattoo compatibility reading. Compare these two tattoos — their designs, styles, placements — and explore what the combination reveals about the connection between these two people.' }
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

    console.log(`Tattoo compatibility reading generated | token: ${payload.sid} | length: ${reading.length}`);

    res.status(200).json({ reading });
  } catch (err) {
    console.error('Tattoo compatibility error:', err);
    res.status(500).json({ error: 'Failed to generate compatibility reading' });
  }
};
