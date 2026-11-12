import type {
  ChatMessage,
  ModelInstallation,
  FineTunedModelArtifact,
  ModelTaskType,
  ModelCapabilityProfile,
} from '@local-ai/shared';

export interface InferenceGenerationStats {
  latencyMs: number;
  tokensPerSec: number;
  tokenCount: number;
  timeToFirstTokenMs?: number;
  promptTokens?: number;
  totalDurationMs?: number;
}

export interface PlaygroundConversation {
  id: string;
  title: string;
  modelId: string;
  modelName: string;
  isAdapter?: boolean;
  adapterPath?: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  lastStats?: InferenceGenerationStats;
  personaId?: string;
  pinned?: boolean;
  archivedAt?: number;
  temporary?: boolean;
  memoryEnabled?: boolean;
  memorySaveEnabled?: boolean;
  projectId?: string;
  parentConversationId?: string;
}

export interface GenerationSettings {
  systemPrompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences: string[];
}

export type ModelTypeBadge = 'base' | 'adapter' | 'standalone';

export interface UnifiedModelOption {
  id: string;
  name: string;
  type: ModelTypeBadge;
  taskType: ModelTaskType;
  isImageModel?: boolean;
  imageProfile?: ModelCapabilityProfile;
  baseModelId?: string;
  baseModelName?: string;
  adapterPath?: string;
  localPath?: string;
  format: string;
  quantization?: string;
  isLoaded: boolean;
  isVisionSupported: boolean;
  rawInstallation?: ModelInstallation;
  rawArtifact?: FineTunedModelArtifact;
}

export interface ImagePlaygroundSettings {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  steps: number;
  guidanceScale: number;
  seed: number;
  useRandomSeed: boolean;
  batchSize: number;
}

export interface CompareRunResult {
  prompt: string;
  baseResponse: string;
  baseLatencyMs: number;
  ftResponse: string;
  ftLatencyMs: number;
  timestamp: number;
}
