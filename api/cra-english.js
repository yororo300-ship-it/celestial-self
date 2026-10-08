// /api/cra-english.js
// Role-play English conversation practice for clinical research associates (CRA / 臨床開発モニター)
// The model plays an overseas investigator (Dr.) and gives feedback on the CRA's English.

const Anthropic = require('@anthropic-ai/sdk').default;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-opus-5-5';
const MAX_HISTORY = 40;
const MAX_TEXT = 2000;

const BASE_RULES = `You are part of an English-practice app for Japanese clinical research associates (CRAs / clinical monitors) who work with overseas investigators on industry-sponsored clinical trials.

Domain knowledge you must apply accurately: ICH E6 GCP, protocol, informed consent (ICF), source data verification (SDV), source document review (SDR), eCRF/EDC, queries, AE/SAE reporting (investigator reports SAEs to the sponsor within 24 hours of awareness), protocol deviations, inclusion/exclusion criteria, investigational product (IP) accountability and temperature excursions, delegation log, ISF/TMF, site initiation visit (SIV), routine monitoring visit (IMV), close-out visit (COV), IRB/EC, CAPA, recruitment.
Never invent regulatory facts. If a point depends on the specific protocol or local regulation, say so instead of guessing.
The learner is Japanese. All explanations and feedback for the learner are written in natural Japanese; corrected or model English is written in English.`;

const DIFFICULTY = {
  beginner: 'Speak slowly and simply: short sentences, common words, no idioms. Be patient and cooperative. If the CRA is unclear, kindly ask them to clarify.',
  intermediate: 'Speak at a natural professional pace with ordinary medical vocabulary and a few idioms. Be reasonably cooperative but ask follow-up questions and expect clear answers.',
  advanced: 'You are very busy and somewhat impatient. Speak fast and naturally, use idioms and abbreviations, interrupt with sharp questions, push back on findings, and only agree when the CRA explains the GCP rationale clearly and politely.'
};

const REGION = {
  us: 'an American physician (US English)',
  uk: 'a British physician (UK English, British spelling and expressions)',
  de: 'a German physician who speaks fluent but direct, slightly formal English',
  in: 'an Indian physician (Indian English expressions)',
  au: 'an Australian physician (Australian English, casual tone)',
  sg: 'a Singaporean physician (Singapore English, efficient tone)'
};

function personaPrompt(s) {
  return `${BASE_RULES}

## Role-play setup
You play the investigator: Dr. ${s.doctorName}, ${REGION[s.region] || REGION.us}, ${s.doctorRole}.
The learner plays the CRA from the sponsor/CRO.
Situation: ${s.situation}
CRA's goal in this conversation: ${s.goal}
Hidden facts / your stance (reveal naturally only when relevant): ${s.hidden}
Difficulty: ${DIFFICULTY[s.difficulty] || DIFFICULTY.intermediate}

Stay in character as the doctor. Reply like a real conversation: usually 1-4 sentences, no stage directions, no bullet lists, no Japanese in "reply".
React realistically to what the CRA actually said, including vagueness, rudeness or factual GCP errors (question them as a real investigator would).`;
}

function str(v, max = MAX_TEXT) {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function sanitizeScenario(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    doctorName: str(s.doctorName, 60) || 'Smith',
    doctorRole: str(s.doctorRole, 200) || 'principal investigator',
    region: str(s.region, 10),
    situation: str(s.situation, 1500),
    goal: str(s.goal, 800),
    hidden: str(s.hidden, 1500) || 'none',
    difficulty: str(s.difficulty, 20),
    opening: str(s.opening, 500)
  };
}

function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(m => m && (m.role === 'cra' || m.role === 'doctor') && typeof m.text === 'string')
    .slice(-MAX_HISTORY)
    .map(m => ({ role: m.role, text: m.text.slice(0, MAX_TEXT) }));
}

function transcript(history) {
  if (!history.length) return '(no conversation yet)';
  return history.map(m => `${m.role === 'cra' ? 'CRA' : 'Dr.'}: ${m.text}`).join('\n');
}

// Conversation as alternating messages: doctor turns are the assistant, CRA turns are the user.
function toMessages(history, opening) {
  const msgs = [];
  const push = (role, text) => {
    const last = msgs[msgs.length - 1];
    if (last && last.role === role) last.content += '\n' + text;
    else msgs.push({ role, content: text });
  };
  push('user', `(The CRA has just arrived. Start the conversation in character.${opening ? ' Suggested opening line: "' + opening + '"' : ''})`);
  for (const m of history) {
    push(m.role === 'doctor' ? 'assistant' : 'user', m.role === 'doctor' ? JSON.stringify({ reply: m.text }) : `CRA said: ${m.text}`);
  }
  return msgs;
}

