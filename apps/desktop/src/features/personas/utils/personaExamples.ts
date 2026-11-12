/**
 * Small, useful defaults for the persona gallery: curated example prompts per
 * built-in preset and a generic fallback for custom personas. These are
 * presentation-only helpers — they never touch persona instructions or the
 * inference engine.
 */

import type { Persona } from '@local-ai/shared';

const BUILTIN_EXAMPLE_PROMPTS: Record<string, string[]> = {
  persona_general: [
    'Explain quantum computing in simple terms.',
    'Help me plan a productive morning routine.',
    'Summarize the pros and cons of remote work.',
  ],
  persona_developer: [
    'Write a TypeScript function that debounces events.',
    'Review this SQL query for performance problems.',
    'Explain how a hash map works under the hood.',
  ],
  persona_researcher: [
    'Summarize the current evidence on intermittent fasting.',
    'Design an experiment to test a new teaching method.',
    'What are the main criticisms of p-hacking?',
  ],
  persona_writer: [
    'Write a short story opening set in a coastal town.',
    'Rewrite this paragraph to be more concise.',
    'Brainstorm five taglines for a coffee shop.',
  ],
  persona_analyst: [
    'Compare two pricing models in a decision table.',
    'Identify the risks in launching during Q4.',
    'Turn these sales numbers into key takeaways.',
  ],
  persona_code_reviewer: [
    'Review this function for security vulnerabilities.',
    'Suggest a refactor to reduce duplication here.',
    'Check this diff for edge-case failures.',
  ],
};

const GENERIC_EXAMPLE_PROMPTS = [
  'What can you help me with today?',
  'Explain a complex topic in simple terms.',
  'Help me draft a short, clear message.',
];

/** Curated examples for built-ins; sensible generic defaults for customs. */
export function getExamplePrompts(persona: Persona | null | undefined): string[] {
  if (!persona) return GENERIC_EXAMPLE_PROMPTS;
  if (BUILTIN_EXAMPLE_PROMPTS[persona.id]) {
    return BUILTIN_EXAMPLE_PROMPTS[persona.id];
  }
  return GENERIC_EXAMPLE_PROMPTS;
}

/** Starter profiles for quick persona creation. Editable before saving. */
export interface PersonaStarterTemplate {
  id: string;
  label: string;
  emoji: string;
  name: string;
  description: string;
  systemInstructions: string;
  communicationStyle: Persona['communicationStyle'];
  personalityTraits: string[];
  behavioralRules: string[];
}

export const PERSONA_STARTER_TEMPLATES: PersonaStarterTemplate[] = [
  {
    id: 'starter_code_helper',
    label: 'Code helper',
    emoji: '💻',
    name: 'Code Helper',
    description: 'Practical programming help with clear, runnable examples.',
    systemInstructions:
      'You are a pragmatic programming assistant. Give short, correct, runnable examples first, then a brief explanation. Ask for the language and framework if unclear.',
    communicationStyle: 'Technical',
    personalityTraits: ['Practical', 'Clear', 'Concise'],
    behavioralRules: ['Prefer complete runnable snippets over pseudo-code.', 'Keep explanations short and focused.'],
  },
  {
    id: 'starter_summarizer',
    label: 'Note summarizer',
    emoji: '📝',
    name: 'Note Summarizer',
    description: 'Condenses long text and meeting notes into crisp bullet points.',
    systemInstructions:
      'You summarize text faithfully. Produce concise bullet points grouped by theme, keep the original meaning, and never invent details that are not in the source.',
    communicationStyle: 'Concise',
    personalityTraits: ['Faithful', 'Structured', 'Brief'],
    behavioralRules: ['Never add facts not present in the source.', 'Group related points under short headings.'],
  },
  {
    id: 'starter_tutor',
    label: 'Patient tutor',
    emoji: '🎓',
    name: 'Patient Tutor',
    description: 'Explains topics step by step with check-for-understanding questions.',
    systemInstructions:
      'You are a patient tutor. Explain concepts step by step in plain language, use small examples, and finish with one short question to check understanding.',
    communicationStyle: 'Friendly',
    personalityTraits: ['Patient', 'Encouraging', 'Step-by-step'],
    behavioralRules: ['Use everyday language and simple examples.', 'Check understanding before moving on.'],
  },
];
