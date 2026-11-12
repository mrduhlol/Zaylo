/**
 * Offline persona import/export.
 *
 * Pure, dependency-free validation helpers for moving personas between
 * Zaylo installations as JSON files. Data is parsed with JSON.parse only —
 * imported content is never executed or evaluated, and imported personas are
 * always forced to `isBuiltIn: false` so protected presets cannot be spoofed.
 */

import type { Persona, PersonaCommunicationStyle } from '@local-ai/shared';

export const PERSONA_EXPORT_FORMAT = 'zaylo-personas';
export const PERSONA_EXPORT_VERSION = 1;

/** Hard size ceiling for an import payload (~512 KB of JSON). */
export const MAX_IMPORT_JSON_BYTES = 512 * 1024;
/** Maximum personas accepted in one collection import. */
export const MAX_IMPORT_COLLECTION_SIZE = 50;

const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_INSTRUCTIONS_LENGTH = 20000;
const MAX_TRAITS = 12;
const MAX_TRAIT_LENGTH = 60;
const MAX_RULES = 20;
const MAX_RULE_LENGTH = 500;
const MAX_STRUCTURE_LENGTH = 500;
const MAX_GREETING_LENGTH = 500;
const MAX_PREFERENCE_LENGTH = 200;
const MAX_AVATAR_LENGTH = 4;

const COMMUNICATION_STYLES: PersonaCommunicationStyle[] = [
  'Professional',
  'Casual',
  'Technical',
  'Concise',
  'Detailed',
  'Friendly',
  'Academic',
  'Creative',
];

export type PersonaImportErrorCode =
  | 'file-too-large'
  | 'invalid-json'
  | 'invalid-format'
  | 'too-many-personas'
  | 'invalid-persona'
  | 'duplicate-id';

export interface PersonaImportError {
  code: PersonaImportErrorCode;
  message: string;
  /** Zero-based index in the imported collection, when applicable. */
  index?: number;
}

export type PersonaImportResult =
  | { ok: true; personas: Persona[] }
  | { ok: false; errors: PersonaImportError[] };

export interface PersonaExportPersona {
  format: typeof PERSONA_EXPORT_FORMAT;
  version: number;
  exportedAt: number;
  persona: PersonaExportPayload;
}

export interface PersonaExportPayload {
  name: string;
  description: string;
  avatar: string;
  systemInstructions: string;
  personalityTraits: string[];
  communicationStyle: PersonaCommunicationStyle;
  responsePreferences?: Persona['responsePreferences'];
  behavioralRules: string[];
  responseStructure: string;
  greetingMessage?: string;
}

/** Strip protected/runtime-only fields for a portable, honest export payload. */
export function buildExportPayload(persona: Persona): PersonaExportPayload {
  return {
    name: persona.name,
    description: persona.description,
    avatar: persona.avatar,
    systemInstructions: persona.systemInstructions,
    personalityTraits: [...persona.personalityTraits],
    communicationStyle: persona.communicationStyle,
    responsePreferences: persona.responsePreferences
      ? { ...persona.responsePreferences }
      : undefined,
    behavioralRules: [...persona.behavioralRules],
    responseStructure: persona.responseStructure,
    greetingMessage: persona.greetingMessage,
  };
}

export function serializePersonaForExport(persona: Persona): string {
  const payload: PersonaExportPersona = {
    format: PERSONA_EXPORT_FORMAT,
    version: PERSONA_EXPORT_VERSION,
    exportedAt: Date.now(),
    persona: buildExportPayload(persona),
  };
  return JSON.stringify(payload, null, 2);
}

