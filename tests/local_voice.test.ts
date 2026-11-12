import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { decodeVoiceAudio, LocalVoice } from '../apps/desktop/electron/voice/localVoice';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(p => fs.rm(p, { recursive: true, force: true }))); });

async function fixture(ready = false) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zaylo-voice-test-')); directories.push(root);
  if (ready) {
    const voiceRoot = path.join(root, 'local-voice');
    const bin = process.platform === 'win32' ? path.join(voiceRoot, 'venv', 'Scripts', 'python.exe') : path.join(voiceRoot, 'venv', 'bin', 'python');
    await fs.mkdir(path.dirname(bin), { recursive: true });
    // Cancellation tests must never execute this sentinel file.
    await fs.writeFile(bin, 'This must never be executed');
    await fs.writeFile(path.join(voiceRoot, 'ready'), '1.2.1');
  }
  return new LocalVoice(root);
}

describe('local voice input and cancellation boundaries', () => {
  it('rejects malformed base64 and oversized recordings before starting any process', () => {
    for (const value of [null, {}, '', 'not base64!', 'AAAA=', 'AA==', 'A'.repeat(30 * 1024 * 1024)]) {
      expect(() => decodeVoiceAudio(value)).toThrow();
    }
    const buffer = Buffer.alloc(100, 7);
    expect(decodeVoiceAudio(buffer.toString('base64'))).toEqual(buffer);
  });
  it('reports missing setup honestly and does not create files during status checks', async () => {
    const voice = await fixture();
    expect(await voice.status()).toMatchObject({ ready: false, installing: false });
    expect(await fs.readdir(directories[0])).toEqual([]);
    await expect(voice.transcribe(Buffer.alloc(100).toString('base64'))).rejects.toThrow(/Set up/);
  });
  it('cancels a pending transcription before the sentinel Python process can start', async () => {
    const voice = await fixture(true);
    const pending = voice.transcribe(Buffer.alloc(100).toString('base64'));
    voice.cancel();
    await expect(pending).rejects.toThrow(/cancelled/);
    expect((await voice.status()).ready).toBe(true);
  });
  it('cancels setup before provisioning dependencies when cancellation races readiness checks', async () => {
    const voice = await fixture();
    const pending = voice.setup();
    voice.cancel();
    await expect(pending).rejects.toThrow(/cancelled/);
    expect(await fs.readdir(directories[0])).toEqual([]);
  });
});
