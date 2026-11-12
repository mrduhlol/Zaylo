import type {
  HardwareProfile,
  CapabilityProfile,
  Model,
  ModelInstallation,
  DownloadProgress,
  ServerConfiguration,
  RuntimeInstance,
  ServerState,
  ConnectedDevice,
  PairingTokenInfo,
  APIKeyInfo,
  SystemMetricSample,
  StructuredLog,
  BenchmarkResult,
  ChatCompletionRequest,
  ChatCompletionResponse,
  DocumentInfo,
  DocumentType,
  RagSearchResult,
  ForgeModelInspection,
  DatasetColumnMapping,
  DatasetAnalysis,
  TrainingObjective,
  TrainingConfig,
  HardwareConstraintEstimates,
  PreflightReport,
  TrainingJob,
  TrainingJobStatus,
  TrainingMetricSample,
  FineTunedModelArtifact,
  ModelComparisonRequest,
  ModelComparisonResult,
  DatasetEvaluationReport,
  ImageGenerationParams,
  GeneratedImage,
  ImageGenerationJob,
  ImageGenerationProgress,
  ModelCapabilityProfile,
  LoftyDbConfig,
  LoftyDbStatus,
  LoftyDbStats,
  LoftyDbDocument,
  LoftyDbHistoryEntry,
  LoftyDbDiffResult,
  LoftyDbSqlResult,
  LoftyDbSubscriptionEvent,
  KnowledgeGraphPayload,
  KnowledgeNodeKind,
  MemoryEntry,
  MemoryRecallResult,
  MemoryRelationship,
  MemoryRelationshipType,
  MemoryCategory,
  MemoryScope,
  StoredConversation,
} from '@local-ai/shared';

export interface ChatPdfRequest {
  title: string;
  messages: Array<{ role: string; text: string }>;
}

export type ChatPdfResult = { canceled: true } | { canceled: false; filePath: string };

export interface IPCChannels {
  'chat:export-pdf': { request: ChatPdfRequest; response: ChatPdfResult };

  // Hardware & Capabilities
  'hardware:get-profile': { request: void; response: HardwareProfile };
  'hardware:get-capabilities': { request: void; response: CapabilityProfile };

  // Models
  'models:list-available': { request: void; response: Model[] };
  'models:list-installed': { request: void; response: ModelInstallation[] };
  'models:search-hf': { request: { query: string; limit?: number }; response: Model[] };
  'models:download': { request: { modelId: string; variantId: string; downloadUrl?: string; name?: string }; response: { downloadId: string } };
  'models:cancel-download': { request: { downloadId: string }; response: boolean };
  'models:delete': { request: { installationId: string }; response: boolean };
  'models:get-downloads': { request: void; response: DownloadProgress[] };
  'models:import-local': { request: { filePath?: string; name?: string }; response: ModelInstallation | null };
  'models:select-file': { request: void; response: string | null };

  // Server & Runtime Lifecycle
  'server:get-config': { request: void; response: ServerConfiguration };
  'server:update-config': { request: Partial<ServerConfiguration>; response: ServerConfiguration };
  'server:get-state': { request: void; response: { state: ServerState; instance?: RuntimeInstance; lanAddress?: string; port: number } };
  'server:start': { request: { modelId?: string; variantId?: string }; response: boolean };
  'server:stop': { request: void; response: boolean };
  'server:restart': { request: void; response: boolean };
  'server:load-model': { request: { modelId: string; variantId?: string }; response: boolean };
  'server:unload-model': { request: void; response: boolean };

  // Runtime Management
  'runtime:check-status': { request: void; response: { installed: boolean; version?: string; path?: string; supportedBackends: string[] } };
  'runtime:install': { request: void; response: { success: boolean; path?: string; error?: string } };

