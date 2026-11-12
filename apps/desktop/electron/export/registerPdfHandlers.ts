import { BrowserWindow, dialog, ipcMain } from 'electron';
import { writeFile } from 'node:fs/promises';
import type { ChatPdfRequest, ChatPdfResult } from '@local-ai/protocol';

export function validatePdfRequest(value: unknown): ChatPdfRequest {
  if (!value || typeof value !== 'object') throw new Error('Missing chat.');
  const request = value as ChatPdfRequest;
  if (typeof request.title !== 'string' || request.title.length > 500 ||
      !Array.isArray(request.messages) || request.messages.length > 10000) throw new Error('Invalid chat.');
  let size = request.title.length;
  for (const message of request.messages) {
    if (!message || typeof message.role !== 'string' || message.role.length > 100 ||
        typeof message.text !== 'string') throw new Error('Invalid message.');
    size += message.role.length + message.text.length;
    if (size > 2_000_000) throw new Error('Chat is too large to export.');
  }
  return request;
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

export function chatPdfHtml(request: ChatPdfRequest): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(request.title)}</title><style>body{font:12pt sans-serif;line-height:1.5;color:#111;margin:0}h1{font-size:22pt}h2{font-size:13pt;break-after:avoid}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}article{margin-bottom:24px}</style></head><body><h1>${escapeHtml(request.title)}</h1>${request.messages.map(message => `<article><h2>${escapeHtml(message.role)}</h2><pre>${escapeHtml(message.text)}</pre></article>`).join('')}</body></html>`;
}

export function registerPdfHandlers(window: BrowserWindow): () => void {
  let active = false;
  let disposed = false;
  let printer: BrowserWindow | undefined;
  ipcMain.handle('chat:export-pdf', async (event, value: unknown): Promise<ChatPdfResult> => {
    if (disposed || window.isDestroyed() || event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame) throw new Error('PDF export must come from the app window.');
    const request = validatePdfRequest(value);
    if (active) throw new Error('A PDF export is already in progress.');
    active = true;
    try {
      const filename = request.title.replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 100) || 'Chat';
      const result = await dialog.showSaveDialog(window, {
        title: 'Export chat as PDF', defaultPath: `${filename}.pdf`,
        filters: [{ name: 'PDF document', extensions: ['pdf'] }],
      });
      if (result.canceled || !result.filePath || disposed || window.isDestroyed()) return { canceled: true };
      const filePath = /\.pdf$/i.test(result.filePath) ? result.filePath : `${result.filePath}.pdf`;
      printer = new BrowserWindow({
        show: false, focusable: false, skipTaskbar: true,
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false },
      });
      printer.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      printer.webContents.on('will-navigate', event => event.preventDefault());
      await printer.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(chatPdfHtml(request))}`);
      const pdf = await printer.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
      if (disposed || window.isDestroyed()) return { canceled: true };
      await writeFile(filePath, pdf);
      return { canceled: false, filePath };
    } finally {
      if (printer && !printer.isDestroyed()) printer.destroy();
      printer = undefined;
      active = false;
    }
  });
  return () => {
    disposed = true;
    ipcMain.removeHandler('chat:export-pdf');
    if (printer && !printer.isDestroyed()) printer.destroy();
  };
}
