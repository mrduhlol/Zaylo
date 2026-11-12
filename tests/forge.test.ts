import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import { execSync } from 'node:child_process';

vi.mock('node:child_process', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:child_process')>(),
  execSync: vi.fn(),
}));
import fs from 'node:fs';
import os from 'node:os';
import { createDatabaseAsync, TrainingJobRepository, FineTunedModelRepository } from '@local-ai/database';
import { ModelInspector } from '../apps/desktop/electron/forge/modelInspector.js';
import { DatasetParser } from '../apps/desktop/electron/forge/datasetParser.js';
import { AutoConfigurator } from '../apps/desktop/electron/forge/autoConfig.js';
import { PreflightValidator } from '../apps/desktop/electron/forge/preflightValidator.js';
import { PythonDetector } from '../apps/desktop/electron/forge/pythonDetector.js';
import type {
  ModelInstallation,
  TrainingConfig,
  HardwareProfile,
  TrainingJob,
  FineTunedModelArtifact,
} from '@local-ai/shared';

describe('Forge In-App Fine-Tuning Studio Tests', () => {
  const tempDir = path.join(os.tmpdir(), `forge_test_${Date.now()}`);
  let dbConn: any;
  let jobRepo: TrainingJobRepository;
  let artifactRepo: FineTunedModelRepository;

  beforeAll(async () => {
    fs.mkdirSync(tempDir, { recursive: true });
    const dbPath = path.join(tempDir, 'test.sqlite');
    dbConn = await createDatabaseAsync(dbPath);
    jobRepo = new TrainingJobRepository(dbConn.raw);
    artifactRepo = new FineTunedModelRepository(dbConn.raw);
  });

  afterAll(() => {
    try {
      dbConn?.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(() => {
    vi.mocked(execSync).mockReset();
    vi.mocked(execSync).mockReturnValue(JSON.stringify({
      success: true, torch: '2.5.0', transformers: '4.46.0', peft: '0.13.0', mps: false, cuda: false,
    }));
    PythonDetector.detect(true);
  });

  afterEach(() => vi.restoreAllMocks());

  // 1. Python Environment Detection
  it('should detect python 3 with PyTorch, Transformers, and PEFT', () => {
    const pyInfo = PythonDetector.detect(true);
    expect(pyInfo.available).toBe(true);
    expect(pyInfo.pythonPath).toBeDefined();
    expect(pyInfo.versions?.torch).toBeDefined();
    expect(pyInfo.versions?.transformers).toBeDefined();
    expect(pyInfo.versions?.peft).toBeDefined();
  }, 15000);

  it('reports unavailable Python environments and retries later candidates', () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error('Python unavailable'); });
    expect(PythonDetector.detect(true)).toMatchObject({ available: false });
    vi.mocked(execSync).mockReset();
    vi.mocked(execSync)
      .mockImplementationOnce(() => { throw new Error('First candidate unavailable'); })
      .mockReturnValue(JSON.stringify({ success: true, torch: '2.5', transformers: '4.46', peft: '0.13' }));
    expect(PythonDetector.detect(true).available).toBe(true);
    expect(execSync).toHaveBeenCalledTimes(2);
  });

  // 2. Model Inspection & Compatibility Analysis
  it('should inspect installed GGUF models and detect checkpoint requirement', () => {
    const dummyGguf: ModelInstallation = {
      id: 'inst_smollm2_dummy',
      modelId: 'smollm2-135m',
      variantId: 'q8_0',
      name: 'SmolLM2 135M Instruct',
      localPath: '/tmp/nonexistent/SmolLM2-135M-Instruct-Q8_0.gguf',
      sizeBytes: 144811360,
      installedAt: Date.now(),
      isLoaded: false,
      format: 'gguf',
      quantization: 'Q8_0',
      contextLength: 4096,
    };

    vi.spyOn(ModelInspector, 'findLocalHfCheckpoint').mockReturnValue(null);
    const inspection = ModelInspector.inspectModel(dummyGguf);
    expect(inspection.modelId).toBe('smollm2-135m');
    expect(inspection.format).toBe('gguf');
    expect(inspection.supportedBackends).toContain('peft');

    expect(inspection.status).toBe('REQUIRES_CHECKPOINT');
    expect(inspection.hfRepoId).toBe('HuggingFaceTB/SmolLM2-135M-Instruct');

    vi.mocked(ModelInspector.findLocalHfCheckpoint).mockReturnValue(tempDir);
    const ready = ModelInspector.inspectModel(dummyGguf);
    expect(ready.status).toBe('READY');
    expect(ready.checkpointPath).toBe(tempDir);

    vi.mocked(execSync).mockReturnValue(JSON.stringify({ success: false, error: 'No module named torch' }));
    PythonDetector.detect(true);
    const missing = ModelInspector.inspectModel(dummyGguf);
    expect(missing.status).toBe('MISSING_DEPENDENCIES');
    expect(missing.statusReason).toContain('No module named torch');
  });

  // 3. Dataset Parsing & Validation
  it('should parse and validate JSONL instruction datasets', () => {
    const jsonlPath = path.join(tempDir, 'test_dataset.jsonl');
    const records = [
      { instruction: 'Translate hello to French', input: '', output: 'Bonjour' },
      { instruction: 'Summarize quantum computing', input: '', output: 'Quantum computing uses qubits...' },
      { prompt: 'What is 2+2?', completion: '4' },
      { instruction: 'Translate hello to French', input: '', output: 'Bonjour' }, // duplicate
      { invalid: 'missing fields' }, // invalid
    ];
    fs.writeFileSync(jsonlPath, records.map((r) => JSON.stringify(r)).join('\n') + '\n');

    const analysis = DatasetParser.parseFile(jsonlPath);
    expect(analysis.totalRecords).toBe(5);
    expect(analysis.validRecords).toBe(4);
    expect(analysis.invalidRecords).toBe(1);
    expect(analysis.duplicateRecords).toBe(1);
    expect(analysis.exampleRecords.length).toBeGreaterThan(0);
    expect(analysis.tokenLengthDistribution.min).toBeGreaterThan(0);
    expect(analysis.tokenLengthDistribution.p95).toBeGreaterThanOrEqual(analysis.tokenLengthDistribution.min);
  });

  it('should parse CSV datasets and support column mapping', () => {
    const csvPath = path.join(tempDir, 'test_dataset.csv');
    const csvContent = `user_query,system_reply\n"How does DNS work?","DNS translates domain names to IPs."\n"What is RAM?","Random Access Memory."\n`;
    fs.writeFileSync(csvPath, csvContent);

    const analysis = DatasetParser.parseFile(csvPath, {
      promptColumn: 'user_query',
      completionColumn: 'system_reply',
    });

    expect(analysis.validRecords).toBe(2);
    expect(analysis.exampleRecords[0].prompt).toBe('How does DNS work?');
    expect(analysis.exampleRecords[0].response).toBe('DNS translates domain names to IPs.');
  });

  it('should auto-parse arbitrary CSV datasets with fallback heuristics', () => {
    const csvPath = path.join(tempDir, 'arbitrary_form.csv');
    const csvContent = `"Timestamp","Full Name","Semester","Email Address","WhatsApp Number"\n"2026/09/21 11:57:23 AM","Sinchana","3rd sem","gsinchan2007@gmail.com","9740523841"\n"2026/09/21 12:01:49 PM","Sneha B R","5","snehabanahatti213@gmail.com","8310742101"\n`;
    fs.writeFileSync(csvPath, csvContent);

    const analysis = DatasetParser.parseFile(csvPath);
    expect(analysis.validRecords).toBe(2);
    expect(analysis.exampleRecords.length).toBe(2);
    expect(analysis.exampleRecords[0].prompt).toBeDefined();
    expect(analysis.exampleRecords[0].response).toBeDefined();
  });

  it('should create built-in sample datasets out of the box', () => {
    const sample = DatasetParser.createSampleDataset('instruction');
    expect(fs.existsSync(sample.filePath)).toBe(true);
    expect(sample.analysis.validRecords).toBe(5);
  });

  // 4. Auto Configuration & Hardware Profiling
  it('should generate hardware-safe LoRA configurations', () => {
    const mockHw: HardwareProfile = {
      platform: 'darwin',
      osRelease: '25.2.0',
      hostname: 'test-mac',
      cpu: {
        model: 'Intel Core i7',
        architecture: 'x64',
        physicalCores: 6,
        logicalThreads: 12,
      },
      memory: {
        totalBytes: 16 * 1024 * 1024 * 1024,
        availableBytes: 10 * 1024 * 1024 * 1024,
        usedBytes: 6 * 1024 * 1024 * 1024,
      },
      gpus: [],
      disks: [
        {
          mount: '/',
          totalBytes: 500 * 1024 * 1024 * 1024,
          availableBytes: 100 * 1024 * 1024 * 1024,
          usedBytes: 400 * 1024 * 1024 * 1024,
        },
      ],
      detectedAt: Date.now(),
    };

    const sample = DatasetParser.createSampleDataset('instruction');
    const mockModel = {
      modelId: 'smollm2-135m',
      variantId: 'q8_0',
      name: 'SmolLM2 135M',
      format: 'safetensors' as const,
      quantization: 'None' as const,
      sizeBytes: 269000000,
      localPath: '/tmp/checkpoint',
      status: 'READY' as const,
      supportedBackends: ['peft' as const],
    };

    const { config, estimates } = AutoConfigurator.generateConfig({
      model: mockModel,
      dataset: sample.analysis,
      hwProfile: mockHw,
    });

    expect(config.method).toBe('lora');
    expect(config.backend).toBe('peft');
    expect(config.loraRank).toBe(16);
    expect(config.loraAlpha).toBe(32);
    expect(config.learningRate).toBe(2e-4);
    expect(config.batchSize).toBe(1);
    expect(estimates.isFeasible).toBe(true);
    expect(estimates.estimatedMemoryBytes).toBeLessThan(mockHw.memory.availableBytes);
  });

  // 5. Preflight Validation
  it('should fail preflight when checkpoint path does not exist', () => {
    const invalidConfig: TrainingConfig = {
      jobId: 'job_test',
      jobName: 'Test Job',
      modelId: 'smollm2-135m',
      modelName: 'SmolLM2',
      checkpointPath: '/tmp/nonexistent/directory/xyz',
      datasetPath: path.join(tempDir, 'test_dataset.jsonl'),
      datasetName: 'test_dataset.jsonl',
      objective: 'instruction',
      method: 'lora',
      backend: 'peft',
      learningRate: 2e-4,
      loraRank: 8,
      loraAlpha: 16,
      loraDropout: 0.05,
      targetModules: ['q_proj', 'v_proj'],
      batchSize: 1,
      gradientAccumulationSteps: 4,
      maxSeqLength: 256,
      epochs: 3,
      optimizer: 'AdamW',
      precision: 'float32',
      warmupRatio: 0.05,
      weightDecay: 0.01,
      saveSteps: 10,
      trainValSplit: 0.1,
      outputDir: path.join(tempDir, 'output'),
    };

    const preflight = PreflightValidator.validate(invalidConfig);
    expect(preflight.canProceed).toBe(false);
    const modelCheck = preflight.checks.find((c) => c.category === 'model');
    expect(modelCheck?.status).toBe('failed');
  });

  // 6. Database Persistence & Job Recovery
  it('should persist training jobs and recover interrupted runs', () => {
    const job: TrainingJob = {
      id: 'job_test_recovery',
      name: 'SmolLM2 Test Run',
      modelId: 'smollm2-135m',
      modelName: 'SmolLM2 135M',
      checkpointPath: '/tmp/checkpoint',
      datasetPath: '/tmp/dataset.jsonl',
      datasetRecords: 10,
      status: 'TRAINING',
      config: {} as any,
      estimates: {} as any,
      currentStep: 5,
      totalSteps: 20,
      currentEpoch: 1,
      totalEpochs: 3,
      currentLoss: 2.15,
      metricsHistory: [
        {
          step: 5,
          totalSteps: 20,
          epoch: 1,
          totalEpochs: 3,
          loss: 2.15,
          elapsedSeconds: 10,
          timestamp: Date.now(),
        },
      ],
      recentLogs: ['[INFO] Training started'],
      checkpoints: [],
      outputDir: '/tmp/output',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    jobRepo.createJob(job);
    const retrieved = jobRepo.getJob('job_test_recovery');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.status).toBe('TRAINING');
    expect(retrieved?.currentStep).toBe(5);

    // Simulate app restart recovery
    jobRepo.recoverInterruptedJobs();
    const recovered = jobRepo.getJob('job_test_recovery');
    expect(recovered?.status).toBe('PAUSED');
    expect(recovered?.error).toContain('preserved');
  });

  // 7. Fine-Tuned Model Artifact Management
  it('should register, list, and delete trained model artifacts', () => {
    const artifact: FineTunedModelArtifact = {
      id: 'art_test_1',
      jobId: 'job_test_recovery',
      name: 'SmolLM2 Instruction Adapter',
      baseModelId: 'smollm2-135m',
      baseModelName: 'SmolLM2 135M Instruct',
      type: 'lora',
      artifactPath: path.join(tempDir, 'adapter'),
      sizeBytes: 15000000,
      format: 'safetensors',
      compatibilityStatus: 'ready',
      finalLoss: 1.45,
      trainingDurationSeconds: 120,
      createdAt: Date.now(),
    };

    artifactRepo.registerModel(artifact);
    const all = artifactRepo.getAllModels();
    expect(all.length).toBeGreaterThan(0);
    expect(all.find((a) => a.id === 'art_test_1')).toBeDefined();

    const deleted = artifactRepo.deleteModel('art_test_1');
    expect(deleted).toBe(true);
    expect(artifactRepo.getModel('art_test_1')).toBeNull();
  });

  // 8. Live Training Studio Telemetry & Checkpoints Verification
  it('should persist detailed telemetry metrics (loss, gradNorm, tokenAccuracy, learningRate) and checkpoints', () => {
    const jobWithMetrics: TrainingJob = {
      id: 'job_test_telemetry',
      name: 'SmolLM2 Telemetry Studio Run',
      modelId: 'smollm2-135m',
      modelName: 'SmolLM2 135M',
      checkpointPath: '/tmp/checkpoint',
      datasetPath: path.join(tempDir, 'test_dataset.jsonl'),
      datasetRecords: 4,
      status: 'TRAINING',
      config: {
        jobId: 'job_test_telemetry',
        jobName: 'SmolLM2 Telemetry Studio Run',
        modelId: 'smollm2-135m',
        modelName: 'SmolLM2 135M',
        checkpointPath: '/tmp/checkpoint',
        datasetPath: path.join(tempDir, 'test_dataset.jsonl'),
        datasetName: 'test_dataset.jsonl',
        objective: 'instruction',
        method: 'lora',
        backend: 'peft',
        learningRate: 2e-4,
        loraRank: 16,
        loraAlpha: 32,
        loraDropout: 0.05,
        targetModules: ['q_proj', 'v_proj'],
        batchSize: 1,
        gradientAccumulationSteps: 1,
        maxSeqLength: 128,
        epochs: 3,
        optimizer: 'adamw_torch',
        precision: 'float32',
        warmupRatio: 0.05,
        weightDecay: 0.01,
        saveSteps: 5,
        trainValSplit: 0.1,
        outputDir: path.join(tempDir, 'telemetry_output'),
      },
      estimates: {} as any,
      currentStep: 5,
      totalSteps: 10,
      currentEpoch: 1,
      totalEpochs: 3,
      currentLoss: 1.25,
      metricsHistory: [
        {
          step: 1,
          totalSteps: 10,
          epoch: 1,
          totalEpochs: 3,
          loss: 3.5,
          evalLoss: undefined,
          learningRate: 0.0002,
          gradNorm: 1.45,
          tokenAccuracy: 0.42,
          tokensPerSec: 65.4,
          elapsedSeconds: 2.1,
          estimatedRemainingSeconds: 18.9,
          timestamp: Date.now() - 5000,
        },
        {
          step: 5,
          totalSteps: 10,
          epoch: 1,
          totalEpochs: 3,
          loss: 1.25,
          evalLoss: 1.38,
          learningRate: 0.0001,
          gradNorm: 0.32,
          tokenAccuracy: 0.86,
          tokensPerSec: 72.1,
          elapsedSeconds: 8.5,
          estimatedRemainingSeconds: 8.5,
          timestamp: Date.now(),
        },
      ],
      recentLogs: [
        '[INFO] Loading base model weights',
        '[STEP] Step 1: loss=3.5000 lr=0.0002 grad_norm=1.450 acc=42.0%',
        '[CKPT] Checkpoint saved: checkpoint-5 (3.7 MB)',
      ],
      checkpoints: [
        {
          step: 5,
          path: path.join(tempDir, 'telemetry_output', 'checkpoint-5'),
          loss: 1.25,
          sizeBytes: 3700000,
          createdAt: Date.now(),
          recoverable: true,
        },
      ],
      outputDir: path.join(tempDir, 'telemetry_output'),
      createdAt: Date.now() - 10000,
      updatedAt: Date.now(),
    };

    jobRepo.createJob(jobWithMetrics);

    const fetched = jobRepo.getJob('job_test_telemetry');
    expect(fetched).not.toBeNull();
    expect(fetched?.metricsHistory.length).toBe(2);
    expect(fetched?.metricsHistory[1].gradNorm).toBe(0.32);
    expect(fetched?.metricsHistory[1].tokenAccuracy).toBe(0.86);
    expect(fetched?.metricsHistory[1].evalLoss).toBe(1.38);
    expect(fetched?.checkpoints.length).toBe(1);
    expect(fetched?.checkpoints[0].step).toBe(5);
    expect(fetched?.checkpoints[0].sizeBytes).toBe(3700000);
    expect(fetched?.checkpoints[0].recoverable).toBe(true);
  });
});