  // Network & Devices
  'network:get-interfaces': { request: void; response: { interfaces: Array<{ name: string; address: string; family: string; type: string }> } };
  'network:get-qr-code': { request: { text: string }; response: { qrDataUrl: string } };
  'devices:list': { request: void; response: ConnectedDevice[] };
  'devices:create-pairing-token': { request: void; response: PairingTokenInfo };
  'devices:revoke': { request: { deviceId: string }; response: boolean };
  'devices:delete': { request: { deviceId: string }; response: boolean };
  'devices:rename': { request: { deviceId: string; name: string }; response: boolean };

  // API Keys
  'keys:list': { request: void; response: APIKeyInfo[] };
  'keys:create': { request: { name: string }; response: { key: APIKeyInfo; rawKey: string } };
  'keys:revoke': { request: { keyId: string }; response: boolean };
  'keys:delete': { request: { keyId: string }; response: boolean };

  // Metrics & Logs
  'metrics:get-current': { request: void; response: SystemMetricSample };
  'metrics:get-history': { request: { limit?: number }; response: SystemMetricSample[] };
  'logs:get-recent': { request: { limit?: number; level?: string; component?: string }; response: StructuredLog[] };
  'logs:clear': { request: void; response: boolean };

  // Inference Playground
  'inference:chat': { request: ChatCompletionRequest & { clientRequestId?: string }; response: ChatCompletionResponse };
  'inference:abort': { request: { requestId: string }; response: boolean };

  // Local speech setup is explicit; recordings are never sent to a cloud API.
  'voice:status': { request: undefined; response: { ready: boolean; installing: boolean; model: string } };
  'voice:setup': { request: undefined; response: { ready: boolean; installing: boolean; model: string } };
  'voice:transcribe': { request: { audioBase64: string }; response: { text: string; language: string } };
  'voice:cancel': { request: undefined; response: boolean };

  // Knowledge & Local Document RAG
  'rag:list-documents': { request: void; response: DocumentInfo[] };
  'rag:add-document': { request: { name: string; content: string; type?: DocumentType }; response: DocumentInfo };
  'rag:delete-document': { request: { id: string }; response: boolean };
  'rag:search': { request: { query: string; limit?: number; documentIds?: string[] }; response: RagSearchResult[] };

  // Benchmark
  'benchmark:run': { request: { modelId?: string; variantId?: string; promptTokens?: number; genTokens?: number }; response: BenchmarkResult };
  'benchmark:get-history': { request: void; response: BenchmarkResult[] };

  // Forge Fine-Tuning Studio
  'forge:list-models': { request: void; response: ForgeModelInspection[] };
  'forge:inspect-model': { request: { modelId: string }; response: ForgeModelInspection };
  'forge:fetch-checkpoint': { request: { modelId: string; hfRepoId?: string }; response: { success: boolean; checkpointPath?: string; error?: string } };
  'forge:parse-dataset': { request: { filePath: string; columnMapping?: DatasetColumnMapping; maxPreview?: number }; response: DatasetAnalysis };
  'forge:select-dataset-file': { request: void; response: string | null };
  'forge:load-sample-dataset': { request: { type: 'instruction' | 'conversational' }; response: { filePath: string; analysis: DatasetAnalysis } };
  'forge:auto-configure': { request: { modelId: string; datasetPath: string; objective?: TrainingObjective; columnMapping?: DatasetColumnMapping }; response: { config: TrainingConfig; estimates: HardwareConstraintEstimates } };
  'forge:validate-config': { request: { config: TrainingConfig }; response: { valid: boolean; estimates: HardwareConstraintEstimates; errors: string[] } };
  'forge:run-preflight': { request: { config: TrainingConfig }; response: PreflightReport };
  'forge:start-training': { request: { config: TrainingConfig }; response: { jobId: string; started: boolean } };
  'forge:pause-training': { request: { jobId: string }; response: boolean };
  'forge:resume-training': { request: { jobId: string }; response: boolean };
  'forge:cancel-training': { request: { jobId: string }; response: boolean };
  'forge:get-job': { request: { jobId: string }; response: TrainingJob | null };
  'forge:list-jobs': { request: void; response: TrainingJob[] };
  'forge:list-fine-tuned-models': { request: void; response: FineTunedModelArtifact[] };
  'forge:compare-models': { request: ModelComparisonRequest; response: ModelComparisonResult };
  'forge:merge-adapter': { request: { artifactId: string }; response: { success: boolean; outputPath?: string; error?: string } };
  'forge:export-artifact': { request: { artifactId: string; destinationDir: string }; response: { success: boolean; exportPath?: string; error?: string } };
  'forge:delete-artifact': { request: { artifactId: string }; response: boolean };
  'forge:resume-from-checkpoint': { request: { jobId: string; checkpointStep: number }; response: { success: boolean; error?: string } };
  'forge:evaluate-dataset': { request: { jobId: string; numExamples?: number }; response: DatasetEvaluationReport };

