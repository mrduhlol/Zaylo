import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import {
  ServerConfiguration,
  ChatCompletionRequest,
  EmbeddingRequest,
  ModelNotLoadedError,
  ValidationError,
  AppError,
  LAN_SERVER_HOST,
  DEFAULT_SERVER_HOST,
} from '@local-ai/shared';
import { ModelManager } from '@local-ai/models';
import { KeyManager, SecretRedactor } from '@local-ai/security';
import { DeviceRepository, LogsRepository, DocumentRepository } from '@local-ai/database';
import { DevicePairingManager } from '@local-ai/network';
import { InferenceService } from '@local-ai/inference';
import { HardwareScanner } from '@local-ai/hardware';
import { formatSSE, formatOpenAIModelList } from '@local-ai/protocol';
import { getWebChatHtml } from './ui.js';

export interface ApiServerOptions {
  config: ServerConfiguration;
  inferenceService: InferenceService;
  modelManager: ModelManager;
  keyManager: KeyManager;
  deviceRepo: DeviceRepository;
  pairingManager: DevicePairingManager;
  logsRepo?: LogsRepository;
  documentRepo?: DocumentRepository;
  imageEngine?: {
    startGeneration: (params: any) => Promise<{ jobId: string }>;
    getJob: (jobId: string) => any;
    getHistory: () => any[];
  };
}

export class ApiServer {
  private fastify: FastifyInstance;
  private config: ServerConfiguration;
  private inferenceService: InferenceService;
  private modelManager: ModelManager;
  private keyManager: KeyManager;
  private deviceRepo: DeviceRepository;
  private pairingManager: DevicePairingManager;
  private documentRepo?: DocumentRepository;
  private imageEngine?: {
    startGeneration: (params: any) => Promise<{ jobId: string }>;
    getJob: (jobId: string) => any;
    getHistory: () => any[];
  };
  private isRunning = false;

  constructor(options: ApiServerOptions) {
    this.config = options.config;
    this.inferenceService = options.inferenceService;
    this.modelManager = options.modelManager;
    this.keyManager = options.keyManager;
    this.deviceRepo = options.deviceRepo;
    this.pairingManager = options.pairingManager;
    this.documentRepo = options.documentRepo;
    this.imageEngine = options.imageEngine;

    this.fastify = Fastify({
      logger: false,
    });

    this.setupMiddleware();
    this.setupRoutes();
  }

  public getConfig(): ServerConfiguration {
    return this.config;
  }

  public updateConfig(newConfig: Partial<ServerConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    this.inferenceService.setMaxConcurrency(this.config.maxConcurrentRequests);
  }

  private setupMiddleware(): void {
    this.fastify.register(cors, {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    });

    // Authentication hook
    this.fastify.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
      const url = req.url.split('?')[0];
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] as string | undefined;

      // Automatically register any connecting LAN device
      const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1' || clientIp === 'localhost';
      if (!isLoopback && req.method !== 'OPTIONS') {
        this.deviceRepo.recordActivity(clientIp, userAgent);
      }

      // Always allow CORS preflights, Web Chat UI, health, and pairing
      if (
        req.method === 'OPTIONS' ||
        url === '/' ||
        url === '/chat' ||
        url === '/health' ||
        url === '/v1/health' ||
        url === '/models' ||
        url === '/v1/models' ||
        url === '/heartbeat' ||
        url === '/v1/heartbeat' ||
        url === '/pair'
      ) {
        return;
      }

      // Check client authorization
      const authHeader = req.headers.authorization || (req.headers['x-api-key'] as string);
      let isAuthed = false;

      if (authHeader) {
        const rawKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
        const validKey = this.keyManager.validateKey(rawKey);
        if (validKey) {
          isAuthed = true;
          this.deviceRepo.recordActivity(clientIp, userAgent);
        }
      }

      // Only local-only mode permits keyless loopback access. Browser-supplied
      // headers (including Referer and Host) are never authentication evidence.
      if (isLoopback && !this.config.lanEnabled) {
        isAuthed = true;
      }

