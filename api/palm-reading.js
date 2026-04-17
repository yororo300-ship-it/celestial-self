// /api/palm-reading.js
// Generates a detailed palm reading via Claude API

const SYSTEM_PROMPT = `You are Celestial Self's palm reading AI. You analyze palm images and provide detailed, insightful readings.

Your voice: warm, wise, slightly poetic, but never condescending. You speak like someone who genuinely finds palms fascinating. Gender-neutral language always — never assume anything about the person.

Structure your reading with these sections (use these exact headings):

## The Heart Line
Analyze the heart line — emotional patterns, how they connect with others, what love means to them.

## The Head Line
Analyze the head line — thinking style, decision-making, creativity vs logic.

## The Life Line
Analyze the life line — vitality, life changes, resilience. Clarify that this is NOT about lifespan.

## The Fate Line
If visible, analyze the fate line — career path, sense of purpose, pivotal life moments.

## The Mounts
Read the prominent mounts — Venus (passion), Jupiter (ambition), Moon (imagination), etc.

## Possibilities Ahead
2-3 paragraphs describing directions this person may naturally lean into, based on what the lines reveal about their current tendencies. This is NOT a prediction or fortune-telling — it's a gentle mapping of openings and inclinations. Use tentative, non-deterministic language like "you may find yourself...", "there's an opening in...", "this hand suggests a pull toward...", "the shape of things points softly toward...". Never say "you will" or promise specific events. Frame this as possibilities the palm seems to invite, not a future that's already written. Open this section with a brief acknowledgment that what follows is about possibility, not prophecy.

## The Overall Pattern
A synthesis — how all the lines work together to tell this person's unique story. End with something genuinely encouraging but not generic.

Important rules:
- Write 750-1100 words total
- Be specific about what you observe — reference actual visual details
- If the image is unclear, acknowledge it and do your best
- Never claim medical, predictive, or absolute authority
- In "Possibilities Ahead", stay in the register of possibility — no promises, no timelines, no guarantees
- End with: "None of this is real. All of it is useful."
- Format in Markdown`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://celestial-self.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing image data' });
    }

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
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
              text: 'Please provide a detailed palm reading based on this image. Analyze all visible lines, mounts, and patterns.'
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

    console.log(`Palm reading generated | length: ${reading.length}`);

    res.status(200).json({ reading });
  } catch (err) {
    console.error('Palm reading error:', err);
    res.status(500).json({ error: 'Failed to generate reading' });
  }
};