const SCHEMAS = {
  start: {
    type: 'object',
    additionalProperties: false,
    required: ['reply', 'reply_ja'],
    properties: {
      reply: { type: 'string' },
      reply_ja: { type: 'string' }
    }
  },
  turn: {
    type: 'object',
    additionalProperties: false,
    required: ['reply', 'reply_ja', 'feedback'],
    properties: {
      reply: { type: 'string' },
      reply_ja: { type: 'string' },
      feedback: {
        type: 'object',
        additionalProperties: false,
        required: ['score', 'corrected', 'better', 'comments_ja', 'gcp_note_ja'],
        properties: {
          score: { type: 'integer' },
          corrected: { type: 'string' },
          better: { type: 'string' },
          comments_ja: { type: 'string' },
          gcp_note_ja: { type: 'string' }
        }
      }
    }
  },
  hint: {
    type: 'object',
    additionalProperties: false,
    required: ['suggestions'],
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['en', 'ja', 'note_ja'],
          properties: {
            en: { type: 'string' },
            ja: { type: 'string' },
            note_ja: { type: 'string' }
          }
        }
      }
    }
  },
  translate: {
    type: 'object',
    additionalProperties: false,
    required: ['options'],
    properties: {
      options: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['en', 'tone_ja'],
          properties: {
            en: { type: 'string' },
            tone_ja: { type: 'string' }
          }
        }
      }
    }
  },
  evaluate: {
    type: 'object',
    additionalProperties: false,
    required: ['scores', 'goal_achieved', 'summary_ja', 'strengths_ja', 'improvements_ja', 'key_phrases'],
    properties: {
      scores: {
        type: 'object',
        additionalProperties: false,
        required: ['clarity', 'grammar', 'professionalism', 'gcp_accuracy', 'goal'],
        properties: {
          clarity: { type: 'integer' },
          grammar: { type: 'integer' },
          professionalism: { type: 'integer' },
          gcp_accuracy: { type: 'integer' },
          goal: { type: 'integer' }
        }
      },
      goal_achieved: { type: 'boolean' },
      summary_ja: { type: 'string' },
      strengths_ja: { type: 'array', items: { type: 'string' } },
      improvements_ja: { type: 'array', items: { type: 'string' } },
      key_phrases: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['en', 'ja'],
          properties: {
            en: { type: 'string' },
            ja: { type: 'string' }
          }
        }
      }
    }
  }
};

const ACTION_INSTRUCTIONS = {
  start: `Output JSON: "reply" = your opening line as the doctor (English), "reply_ja" = its Japanese translation.`,
  turn: `Output JSON:
- "reply": your next line as the doctor (English), responding to the CRA's latest message.
- "reply_ja": Japanese translation of "reply".
- "feedback": evaluation of the CRA's latest message only:
  - "score": 1-5 (5 = clear, accurate, natural and professional).
  - "corrected": the CRA's message with grammar/word-choice errors minimally fixed (same meaning). If it was already correct, repeat it unchanged.
  - "better": a more natural, polite and professional way a skilled CRA would say it to an investigator.
  - "comments_ja": 1-3 short points in Japanese explaining the main corrections or why "better" is better (nuance, politeness, ambiguity). Praise what was good if nothing needs fixing.
  - "gcp_note_ja": Japanese note if the CRA's content was inaccurate or risky from a GCP/monitoring standpoint, or an important point they missed; empty string if none.
If the CRA wrote in Japanese, treat it as what they wanted to say: put the English rendering in "corrected" and "better", and have the doctor respond as if it had been said in English.`,
  hint: `Do not continue the role-play. Suggest 3 different things the CRA could say next to move toward the goal, from simple to more advanced. Output JSON "suggestions": each with "en" (what to say), "ja" (Japanese meaning), "note_ja" (short Japanese tip on when/why to use it).`,
  translate: `Do not continue the role-play. The CRA wants to say the Japanese text given below in English to this doctor, in this context. Output JSON "options": 2-3 English renderings ("en") with "tone_ja" describing in Japanese the nuance/politeness of each (e.g. 丁寧・標準・簡潔).`,
  evaluate: `Do not continue the role-play. Evaluate the CRA's performance across the whole conversation. Output JSON:
- "scores": each 1-10: clarity, grammar, professionalism (politeness/tact with the investigator), gcp_accuracy, goal (progress toward the CRA's goal).
- "goal_achieved": whether the goal was achieved.
- "summary_ja": 2-4 sentence overall comment in Japanese.
- "strengths_ja": 2-4 strengths in Japanese.
- "improvements_ja": 2-4 concrete improvements in Japanese, quoting the CRA's actual wording where useful.
- "key_phrases": 5-8 useful English phrases for this situation with Japanese meanings ("en", "ja").`
};

function parseJSON(response) {
  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');
  return JSON.parse(text);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://celestial-self.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const action = body.action;
    if (!SCHEMAS[action]) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const scenario = sanitizeScenario(body.scenario);
    if (!scenario.situation || !scenario.goal) {
      return res.status(400).json({ error: 'Missing scenario' });
    }
    const history = sanitizeHistory(body.history);
    const text = str(body.text);

    if (action === 'turn' && !history.some(m => m.role === 'cra')) {
      return res.status(400).json({ error: 'Missing CRA message' });
    }
    if (action === 'translate' && !text) {
      return res.status(400).json({ error: 'Missing text' });
    }
    if (action === 'evaluate' && !history.some(m => m.role === 'cra')) {
      return res.status(400).json({ error: 'Conversation is empty' });
    }

    let messages;
    if (action === 'start' || action === 'turn') {
      messages = toMessages(history, scenario.opening);
      messages.push({ role: 'system', content: ACTION_INSTRUCTIONS[action] });
    } else {
      let content = `Conversation so far:\n${transcript(history)}\n\n${ACTION_INSTRUCTIONS[action]}`;
      if (action === 'translate') content += `\n\nJapanese text: ${text}`;
      messages = [{ role: 'user', content }];
    }

    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: SCHEMAS[action] }
      },
      system: personaPrompt(scenario),
      messages
    });

    if (response.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'The AI declined this request. Please rephrase.' });
    }
    if (response.stop_reason === 'max_tokens') {
      return res.status(502).json({ error: 'Response was cut off' });
    }

    const result = parseJSON(response);
    console.log(`CRA English | action: ${action} | turns: ${history.length}`);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      console.error('CRA English rate limited:', err.message);
      return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
    }
    if (err instanceof Anthropic.APIError) {
      console.error('Claude API error:', err.status, err.message);
      return res.status(502).json({ error: 'AI request failed' });
    }
    console.error('CRA English error:', err);
    res.status(500).json({ error: 'Failed to generate response' });
  }
};