export function serializePersonaCollectionForExport(personas: Persona[]): string {
  const payload = {
    format: PERSONA_EXPORT_FORMAT,
    version: PERSONA_EXPORT_VERSION,
    exportedAt: Date.now(),
    personas: personas.map(buildExportPayload),
  };
  return JSON.stringify(payload, null, 2);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function clampString(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function cleanStringArray(value: unknown, maxItems: number, maxItemLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => clampString(item.trim(), maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function cleanResponsePreferences(
  value: unknown
): Persona['responsePreferences'] | undefined {
  if (!isPlainObject(value)) return undefined;
  const prefs: NonNullable<Persona['responsePreferences']> = {};
  for (const key of ['reasoningStyle', 'codeFormatting', 'formatPreference'] as const) {
    const raw = value[key];
    if (typeof raw === 'string' && raw.trim()) {
      prefs[key] = clampString(raw.trim(), MAX_PREFERENCE_LENGTH);
    }
  }
  return Object.keys(prefs).length > 0 ? prefs : undefined;
}

/**
 * Validate one parsed persona-shaped object. Returns a normalized `Persona`
 * or a list of human-readable problems. `isBuiltIn` is never honored: imports
 * always become custom personas. A colliding id is replaced with a fresh one
 * by the caller via `existingIds`.
 */
export function validatePersonaObject(
  raw: unknown,
  existingIds: ReadonlySet<string>
): { persona: Persona } | { problems: string[] } {
  const problems: string[] = [];

  if (!isPlainObject(raw)) {
    return { problems: ['Persona entry is not a JSON object.'] };
  }

  const name = asNonEmptyString(raw.name)?.trim();
  if (!name) {
    problems.push('A persona name is required.');
  }

  const systemInstructions = asNonEmptyString(raw.systemInstructions)?.trim();
  if (!systemInstructions) {
    problems.push('Core system instructions are required.');
  }

  const styleRaw = asNonEmptyString(raw.communicationStyle)?.trim() ?? 'Professional';
  const communicationStyle = (COMMUNICATION_STYLES as string[]).includes(styleRaw)
    ? (styleRaw as PersonaCommunicationStyle)
    : 'Professional';

  if (problems.length > 0) {
    return { problems };
  }

  let id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : '';
  if (id && existingIds.has(id)) {
    id = '';
  }
  if (!id) {
    id = `persona_custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  const now = Date.now();
  const createdAt = typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt)
    ? Math.max(0, raw.createdAt)
    : now;

  const persona: Persona = {
    id,
    name: clampString(name!, MAX_NAME_LENGTH),
    description: clampString(asNonEmptyString(raw.description)?.trim() ?? '', MAX_DESCRIPTION_LENGTH),
    avatar: clampString(asNonEmptyString(raw.avatar)?.trim() || '✨', MAX_AVATAR_LENGTH),
    systemInstructions: clampString(systemInstructions!, MAX_INSTRUCTIONS_LENGTH),
    personalityTraits: cleanStringArray(raw.personalityTraits, MAX_TRAITS, MAX_TRAIT_LENGTH),
    communicationStyle,
    responsePreferences: cleanResponsePreferences(raw.responsePreferences),
    behavioralRules: cleanStringArray(raw.behavioralRules, MAX_RULES, MAX_RULE_LENGTH),
    responseStructure: clampString(
      asNonEmptyString(raw.responseStructure)?.trim() || 'Structured response with clear sections.',
      MAX_STRUCTURE_LENGTH
    ),
    greetingMessage: clampString(
      asNonEmptyString(raw.greetingMessage)?.trim() ?? '',
      MAX_GREETING_LENGTH
    ) || undefined,
    // Protected presets can never enter through import.
    isBuiltIn: false,
    // Import never hijacks the app default; the user chooses a default in-app.
    isDefault: false,
    createdAt,
    updatedAt: now,
  };

  return { persona };
}

function byteLength(text: string): number {
  return typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(text).length
    : text.length;
}

/**
 * Parse and validate an import payload. Accepts either a single-persona export
 * (`{ format, version, persona }`) or a collection (`{ format, version,
 * personas: [...] }`). Importantly, this only interprets JSON — it never
 * evaluates imported content.
 */
export function parsePersonaImport(
  jsonText: string,
  existingIds: ReadonlySet<string>
): PersonaImportResult {
  if (byteLength(jsonText) > MAX_IMPORT_JSON_BYTES) {
    return {
      ok: false,
      errors: [
        {
          code: 'file-too-large',
          message: `Import file is too large (limit ${Math.round(
            MAX_IMPORT_JSON_BYTES / 1024
          )} KB of JSON).`,
        },
      ],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {
      ok: false,
      errors: [
        {
          code: 'invalid-json',
          message: 'The file is not valid JSON. Export personas from Zaylo and try again.',
        },
      ],
    };
  }

  if (!isPlainObject(parsed) || parsed.format !== PERSONA_EXPORT_FORMAT) {
    return {
      ok: false,
      errors: [
        {
          code: 'invalid-format',
          message: 'This is not a Zaylo persona export. Expected the "zaylo-personas" format.',
        },
      ],
    };
  }

  const entries = Array.isArray(parsed.personas)
    ? parsed.personas
    : isPlainObject(parsed.persona)
    ? [parsed.persona]
    : [];

  if (entries.length === 0) {
    return {
      ok: false,
      errors: [
        {
          code: 'invalid-format',
          message: 'The export contains no persona data.',
        },
      ],
    };
  }

  if (entries.length > MAX_IMPORT_COLLECTION_SIZE) {
    return {
      ok: false,
      errors: [
        {
          code: 'too-many-personas',
          message: `The export contains ${entries.length} personas; the limit is ${MAX_IMPORT_COLLECTION_SIZE}.`,
        },
      ],
    };
  }

  const takenIds = new Set(existingIds);
  const personas: Persona[] = [];
  const errors: PersonaImportError[] = [];

  entries.forEach((entry, index) => {
    const result = validatePersonaObject(entry, takenIds);
    if ('persona' in result) {
      takenIds.add(result.persona.id);
      personas.push(result.persona);
    } else {
      errors.push({
        code: 'invalid-persona',
        index,
        message: result.problems.join(' '),
      });
    }
  });

  if (personas.length === 0) {
    return { ok: false, errors };
  }

  return { ok: true, personas };
}
