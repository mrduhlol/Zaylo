import { describe, expect, it } from 'vitest';
import { BUILTIN_PERSONAS } from '@local-ai/inference';
import { MAX_PERSONA_FILE_BYTES, parsePersonaFile, serializePersona } from '../apps/desktop/src/features/personas/personaFiles';

describe('offline persona file boundary', () => {
  it('round-trips instructions without importing identity or protected preset flags', () => {
    const original = BUILTIN_PERSONAS[0];
    const imported = parsePersonaFile(serializePersona(original));
    expect(imported.name).toBe(original.name);
    expect(imported.systemInstructions).toBe(original.systemInstructions);
    expect(imported).not.toHaveProperty('id');
    expect(imported).not.toHaveProperty('isBuiltIn');
    expect(imported).not.toHaveProperty('isDefault');
    expect(imported).not.toHaveProperty('createdAt');
  });
  it('rejects unknown formats and versions before accepting instructions', () => {
    expect(() => parsePersonaFile('{"format":"other","version":1}')).toThrow(/format|version/);
    expect(() => parsePersonaFile(JSON.stringify({ format: 'zaylo-persona', version: 2, persona: BUILTIN_PERSONAS[0] }))).toThrow(/version/);
    expect(() => parsePersonaFile('not JSON')).toThrow(/JSON/);
  });
  it('rejects oversized input and invalid communication styles', () => {
    expect(() => parsePersonaFile(' '.repeat(MAX_PERSONA_FILE_BYTES + 1))).toThrow(/256 KB/);
    const document = JSON.parse(serializePersona(BUILTIN_PERSONAS[0]));
    document.persona.communicationStyle = { run: 'executable input' };
    expect(() => parsePersonaFile(JSON.stringify(document))).toThrow(/invalid/);
  });
  it('does not accept blank instructions or excessive lists', () => {
    const document = JSON.parse(serializePersona(BUILTIN_PERSONAS[0]));
    document.persona.systemInstructions = '   ';
    expect(() => parsePersonaFile(JSON.stringify(document))).toThrow(/limits/);
    document.persona.systemInstructions = 'Help clearly.';
    document.persona.behavioralRules = Array(65).fill('Rule');
    expect(() => parsePersonaFile(JSON.stringify(document))).toThrow(/limits/);
  });
});
