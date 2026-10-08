// /api/cra-english.js
// Role-play English conversation practice for clinical research associates (CRA / 臨床開発モニター)
// The model plays an overseas investigator (Dr.) and gives feedback on the CRA's English.
// lang 'ja': Japanese learners of English; lang 'en': English speakers new to clinical-trial terminology.

const Anthropic = require('@anthropic-ai/sdk').default;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-opus-5-5';
const MAX_HISTORY = 40;
const MAX_TEXT = 2000;

const BASE_RULES = `You are part of a conversation-practice app for clinical research associates (CRAs / clinical monitors) who work with investigators on industry-sponsored clinical trials.

Domain knowledge you must apply accurately: ICH E6 GCP, protocol, informed consent (ICF), source data verification (SDV), source document review (SDR), eCRF/EDC, queries, AE/SAE reporting (investigator reports SAEs to the sponsor within 24 hours of awareness), protocol deviations, inclusion/exclusion criteria, investigational product (IP) accountability and temperature excursions, delegation log, ISF/TMF, site initiation visit (SIV), routine monitoring visit (IMV), close-out visit (COV), IRB/EC, CAPA, recruitment.
Never invent regulatory facts. If a point depends on the specific protocol or local regulation, say so instead of guessing.`;

// Who the learner is decides the explanation language and what feedback focuses on.
const LEARNER = {
  ja: {
    profile: 'The learner is a Japanese CRA whose English is the main challenge. Feedback should cover grammar, word choice, naturalness and politeness, as well as GCP accuracy.',
    lang: 'natural Japanese',
    gloss: 'Japanese translation of "reply"'
  },
  en: {
    profile: 'The learner speaks English well but is new to clinical research, so clinical-trial terminology, abbreviations, GCP concepts and the professional conventions of talking to investigators are the main challenge. Feedback should focus on correct use of terminology, accurate GCP content, precision and professional tact; mention grammar only when it causes ambiguity.',
    lang: 'plain, simple English (avoid jargon in explanations, or define it when used)',
    gloss: 'a plain-English paraphrase of "reply" that a newcomer to clinical research would understand, expanding abbreviations'
  }
};

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