  // Image Generation
  'image:generate': {
    request: {
      modelId: string;
      modelName?: string;
      modelPath?: string;
      params: Partial<ImageGenerationParams>;
      outputDir?: string;
      device?: 'auto' | 'mps' | 'cuda' | 'cpu';
    };
    response: { jobId: string };
  };
  'image:cancel': { request: { jobId: string }; response: boolean };
  'image:get-job': { request: { jobId: string }; response: ImageGenerationJob | null };
  'image:list-history': { request: void; response: GeneratedImage[] };
  'image:delete': { request: { imageId: string }; response: boolean };
  'image:save-as': { request: { imagePath: string; defaultName?: string }; response: string | null };
  'image:open-folder': { request: { imagePath: string }; response: void };

  // Model Capabilities
  'capabilities:get-model-profile': { request: { modelId: string }; response: ModelCapabilityProfile | null };
  'capabilities:list-profiles': { request: void; response: ModelCapabilityProfile[] };

  // LoftyDB Engine & Direct Database Features
  'loftydb:get-config': { request: void; response: LoftyDbConfig };
  'loftydb:update-config': { request: Partial<LoftyDbConfig>; response: LoftyDbConfig };
  'loftydb:get-status': { request: void; response: LoftyDbStatus };
  'loftydb:start': { request: void; response: LoftyDbStatus };
  'loftydb:stop': { request: void; response: LoftyDbStatus };
  'loftydb:test-connection': { request: { baseUrl?: string }; response: { ok: boolean; stats?: LoftyDbStats; error?: string } };
  'loftydb:list-collections': { request: void; response: string[] };
  'loftydb:delete-collection': { request: { collection: string }; response: boolean };
  'loftydb:compact-collection': { request: { collection: string }; response: boolean };
  'loftydb:query-documents': { request: { collection: string; filter?: Record<string, unknown>; asOf?: string | number }; response: LoftyDbDocument[] };
  'loftydb:upsert-document': { request: { collection: string; document: Record<string, unknown>; id?: string }; response: LoftyDbDocument };
  'loftydb:get-document': { request: { collection: string; id: string; asOf?: string | number }; response: LoftyDbDocument | null };
  'loftydb:delete-document': { request: { collection: string; id: string }; response: boolean };
  'loftydb:vector-search': { request: { collection: string; text?: string; vector?: number[]; limit?: number; minSimilarity?: number }; response: { queryVector: number[]; documents: LoftyDbDocument[] } };
  'loftydb:execute-sql': { request: { query: string; asOf?: string | number }; response: LoftyDbSqlResult };
  'loftydb:get-history': { request: { collection: string; id: string }; response: LoftyDbHistoryEntry[] };
  'loftydb:diff-versions': { request: { collection: string; id: string; v1: number; v2: number }; response: LoftyDbDiffResult };
  'loftydb:rollback': { request: { collection: string; id: string; version: number }; response: LoftyDbDocument };
  'loftydb:subscribe': { request: { collection: string; filter?: Record<string, unknown> }; response: { subscriptionId: string } };
  'loftydb:unsubscribe': { request: { subscriptionId: string }; response: boolean };

