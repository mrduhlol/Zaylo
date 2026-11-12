import { z } from 'zod';

export const ChatMessageContentPartSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('image_url'),
    image_url: z.object({
      url: z.string(),
    }),
  }),
]);

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.union([z.string(), z.array(ChatMessageContentPartSchema)]),
  name: z.string().optional(),
});

export const PersonaSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string(),
  avatar: z.string(),
  systemInstructions: z.string(),
  personalityTraits: z.array(z.string()),
  communicationStyle: z.enum([
    'Professional',
    'Casual',
    'Technical',
    'Concise',
    'Detailed',
    'Friendly',
    'Academic',
    'Creative',
  ]),
  responsePreferences: z.object({
    codeFormatting: z.string().optional(),
    reasoningStyle: z.string().optional(),
    formatPreference: z.string().optional(),
  }).optional(),
  behavioralRules: z.array(z.string()),
  responseStructure: z.string(),
  greetingMessage: z.string().optional(),
  isBuiltIn: z.boolean(),
  isDefault: z.boolean().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const ChatCompletionRequestSchema = z.object({
  model: z.string().min(1).optional().default('default'),
  messages: z.array(ChatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  top_p: z.number().min(0).max(1).optional().default(0.9),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional().default(false),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  user: z.string().optional(),
  rag: z.boolean().optional().default(false),
  ragDocumentIds: z.array(z.string()).optional(),
  memory: z.boolean().optional(),
  memorySave: z.boolean().optional(),
  memoryScope: z.enum(['all', 'global', 'persona', 'conversation']).optional(),
  conversationId: z.string().optional(),
  personaId: z.string().optional(),
  personaInstructions: z.string().optional(),
});

export const LoftyDbConfigSchema = z.object({
  enabled: z.boolean().default(true),
  autoStart: z.boolean().default(true),
  mode: z.enum(['managed', 'external']).default('managed'),
  port: z.number().int().min(1024).max(65535).default(8090),
  baseUrl: z.string().url().default('http://127.0.0.1:8090'),
  dataDir: z.string().min(1),
  binaryPath: z.string().optional(),
  memoryEnabled: z.boolean().default(true),
  autoExtractMemories: z.boolean().default(true),
  recallLimit: z.number().int().min(1).max(20).default(5),
  minSimilarity: z.number().min(0).max(1).default(0.15),
});

export const MemoryEntryInputSchema = z.object({
  id: z.string().optional(),
  content: z.string().min(1),
  category: z.enum(['fact', 'preference', 'instruction', 'project', 'episode', 'context']).default('fact'),
  scope: z.enum(['global', 'persona', 'conversation']).default('global'),
  personaId: z.string().optional(),
  conversationId: z.string().optional(),
  importance: z.number().int().min(1).max(5).default(3),
  pinned: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  source: z.enum(['auto', 'manual', 'chat']).default('manual'),
});

export const EmbeddingRequestSchema = z.object({
  model: z.string().min(1),
  input: z.union([z.string(), z.array(z.string())]),
  user: z.string().optional(),
});

export const ServerConfigurationSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  port: z.number().int().min(1024).max(65535),
  host: z.string(),
  lanEnabled: z.boolean(),
  activeModelId: z.string().optional(),
  activeVariantId: z.string().optional(),
  maxConcurrentRequests: z.number().int().min(1).max(64),
  contextLimit: z.number().int().min(512).max(131072),
  gpuLayers: z.number().int().min(0).max(999),
  threads: z.number().int().min(1).max(128),
  temperature: z.number().min(0).max(2),
  topP: z.number().min(0).max(1),
  autoStartOnBoot: z.boolean(),
  autoLoadModel: z.boolean(),
  lowMemoryMode: z.boolean().default(false),
  flashAttention: z.boolean().default(true),
  modelsDirectory: z.string(),
  runtimeDirectory: z.string(),
});

export const CreateAPIKeySchema = z.object({
  name: z.string().min(1).max(64),
});

export const PairDeviceRequestSchema = z.object({
  pairingToken: z.string().min(1),
  deviceName: z.string().min(1).max(64),
});
