import { describe, it, expect } from 'vitest';
import type { Persona } from '@local-ai/shared';
import {
  PERSONA_EXPORT_FORMAT,
  PERSONA_EXPORT_VERSION,
  MAX_IMPORT_JSON_BYTES,
  buildExportPayload,
  serializePersonaForExport,
  serializePersonaCollectionForExport,
  parsePersonaImport,
  validatePersonaObject,
} from '../utils/personaIO';

function makePersona(overrides: Partial<Persona> = {}): Persona {
  return {
    id: 'persona_custom_test_1',
    name: 'Test Persona',
    description: 'A persona used in tests.',
    avatar: '🧪',
    systemInstructions: 'You are a test persona. Be predictable.',
    personalityTraits: ['Deterministic', 'Brief'],
    communicationStyle: 'Professional',
    responsePreferences: { reasoningStyle: 'Direct', codeFormatting: 'Plain', formatPreference: 'Markdown' },
    behavioralRules: ['Answer in one sentence.', 'Never invent facts.'],
    responseStructure: 'Direct answer.',
    greetingMessage: 'Hello, tester.',
    isBuiltIn: false,
    isDefault: false,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

const roundTrip = (persona: Persona, existingIds: ReadonlySet<string> = new Set()) =>
  parsePersonaImport(serializePersonaForExport(persona), existingIds);

describe('personaIO export', () => {
  it('marks exports with the zaylo-personas format and version', () => {
    const parsed = JSON.parse(serializePersonaForExport(makePersona()));
    expect(parsed.format).toBe(PERSONA_EXPORT_FORMAT);
    expect(parsed.version).toBe(PERSONA_EXPORT_VERSION);
    expect(typeof parsed.exportedAt).toBe('number');
  });

  it('buildExportPayload strips protected flags, ids, and timestamps', () => {
    const payload = buildExportPayload(
      makePersona({ id: 'persona_builtin_general', isBuiltIn: true, isDefault: true })
    );
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('isBuiltIn');
    expect(payload).not.toHaveProperty('isDefault');
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload.systemInstructions).toBeTruthy();
  });

  it('serializes collections with a personas array', () => {
    const parsed = JSON.parse(
      serializePersonaCollectionForExport([makePersona(), makePersona({ name: 'Second' })])
    );
    expect(parsed.personas).toHaveLength(2);
    expect(parsed.format).toBe(PERSONA_EXPORT_FORMAT);
  });
});

describe('personaIO import validation', () => {
  it('round-trips a valid persona without changing meaningful content', () => {
    const persona = makePersona();
    const result = roundTrip(persona);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const imported = result.personas[0];
    expect(imported.name).toBe(persona.name);
    expect(imported.systemInstructions).toBe(persona.systemInstructions);
    expect(imported.communicationStyle).toBe('Professional');
    expect(imported.personalityTraits).toEqual(persona.personalityTraits);
    expect(imported.behavioralRules).toEqual(persona.behavioralRules);
    expect(imported.greetingMessage).toBe('Hello, tester.');
  });

  it('rejects oversized payloads with a size error before parsing', () => {
    const huge = 'x'.repeat(MAX_IMPORT_JSON_BYTES + 1);
    const result = parsePersonaImport(huge, new Set());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('file-too-large');
  });

  it('rejects invalid JSON with invalid-json, never throws', () => {
    const result = parsePersonaImport('{ not json !!', new Set());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('invalid-json');
  });

  it('rejects payloads that are not zaylo-personas exports', () => {
    const result = parsePersonaImport(JSON.stringify({ hello: 'world' }), new Set());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('invalid-format');
  });

  it('rejects empty collections', () => {
    const result = parsePersonaImport(
      JSON.stringify({ format: PERSONA_EXPORT_FORMAT, version: 1, personas: [] }),
      new Set()
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('invalid-format');
  });

  it('imports a single wrapped persona without a personas array', () => {
    const result = roundTrip(makePersona());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.personas).toHaveLength(1);
    }
  });

  it('never trusts isBuiltIn from imported data', () => {
    const evil = {
      format: PERSONA_EXPORT_FORMAT,
      version: 1,
      persona: { ...buildExportPayload(makePersona()), isBuiltIn: true, isDefault: true },
    };
    const result = parsePersonaImport(JSON.stringify(evil), new Set());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.personas[0].isBuiltIn).toBe(false);
      expect(result.personas[0].isDefault).toBe(false);
    }
  });

  it('regenerates ids that collide with existing personas', () => {
    const persona = makePersona({ id: 'persona_collides' });
    const result = roundTrip(persona, new Set(['persona_collides']));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.personas[0].id).not.toBe('persona_collides');
      expect(result.personas[0].id).toMatch(/^persona_custom_/);
    }
  });

  it('falls back to Professional for unknown communication styles', () => {
    const raw = { name: 'X', systemInstructions: 'Y', communicationStyle: 'Sarcastic' };
    const result = validatePersonaObject(raw, new Set());
    expect(result).toHaveProperty('persona');
    if ('persona' in result) {
      expect(result.persona.communicationStyle).toBe('Professional');
    }
  });

  it('truncates oversized strings and arrays defensively', () => {
    const raw = {
      name: 'N'.repeat(500),
      description: 'D'.repeat(5000),
      systemInstructions: 'S'.repeat(50000),
      personalityTraits: Array.from({ length: 50 }, (_, i) => `T${i}`),
      behavioralRules: Array.from({ length: 50 }, (_, i) => `R${i}`.repeat(1000)),
    };
    const result = validatePersonaObject(raw, new Set());
    expect(result).toHaveProperty('persona');
    if ('persona' in result) {
      expect(result.persona.name.length).toBeLessThanOrEqual(80);
      expect(result.persona.description.length).toBeLessThanOrEqual(500);
      expect(result.persona.systemInstructions.length).toBeLessThanOrEqual(20000);
      expect(result.persona.personalityTraits.length).toBeLessThanOrEqual(12);
      expect(result.persona.behavioralRules.length).toBeLessThanOrEqual(20);
      expect(result.persona.behavioralRules[0].length).toBeLessThanOrEqual(500);
    }
  });

  it('reports per-entry problems but keeps valid entries in collections', () => {
    const good = buildExportPayload(makePersona());
    const collection = {
      format: PERSONA_EXPORT_FORMAT,
      version: 1,
      personas: [good, { nope: true }, { name: '', systemInstructions: '' }],
    };
    const result = parsePersonaImport(JSON.stringify(collection), new Set());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.personas).toHaveLength(1);
    }
  });

  it('fails the whole import when no entry is valid', () => {
    const collection = {
      format: PERSONA_EXPORT_FORMAT,
      version: 1,
      personas: [{ nope: true }],
    };
    const result = parsePersonaImport(JSON.stringify(collection), new Set());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('invalid-persona');
  });

  it('requires name and system instructions', () => {
    const result = validatePersonaObject({ name: '', systemInstructions: '   ' }, new Set());
    expect(result).toHaveProperty('problems');
    if ('problems' in result) {
      expect(result.problems.some((p) => p.toLowerCase().includes('name'))).toBe(true);
      expect(result.problems.some((p) => p.toLowerCase().includes('instructions'))).toBe(true);
    }
  });

  it('applies a full collection of many personas preserving order', () => {
    const collection = {
      format: PERSONA_EXPORT_FORMAT,
      version: 1,
      personas: [makePersona({ name: 'A' }), makePersona({ name: 'B' }), makePersona({ name: 'C' })].map(
        buildExportPayload
      ),
    };
    const result = parsePersonaImport(JSON.stringify(collection), new Set());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.personas.map((p) => p.name)).toEqual(['A', 'B', 'C']);
      // All distinct ids
      expect(new Set(result.personas.map((p) => p.id)).size).toBe(3);
    }
  });
});
