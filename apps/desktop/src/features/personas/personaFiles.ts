import { PersonaSchema, type Persona } from '@local-ai/shared';

export const MAX_PERSONA_FILE_BYTES = 256 * 1024;
export type ImportedPersona = Pick<Persona, 'name' | 'description' | 'avatar' | 'systemInstructions' |
  'personalityTraits' | 'communicationStyle' | 'responsePreferences' | 'behavioralRules' |
  'responseStructure' | 'greetingMessage'>;

/** Import instructions as data; imported files cannot replace built-ins or defaults. */
export function parsePersonaFile(text: string): ImportedPersona {
  if (new TextEncoder().encode(text).byteLength > MAX_PERSONA_FILE_BYTES) {
    throw new Error('Persona files must be smaller than 256 KB.');
  }
  let envelope: unknown;
  try { envelope = JSON.parse(text); } catch { throw new Error('Choose a valid persona JSON file.'); }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new Error('This is not a Zaylo persona file.');
  }
  const file = envelope as Record<string, unknown>;
  if (file.format !== 'zaylo-persona' || file.version !== 1) {
    throw new Error('Unsupported persona format or version.');
  }
  const result = PersonaSchema.safeParse(file.persona);
  if (!result.success) throw new Error('The persona is missing required fields or contains invalid values.');
  const p = result.data;
  if (!p.name.trim() || p.name.length > 100 || !p.systemInstructions.trim() || p.systemInstructions.length > 32000 ||
    p.description.length > 2000 || p.personalityTraits.length > 32 || p.behavioralRules.length > 64 ||
    p.personalityTraits.some(v => v.length > 500) || p.behavioralRules.some(v => v.length > 2000)) {
    throw new Error('Persona name, instructions, or lists exceed the supported limits.');
  }
  return {
    name: p.name.trim(), description: p.description, avatar: p.avatar,
    systemInstructions: p.systemInstructions, personalityTraits: p.personalityTraits,
    communicationStyle: p.communicationStyle, responsePreferences: p.responsePreferences,
    behavioralRules: p.behavioralRules, responseStructure: p.responseStructure, greetingMessage: p.greetingMessage,
  };
}

export function serializePersona(persona: Persona): string {
  return JSON.stringify({ format: 'zaylo-persona', version: 1, persona: PersonaSchema.parse(persona) }, null, 2);
}

export function downloadPersona(persona: Persona): void {
  const url = URL.createObjectURL(new Blob([serializePersona(persona)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${persona.name.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 70) || 'persona'}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