      if (!isAuthed) {
        reply.code(401).send({
          error: {
            message: 'Authentication required. Provide a valid local API key via Bearer token.',
            type: 'invalid_request_error',
            code: 'unauthorized',
          },
        });
      }
    });

    // Error handling hook
    this.fastify.setErrorHandler((error: any, _req, reply) => {
      const statusCode = error.statusCode || 500;
      const message = SecretRedactor.redact(error.message || 'Internal server error');

      reply.status(statusCode).send({
        error: {
          message,
          type: error.code || 'api_error',
          code: error.code || 'internal_error',
        },
      });
    });
  }

  private setupRoutes(): void {
    // 0. Web Chat UI (Mobile & Desktop browser interface)
    this.fastify.get('/', async (_req, reply) => {
      reply.type('text/html; charset=utf-8').send(getWebChatHtml());
    });

    this.fastify.get('/chat', async (_req, reply) => {
      reply.type('text/html; charset=utf-8').send(getWebChatHtml());
    });

    // 1. Health Check & Heartbeat (Both root and /v1 aliases)
    const healthHandler = async () => {
      const runtime = this.inferenceService.getRuntime();
      const health = runtime ? await runtime.health() : { isHealthy: false, state: 'STOPPED', modelLoaded: false };
      return {
        status: health.isHealthy ? 'ok' : 'degraded',
        server: this.isRunning ? 'running' : 'stopped',
        modelLoaded: health.modelLoaded,
        activeModel: this.inferenceService.getModelName() || null,
        uptime: process.uptime(),
      };
    };

    this.fastify.get('/health', healthHandler);
    this.fastify.get('/v1/health', healthHandler);

    const heartbeatHandler = async (req: any) => {
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
      this.deviceRepo.recordActivity(clientIp, req.headers['user-agent'], `Client (${clientIp})`);
      return { status: 'ok', active: true, timestamp: Date.now() };
    };

    this.fastify.get('/heartbeat', heartbeatHandler);
    this.fastify.get('/v1/heartbeat', heartbeatHandler);

    // System Information
    this.fastify.get('/system', async () => {
      const profile = await HardwareScanner.scan();
      return profile;
    });

    // Metrics
    this.fastify.get('/metrics', async () => {
      return this.inferenceService.getMetrics();
    });

    // Server Info
    this.fastify.get('/server', async () => {
      return {
        name: this.config.name,
        port: this.config.port,
        host: this.config.lanEnabled ? LAN_SERVER_HOST : DEFAULT_SERVER_HOST,
        lanEnabled: this.config.lanEnabled,
        activeModel: this.inferenceService.getModelName() || null,
        maxConcurrentRequests: this.config.maxConcurrentRequests,
        contextLimit: this.config.contextLimit,
      };
    });

    // Models List (Local and OpenAI format)
    this.fastify.get('/models', async () => {
      return this.modelManager.getInstalledModels();
    });

    this.fastify.get('/v1/models', async () => {
      const installed = this.modelManager.getInstalledModels();
      const loadedModel = this.inferenceService.getModelName();
      return formatOpenAIModelList(installed, loadedModel);
    });

    // Agents List (Zaylo AI Agents for Daxon and external consumers)
    const listAgentsHandler = async () => {
      const activeModel = this.inferenceService.getModelName() || 'SmolLM2 135M Instruct';
      return {
        object: 'list',
        data: [
          {
            id: 'data-analyst',
            name: 'Data Analyst Agent',
            description: 'Expert in database exploration, schema-aware Text-to-SQL, dataset profiling, and trend analysis.',
            avatar: '📊',
            capabilities: ['text-to-sql', 'data-profiling', 'anomaly-detection', 'chart-recommendation', 'report-generation'],
            model: activeModel,
            status: 'connected',
          },
          {
            id: 'sql-optimizer',
            name: 'SQL Performance Optimizer',
            description: 'Analyzes query execution plans, indexes, costly scans, and rewrites inefficient SQL queries.',
            avatar: '⚡',
            capabilities: ['query-optimization', 'index-recommendation', 'execution-plan-analysis', 'explain-advisory'],
            model: activeModel,
            status: 'connected',
          },
          {
            id: 'database-auditor',
            name: 'Database Security & Integrity Auditor',
            description: 'Scans schemas for missing constraints, unindexed foreign keys, orphan rows, and security vulnerabilities.',
            avatar: '🛡️',
            capabilities: ['schema-audit', 'security-audit', 'constraint-verification', 'integrity-check'],
            model: activeModel,
            status: 'connected',
          },
          {
            id: 'bi-analyst',
            name: 'Business Intelligence Analyst',
            description: 'Transforms raw database metrics into executive KPI dashboards, cohort breakdowns, and revenue visualizations.',
            avatar: '📈',
            capabilities: ['kpi-calculation', 'cohort-analysis', 'trend-forecasting', 'executive-summary'],
            model: activeModel,
            status: 'connected',
          },
          {
            id: 'data-quality-agent',
            name: 'Data Quality & Anomaly Sentinel',
            description: 'Detects duplicate rows, null spikes, categorical drift, out-of-range anomalies, and format violations.',
            avatar: '🔍',
            capabilities: ['anomaly-detection', 'duplicate-detection', 'null-profiling', 'data-cleaning-sql'],
            model: activeModel,
            status: 'connected',
          },
        ],
      };
    };

    this.fastify.get('/agents', listAgentsHandler);
    this.fastify.get('/v1/agents', listAgentsHandler);

    // OpenAI Chat Completions (Stream & Non-stream)
    this.fastify.post('/v1/chat/completions', async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as ChatCompletionRequest;
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

      if (!this.inferenceService.getRuntime()) {
        throw new ModelNotLoadedError('No model is currently loaded in the server');
      }

      if (body.stream) {
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.flushHeaders();

        const ac = new AbortController();
        req.raw.on('close', () => ac.abort());

        try {
          for await (const chunk of this.inferenceService.chatStream(body, clientIp, ac.signal)) {
            reply.raw.write(formatSSE(chunk));
          }
          reply.raw.write(formatSSE('[DONE]'));
          reply.raw.end();
        } catch (err: any) {
          if (!ac.signal.aborted) {
            reply.raw.write(`data: ${JSON.stringify({ error: { message: err.message } })}\n\n`);
            reply.raw.end();
          }
        }
        return reply;
      }

      const response = await this.inferenceService.chat(body, clientIp);
      return response;
    });

    // OpenAI Embeddings
    this.fastify.post('/v1/embeddings', async (req: FastifyRequest) => {
      const body = req.body as EmbeddingRequest;
      return this.inferenceService.embeddings(body);
    });

    // Static serve for generated images: /v1/images/file/:filename
    this.fastify.get('/v1/images/file/:filename', async (req: FastifyRequest, reply: FastifyReply) => {
      const { filename } = req.params as { filename: string };
      const safeFilename = path.basename(filename);
      const filePath = path.join(os.homedir(), 'Pictures', 'Zaylo', 'Generated', safeFilename);
      if (!fs.existsSync(filePath)) {
        reply.code(404).send({ error: { message: 'Image not found', type: 'not_found' } });
        return;
      }
      const stream = fs.createReadStream(filePath);
      reply.type('image/png').send(stream);
    });

    // OpenAI Image Generations
    this.fastify.post('/v1/images/generations', async (req: FastifyRequest) => {
      const body = req.body as {
        prompt: string;
        model?: string;
        n?: number;
        size?: string;
        response_format?: 'url' | 'b64_json';
        seed?: number;
        steps?: number;
        guidance_scale?: number;
        negative_prompt?: string;
      };

      if (!body?.prompt || typeof body.prompt !== 'string') {
        throw new ValidationError('prompt string is required');
      }

      if (this.imageEngine) {
        let width = 512;
        let height = 512;
        if (body.size) {
          const parts = body.size.toLowerCase().split('x');
          if (parts.length === 2) {
            width = parseInt(parts[0], 10) || 512;
            height = parseInt(parts[1], 10) || 512;
          }
        }

        const modelId = body.model || 'tiny-sd';
        const installed = this.modelManager.getInstalledModels();
        const matchedModel = installed.find(
          (m) =>
            m.modelId === modelId ||
            m.id === modelId ||
            m.name.toLowerCase() === modelId.toLowerCase()
        );

        const { jobId } = await this.imageEngine.startGeneration({
          modelId,
          modelName: matchedModel?.name || modelId,
          modelPath: matchedModel?.localPath,
          generationParams: {
            prompt: body.prompt,
            negativePrompt: body.negative_prompt,
            width,
            height,
            steps: body.steps || 20,
            guidanceScale: body.guidance_scale || 7.5,
            seed: body.seed,
            batchSize: Math.min(4, Math.max(1, body.n || 1)),
          },
        });

        // Await generation completion (up to 120s timeout)
        const pollStart = Date.now();
        while (Date.now() - pollStart < 120000) {
          await new Promise((r) => setTimeout(r, 400));
          const job = this.imageEngine.getJob(jobId);
          if (job?.status === 'COMPLETED' && job.images && job.images.length > 0) {
            const host = this.config.lanEnabled && req.headers.host ? req.headers.host.split(':')[0] : '127.0.0.1';
            const port = this.config.port || 8080;
            const data = job.images.map((img: any) => {
              if (body.response_format === 'b64_json' && img.base64Data) {
                const b64 = img.base64Data.replace(/^data:image\/\w+;base64,/, '');
                return { b64_json: b64, revised_prompt: body.prompt };
              }
              const filename = path.basename(img.localPath);
              return {
                url: `http://${host}:${port}/v1/images/file/${filename}`,
                revised_prompt: body.prompt,
              };
            });
            return {
              created: Math.floor(job.completedAt ? job.completedAt / 1000 : Date.now() / 1000),
              data,
            };
          }
          if (job?.status === 'FAILED') {
            throw new AppError(job.error || 'Image generation failed', 'IMAGE_GENERATION_FAILED');
          }
        }
        throw new AppError('Image generation timed out after 120 seconds', 'TIMEOUT');
      }

      const now = Math.floor(Date.now() / 1000);
      return {
        created: now,
        data: [
          {
            revised_prompt: body.prompt,
            url: `http://${this.config.host || '127.0.0.1'}:${this.config.port}/v1/images/output.png`,
          },
        ],
      };
    });

    // QR Device Pairing Endpoint
    this.fastify.post('/pair', async (req: FastifyRequest) => {
      const body = req.body as { pairingToken: string; deviceName: string };
      if (!body?.pairingToken || !body?.deviceName) {
        throw new ValidationError('pairingToken and deviceName are required');
      }

      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
      return this.pairingManager.completePairing(body.pairingToken, body.deviceName, clientIp);
    });

    // 7. Local Documents & RAG Endpoints
    this.fastify.get('/v1/documents', async () => {
      return this.documentRepo ? this.documentRepo.getAllDocuments() : [];
    });

    this.fastify.post('/v1/documents', async (req: FastifyRequest) => {
      const body = req.body as { name: string; content: string; type?: any };
      if (!body?.name || !body?.content) {
        throw new ValidationError('name and content are required');
      }
      if (!this.documentRepo) {
        throw new AppError('Document repository is not configured', 'NOT_CONFIGURED');
      }
      const ragEngine = this.inferenceService.getRagEngine();
      if (!ragEngine) {
        throw new AppError('RAG engine is not configured', 'NOT_CONFIGURED');
      }
      return ragEngine.ingestDocument(body.name, body.content, body.type || 'txt');
    });

    this.fastify.delete('/v1/documents/:id', async (req: FastifyRequest) => {
      const { id } = req.params as { id: string };
      if (!this.documentRepo) return { success: false };
      this.documentRepo.deleteDocument(id);
      return { success: true };
    });

    this.fastify.post('/v1/rag/search', async (req: FastifyRequest) => {
      const body = req.body as { query: string; limit?: number; documentIds?: string[] };
      if (!body?.query) {
        throw new ValidationError('query is required');
      }
      const ragEngine = this.inferenceService.getRagEngine();
      if (!ragEngine) return [];
      return ragEngine.search(body.query, body.limit || 4, body.documentIds);
    });

    // 8. Long-Term Memory Endpoints (LoftyDB)
    this.fastify.get('/v1/memories', async (req: FastifyRequest) => {
      const memoryEngine = this.inferenceService.getMemoryEngine();
      if (!memoryEngine) return [];
      const query = (req.query || {}) as { scope?: any; personaId?: string; category?: any };
      return memoryEngine.listMemories({
        scope: query.scope,
        personaId: query.personaId,
        category: query.category,
      });
    });

    this.fastify.post('/v1/memories', async (req: FastifyRequest) => {
      const memoryEngine = this.inferenceService.getMemoryEngine();
      if (!memoryEngine) {
        throw new AppError('LoftyDB memory engine is not configured', 'NOT_CONFIGURED');
      }
      const body = req.body as any;
      if (!body?.content || typeof body.content !== 'string') {
        throw new ValidationError('content string is required');
      }
      return memoryEngine.saveMemory(body);
    });

    this.fastify.post('/v1/memories/search', async (req: FastifyRequest) => {
      const memoryEngine = this.inferenceService.getMemoryEngine();
      if (!memoryEngine) return [];
      const body = req.body as { query: string; limit?: number; minSimilarity?: number; personaId?: string; conversationId?: string };
      if (!body?.query) {
        throw new ValidationError('query is required');
      }
      return memoryEngine.recall(body);
    });

    this.fastify.delete('/v1/memories/:id', async (req: FastifyRequest) => {
      const memoryEngine = this.inferenceService.getMemoryEngine();
      if (!memoryEngine) return { success: false };
      const { id } = req.params as { id: string };
      const ok = await memoryEngine.deleteMemory(id);
      return { success: ok };
    });

    this.fastify.get('/v1/memories/:id/history', async (req: FastifyRequest) => {
      const memoryEngine = this.inferenceService.getMemoryEngine();
      if (!memoryEngine) return { history: [] };
      const { id } = req.params as { id: string };
      const history = await memoryEngine.getMemoryHistory(id);
      return { history };
    });

    this.fastify.post('/v1/memories/:id/rollback', async (req: FastifyRequest) => {
      const memoryEngine = this.inferenceService.getMemoryEngine();
      if (!memoryEngine) {
        throw new AppError('LoftyDB memory engine is not configured', 'NOT_CONFIGURED');
      }
      const { id } = req.params as { id: string };
      const body = req.body as { version: number };
      if (!body?.version || typeof body.version !== 'number') {
        throw new ValidationError('version number is required');
      }
      return memoryEngine.rollbackMemory(id, body.version);
    });

    this.fastify.get('/v1/memories/graph', async (req: FastifyRequest) => {
      const memoryEngine = this.inferenceService.getMemoryEngine();
      if (!memoryEngine) {
        throw new AppError('LoftyDB memory engine is not configured', 'NOT_CONFIGURED');
      }
      const query = (req.query || {}) as { collection?: string };
      return memoryEngine.getKnowledgeGraph(query.collection);
    });

    this.fastify.post('/v1/memories/relationships', async (req: FastifyRequest) => {
      const memoryEngine = this.inferenceService.getMemoryEngine();
      if (!memoryEngine) {
        throw new AppError('LoftyDB memory engine is not configured', 'NOT_CONFIGURED');
      }
      const body = req.body as any;
      if (!body?.sourceId || !body?.targetId || !body?.type) {
        throw new ValidationError('sourceId, targetId, and type are required');
      }
      return memoryEngine.createRelationship({
        sourceId: String(body.sourceId),
        targetId: String(body.targetId),
        sourceKind: body.sourceKind || 'memory',
        targetKind: body.targetKind || 'memory',
        type: body.type,
        strength: body.strength,
        confidence: body.confidence,
        directed: body.directed,
        autoGenerated: false,
        metadata: body.metadata,
      });
    });

    this.fastify.post('/v1/memories/merge', async (req: FastifyRequest) => {
      const memoryEngine = this.inferenceService.getMemoryEngine();
      if (!memoryEngine) {
        throw new AppError('LoftyDB memory engine is not configured', 'NOT_CONFIGURED');
      }
      const body = req.body as { primaryId?: string; secondaryId?: string; mergedContent?: string };
      if (!body?.primaryId || !body?.secondaryId) {
        throw new ValidationError('primaryId and secondaryId are required');
      }
      return memoryEngine.mergeMemories(body.primaryId, body.secondaryId, body.mergedContent);
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    await this.fastify.listen({
      port: this.config.port,
      host: '0.0.0.0',
    });
    this.isRunning = true;

    try {
      const zayloDir = path.join(os.homedir(), '.zaylo');
      if (!fs.existsSync(zayloDir)) fs.mkdirSync(zayloDir, { recursive: true });
      const meta = {
        name: 'Zaylo AI Server',
        version: '4.0.0',
        port: this.config.port,
        host: '127.0.0.1',
        pid: process.pid,
        activeModel: this.inferenceService.getModelName() || null,
        startedAt: new Date().toISOString(),
        endpoints: {
          health: '/health',
          models: '/v1/models',
          agents: '/v1/agents',
          chat: '/v1/chat/completions',
        },
      };
      fs.writeFileSync(path.join(zayloDir, 'server.json'), JSON.stringify(meta, null, 2), 'utf8');
    } catch {}
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    try {
      const serverJson = path.join(os.homedir(), '.zaylo', 'server.json');
      if (fs.existsSync(serverJson)) fs.unlinkSync(serverJson);
    } catch {}
    await this.fastify.close();
    this.isRunning = false;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }
}