function personaPrompt(s, learner) {
  return `${BASE_RULES}

## Learner
${learner.profile}
All explanations, comments and meanings for the learner are written in ${learner.lang}. Corrected or model CRA lines are always in English.

## Role-play setup
You play the investigator: Dr. ${s.doctorName}, ${REGION[s.region] || REGION.us}, ${s.doctorRole}.
The learner plays the CRA from the sponsor/CRO.
Situation: ${s.situation}
CRA's goal in this conversation: ${s.goal}
Hidden facts / your stance (reveal naturally only when relevant): ${s.hidden}
Difficulty: ${DIFFICULTY[s.difficulty] || DIFFICULTY.intermediate}

Stay in character as the doctor. Reply like a real conversation: usually 1-4 sentences, no stage directions, no bullet lists, English only in "reply".
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

const TERMS = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['term', 'meaning'],
    properties: {
      term: { type: 'string' },
      meaning: { type: 'string' }
    }
  }
};

const PHRASES = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['en', 'meaning'],
    properties: {
      en: { type: 'string' },
      meaning: { type: 'string' }
    }
  }
};

const SCHEMAS = {
  start: {
    type: 'object',
    additionalProperties: false,
    required: ['reply', 'gloss', 'terms'],
    properties: {
      reply: { type: 'string' },
      gloss: { type: 'string' },
      terms: TERMS
    }
  },
  turn: {
    type: 'object',
    additionalProperties: false,
    required: ['reply', 'gloss', 'terms', 'feedback'],
    properties: {
      reply: { type: 'string' },
      gloss: { type: 'string' },
      terms: TERMS,
      feedback: {
        type: 'object',
        additionalProperties: false,
        required: ['score', 'corrected', 'better', 'comments', 'gcp_note'],
        properties: {
          score: { type: 'integer' },
          corrected: { type: 'string' },
          better: { type: 'string' },
          comments: { type: 'string' },
          gcp_note: { type: 'string' }
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
          required: ['en', 'meaning', 'note'],
          properties: {
            en: { type: 'string' },
            meaning: { type: 'string' },
            note: { type: 'string' }
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
          required: ['en', 'tone'],
          properties: {
            en: { type: 'string' },
            tone: { type: 'string' }
          }
        }
      }
    }
  },
  explain: {
    type: 'object',
    additionalProperties: false,
    required: ['explanation', 'in_this_case', 'examples', 'related'],
    properties: {
      explanation: { type: 'string' },
      in_this_case: { type: 'string' },
      examples: { type: 'array', items: { type: 'string' } },
      related: TERMS
    }
  },
  evaluate: {
    type: 'object',
    additionalProperties: false,
    required: ['scores', 'goal_achieved', 'summary', 'strengths', 'improvements', 'key_phrases'],
    properties: {
      scores: {
        type: 'object',
        additionalProperties: false,
        required: ['clarity', 'language', 'professionalism', 'gcp_accuracy', 'goal'],
        properties: {
          clarity: { type: 'integer' },
          language: { type: 'integer' },
          professionalism: { type: 'integer' },
          gcp_accuracy: { type: 'integer' },
          goal: { type: 'integer' }
        }
      },
      goal_achieved: { type: 'boolean' },
      summary: { type: 'string' },
      strengths: { type: 'array', items: { type: 'string' } },
      improvements: { type: 'array', items: { type: 'string' } },
      key_phrases: PHRASES
    }
  }
};

const TERMS_RULE = `"terms": every clinical-trial term, abbreviation or GCP concept that appears in "reply" (e.g. SDV, eCRF, SAE, delegation log), each with a short "meaning" for the learner; empty array if none.`;

function actionInstructions(action, learner) {
  switch (action) {
    case 'start':
      return `Output JSON: "reply" = your opening line as the doctor (English), "gloss" = ${learner.gloss}, ${TERMS_RULE}`;
    case 'turn':
      return `Output JSON:
- "reply": your next line as the doctor (English), responding to the CRA's latest message.
- "gloss": ${learner.gloss}.
- ${TERMS_RULE}
- "feedback": evaluation of the CRA's latest message only:
  - "score": 1-5 (5 = clear, accurate, natural and professional).
  - "corrected": the CRA's message with errors minimally fixed (same meaning), including misused terminology. If it was already correct, repeat it unchanged.
  - "better": how a skilled, experienced CRA would say it to an investigator.
  - "comments": 1-3 short points explaining the main corrections or why "better" is better. Praise what was good if nothing needs fixing.
  - "gcp_note": a note if the CRA's content was inaccurate or risky from a GCP/monitoring standpoint, or an important point they missed; empty string if none.
If the CRA wrote in a language other than English, treat it as what they wanted to say: put the English rendering in "corrected" and "better", and have the doctor respond as if it had been said in English.`;
    case 'hint':
      return `Do not continue the role-play. Suggest 3 different things the CRA could say next to move toward the goal, from simple to more advanced. Output JSON "suggestions": each with "en" (what to say), "meaning" (${learner === LEARNER.ja ? 'its Japanese meaning' : 'what it achieves, explaining any terminology it uses'}), "note" (short tip on when/why to use it).`;
    case 'translate':
      return `Do not continue the role-play. The CRA wants to say the text given below in English to this doctor, in this context. Output JSON "options": 2-3 English renderings ("en") with "tone" describing the nuance/politeness of each (e.g. polite / neutral / concise).`;
    case 'explain':
      return `Do not continue the role-play. The learner asks about the term, abbreviation or phrase given below. Output JSON:
- "explanation": what it means in clinical trials, in simple words (2-4 sentences).
- "in_this_case": how it applies to the current scenario/conversation (1-2 sentences); empty string if not relevant.
- "examples": 2 example sentences a CRA might say to an investigator using it (English).
- "related": 2-4 related terms with short meanings.`;
    case 'evaluate':
      return `Do not continue the role-play. Evaluate the CRA's performance across the whole conversation. Output JSON:
- "scores": each 1-10: clarity, language (${learner === LEARNER.ja ? 'grammar and natural English' : 'correct use of clinical-trial terminology and professional phrasing'}), professionalism (politeness/tact with the investigator), gcp_accuracy, goal (progress toward the CRA's goal).
- "goal_achieved": whether the goal was achieved.
- "summary": 2-4 sentence overall comment.
- "strengths": 2-4 strengths.
- "improvements": 2-4 concrete improvements, quoting the CRA's actual wording where useful.
- "key_phrases": 5-8 useful English phrases for this situation, each with "meaning" (${learner === LEARNER.ja ? 'Japanese meaning' : 'when to use it, defining any terminology'}).`;
  }
}

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
    const text = str(body.text, 500);
    const learner = LEARNER[body.lang] || LEARNER.ja;

    if (action === 'turn' && !history.some(m => m.role === 'cra')) {
      return res.status(400).json({ error: 'Missing CRA message' });
    }
    if ((action === 'translate' || action === 'explain') && !text) {
      return res.status(400).json({ error: 'Missing text' });
    }
    if (action === 'evaluate' && !history.some(m => m.role === 'cra')) {
      return res.status(400).json({ error: 'Conversation is empty' });
    }

    let messages;
    if (action === 'start' || action === 'turn') {
      messages = toMessages(history, scenario.opening);
      messages.push({ role: 'system', content: actionInstructions(action, learner) });
    } else {
      let content = `Conversation so far:\n${transcript(history)}\n\n${actionInstructions(action, learner)}`;
      if (action === 'translate') content += `\n\nText to say: ${text}`;
      if (action === 'explain') content += `\n\nAsked about: ${text}`;
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
      system: personaPrompt(scenario, learner),
      messages
    });

    if (response.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'The AI declined this request. Please rephrase.' });
    }
    if (response.stop_reason === 'max_tokens') {
      return res.status(502).json({ error: 'Response was cut off' });
    }

    const result = parseJSON(response);
    console.log(`CRA English | action: ${action} | lang: ${body.lang === 'en' ? 'en' : 'ja'} | turns: ${history.length}`);
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
