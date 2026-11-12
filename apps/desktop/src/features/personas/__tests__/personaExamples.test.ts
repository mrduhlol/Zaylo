import { describe, it, expect } from 'vitest';
import type { Persona } from '@local-ai/shared';
import { getExamplePrompts, PERSONA_STARTER_TEMPLATES } from '../utils/personaExamples';
import { BUILTIN_PERSONAS } from '@local-ai/inference';

function persona(id: string): Persona {
  return {
    id,
    name: 'Any',
    description: '',
    avatar: '✨',
    systemInstructions: 'x',
    personalityTraits: [],
    communicationStyle: 'Professional',
    behavioralRules: [],
    responseStructure: '',
    isBuiltIn: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('personaExamples', () => {
  it('every built-in persona has curated example prompts', () => {
    for (const builtin of BUILTIN_PERSONAS) {
      const prompts = getExamplePrompts(builtin);
      expect(prompts.length).toBeGreaterThanOrEqual(3);
      prompts.forEach((p) => expect(p.length).toBeGreaterThan(0));
    }
  });

  it('falls back to generic examples for custom personas', () => {
    const prompts = getExamplePrompts(persona('persona_custom_unknown'));
    expect(prompts.length).toBeGreaterThanOrEqual(3);
  });

  it('handles null/undefined personas gracefully', () => {
    expect(getExamplePrompts(null).length).toBeGreaterThan(0);
    expect(getExamplePrompts(undefined).length).toBeGreaterThan(0);
  });

  it('starter templates are complete and usable', () => {
    expect(PERSONA_STARTER_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    for (const template of PERSONA_STARTER_TEMPLATES) {
      expect(template.name.trim().length).toBeGreaterThan(0);
      expect(template.description.trim().length).toBeGreaterThan(0);
      expect(template.systemInstructions.trim().length).toBeGreaterThan(0);
      expect(template.personalityTraits.length).toBeGreaterThan(0);
      expect(template.behavioralRules.length).toBeGreaterThan(0);
      expect(['Professional', 'Casual', 'Technical', 'Concise', 'Detailed', 'Friendly', 'Academic', 'Creative']).toContain(
        template.communicationStyle
      );
    }
    // Unique ids and labels
    expect(new Set(PERSONA_STARTER_TEMPLATES.map((t) => t.id)).size).toBe(PERSONA_STARTER_TEMPLATES.length);
  });
});
