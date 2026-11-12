import { app, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { LocalVoice } from './localVoice.js';

export function registerVoiceHandlers(window: BrowserWindow): () => void {
  const voice = new LocalVoice(app.getPath('userData'));
  const trusted = (event: IpcMainInvokeEvent) => {
    if (window.isDestroyed() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
      throw new Error('Local voice requests must come from the app window.');
    }
  };
  ipcMain.handle('voice:status', event => { trusted(event); return voice.status(); });
  ipcMain.handle('voice:setup', async event => { trusted(event); await voice.setup(); return voice.status(); });
  ipcMain.handle('voice:transcribe', (event, request: unknown) => {
    trusted(event);
    if (!request || typeof request !== 'object') throw new Error('Missing recording.');
    return voice.transcribe((request as { audioBase64?: unknown }).audioBase64);
  });
  ipcMain.handle('voice:cancel', event => { trusted(event); voice.cancel(); return true; });
  return () => {
    voice.cancel();
    for (const name of ['voice:status', 'voice:setup', 'voice:transcribe', 'voice:cancel']) ipcMain.removeHandler(name);
  };
}