  // Long-Term Memory & Persistent Chat History (backed by LoftyDB)
  'memory:list': { request: { scope?: 'all' | MemoryScope; personaId?: string; conversationId?: string; category?: MemoryCategory; minImportance?: number; pinnedOnly?: boolean } | void; response: MemoryEntry[] };
  'memory:save': { request: { id?: string; title?: string; content: string; category?: MemoryCategory; scope?: MemoryScope; personaId?: string; conversationId?: string; importance?: number; confidence?: number; pinned?: boolean; tags?: string[]; source?: 'auto' | 'manual' | 'chat' }; response: MemoryEntry };
  'memory:delete': { request: { id: string }; response: boolean };
  'memory:recall': { request: { query: string; limit?: number; minSimilarity?: number; scope?: 'all' | MemoryScope; personaId?: string; conversationId?: string }; response: MemoryRecallResult[] };
  'memory:history': { request: { id: string }; response: LoftyDbHistoryEntry[] };
  'memory:diff': { request: { id: string; v1: number; v2: number }; response: LoftyDbDiffResult };
  'memory:rollback': { request: { id: string; version: number }; response: MemoryEntry };
  'memory:query-as-of': { request: { asOf: string | number; filter?: Record<string, unknown> }; response: MemoryEntry[] };
  'memory:list-conversations': { request: void; response: StoredConversation[] };
  'memory:save-conversation': { request: StoredConversation; response: StoredConversation };
  'memory:delete-conversation': { request: { id: string }; response: boolean };
  'memory:search-conversations': { request: { query: string; limit?: number }; response: StoredConversation[] };
  'memory:sync-conversations': { request: { conversations: StoredConversation[] }; response: StoredConversation[] };
  'memory:extract-from-conversations': {
    request: { conversationId?: string };
    response: { scannedConversations: number; scannedMessages: number; extracted: MemoryEntry[] };
  };
  'memory:get-graph': { request: { collection?: string } | void; response: KnowledgeGraphPayload };
  'memory:create-relationship': {
    request: {
      sourceId: string;
      targetId: string;
      sourceKind: KnowledgeNodeKind;
      targetKind: KnowledgeNodeKind;
      type: MemoryRelationshipType;
      strength?: number;
      confidence?: number;
      directed?: boolean;
      metadata?: Record<string, unknown>;
    };
    response: MemoryRelationship;
  };
  'memory:delete-relationship': { request: { id: string }; response: boolean };
  'memory:merge': { request: { primaryId: string; secondaryId: string; mergedContent?: string }; response: MemoryEntry };

  // App & System
  'app:get-version': { request: void; response: string };
  'app:select-directory': { request: { defaultPath?: string }; response: string | null };
  'app:open-external': { request: { url: string }; response: void };
}

export interface IPCEvents {
  'metrics:update': SystemMetricSample;
  'logs:new': StructuredLog;
  'server:state-changed': { state: ServerState; instance?: RuntimeInstance };
  'download:progress': DownloadProgress;
  'inference:chunk': { requestId: string; chunk: ChatCompletionResponse };
  'forge:training-metric': { jobId: string; sample: TrainingMetricSample };
  'forge:training-log': { jobId: string; log: string };
  'forge:training-status': { jobId: string; status: TrainingJobStatus; error?: string };
  'image:status': { jobId: string; status: string; message?: string };
  'image:progress': { jobId: string; progress: ImageGenerationProgress };
  'image:completed': { jobId: string; images: GeneratedImage[] };
  'image:error': { jobId: string; error: string };
  'models:updated': void;
  'loftydb:status-changed': LoftyDbStatus;
  'loftydb:log': string;
  'loftydb:subscription-event': LoftyDbSubscriptionEvent & { subscriptionId: string };
  'memory:updated': void;
}
