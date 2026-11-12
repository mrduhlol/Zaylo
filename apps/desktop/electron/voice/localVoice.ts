import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const ASR_VERSION = '1.2.1';
const AUDIO_DECODER_VERSION = '16.0.1';
export const VOICE_RUNTIME_VERSION = `faster-whisper=${ASR_VERSION};av=${AUDIO_DECODER_VERSION}`;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const setupScript = `from faster_whisper import WhisperModel
import sys
WhisperModel("tiny", device="cpu", compute_type="int8", download_root=sys.argv[1])
print("Voice model ready")`;
const transcribeScript = `from faster_whisper import WhisperModel
import sys, json
model = WhisperModel("tiny", device="cpu", compute_type="int8", download_root=sys.argv[1], local_files_only=True)
segments, info = model.transcribe(sys.argv[2], beam_size=3, vad_filter=True)
print(json.dumps({"text": " ".join(s.text.strip() for s in segments).strip(), "language": info.language}))`;

export function decodeVoiceAudio(base64: unknown): Buffer {
  if (typeof base64 !== 'string' || base64.length > Math.ceil(MAX_AUDIO_BYTES * 4 / 3) + 4 ||
      !base64.length || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    throw new Error('Invalid audio recording, or recording exceeds 20 MB.');
  }
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length < 44 || buffer.length > MAX_AUDIO_BYTES || buffer.toString('base64') !== base64) {
    throw new Error('Invalid audio recording.');
  }
  return buffer;
}

/** All recordings remain local. Network access is confined to explicit setup. */
export class LocalVoice {
  private setupPromise?: Promise<void>;
  private active?: AbortController;
  private generation = 0;
  private readonly root: string;
  private readonly python: string;
  private readonly models: string;
  constructor(userData: string) {
    this.root = path.join(userData, 'local-voice');
    this.python = process.platform === 'win32' ? path.join(this.root, 'venv', 'Scripts', 'python.exe') : path.join(this.root, 'venv', 'bin', 'python');
    this.models = path.join(this.root, 'models');
  }
  private run(command: string, args: string[], signal?: AbortSignal, offline = false, timeout = 120000): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        shell: false, windowsHide: true, signal,
        env: { ...process.env, PYTHONNOUSERSITE: '1', PYTHONUNBUFFERED: '1', HF_HUB_DISABLE_TELEMETRY: '1',
          ...(offline ? { HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1', HF_DATASETS_OFFLINE: '1' } : {}) },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '', error = '';
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
      child.stdout.on('data', data => { output = (output + data.toString()).slice(-1024 * 1024); });
      child.stderr.on('data', data => { error = (error + data.toString()).slice(-16000); });
      child.once('error', e => { clearTimeout(timer); reject(e); });
      child.once('close', code => {
        clearTimeout(timer);
        if (timedOut) reject(new Error('Local voice operation timed out. Retry or cancel.'));
        else if (signal?.aborted) reject(new Error('Local voice operation cancelled.'));
        else if (code !== 0) reject(new Error(error.trim().slice(-1600) || 'Local voice operation failed.'));
        else resolve(output.trim());
      });
    });
  }
  async status(): Promise<{ ready: boolean; installing: boolean; model: string }> {
    const ready = await fs.readFile(path.join(this.root, 'ready'), 'utf8').then(value => value.trim() === VOICE_RUNTIME_VERSION, () => false);
    const pythonExists = await fs.access(this.python).then(() => true, () => false);
    return { ready: ready && pythonExists, installing: Boolean(this.setupPromise), model: 'Whisper tiny · local CPU' };
  }
  async setup(): Promise<void> {
    const generation = this.generation;
    if ((await this.status()).ready) return;
    if (generation !== this.generation) throw new Error('Voice setup cancelled.');
    if (this.setupPromise) return this.setupPromise;
    if (this.active) throw new Error('Another voice operation is still running.');
    const controller = new AbortController(); this.active = controller;
    this.setupPromise = (async () => {
      await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
      let python: string | undefined;
      for (const candidate of process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3.13', 'python3.12', 'python3.11', 'python3', 'python']) {
        try {
          await this.run(candidate, ['-c', 'import sys; assert (3,9) <= sys.version_info[:2] < (3,14)'], controller.signal, true, 10000);
          python = candidate; break;
        } catch { if (controller.signal.aborted) throw new Error('Voice setup cancelled.'); }
      }
      if (!python) throw new Error('Install Python 3.9–3.13 with venv support, then retry local voice setup.');
      await this.run(python, ['-m', 'venv', path.join(this.root, 'venv')], controller.signal);
      await this.run(this.python, ['-m', 'pip', 'install', '--disable-pip-version-check', `faster-whisper==${ASR_VERSION}`, `av==${AUDIO_DECODER_VERSION}`], controller.signal, false, 900000);
      await fs.mkdir(this.models, { recursive: true, mode: 0o700 });
      await this.run(this.python, ['-c', setupScript, this.models], controller.signal, false, 900000);
      await fs.writeFile(path.join(this.root, 'ready'), `${VOICE_RUNTIME_VERSION}\n`, { mode: 0o600 });
    })();
    try { await this.setupPromise; } finally { this.setupPromise = undefined; if (this.active === controller) this.active = undefined; }
  }
  async transcribe(base64: unknown): Promise<{ text: string; language: string }> {
    const generation = this.generation;
    const audio = decodeVoiceAudio(base64);
    if (!(await this.status()).ready) throw new Error('Set up the local voice model first.');
    if (generation !== this.generation) throw new Error('Local voice operation cancelled.');
    if (this.active) throw new Error('Another voice operation is still running.');
    const controller = new AbortController(); this.active = controller;
    let directory: string | undefined;
    try {
      directory = await fs.mkdtemp(path.join(os.tmpdir(), 'zaylo-voice-'));
      const file = path.join(directory, 'recording.audio');
      await fs.writeFile(file, audio, { mode: 0o600 });
      const result = await this.run(this.python, ['-c', transcribeScript, this.models, file], controller.signal, true, 300000);
      const line = result.split('\n').reverse().find(v => v.startsWith('{'));
      if (!line) throw new Error('Local transcription did not return text.');
      const data: unknown = JSON.parse(line);
      if (!data || typeof data !== 'object' || typeof (data as { text?: unknown }).text !== 'string' || typeof (data as { language?: unknown }).language !== 'string') throw new Error('Unexpected local transcription response.');
      return data as { text: string; language: string };
    } finally {
      try { if (directory) await fs.rm(directory, { recursive: true, force: true }); }
      finally { if (this.active === controller) this.active = undefined; }
    }
  }
  cancel(): void { this.generation++; this.active?.abort(); }
}
