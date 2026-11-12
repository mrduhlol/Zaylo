import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handle: vi.fn(), removeHandler: vi.fn(), save: vi.fn(), write: vi.fn(),
  load: vi.fn(), print: vi.fn(), destroy: vi.fn(), create: vi.fn(),
}));
vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle, removeHandler: mocks.removeHandler },
  dialog: { showSaveDialog: mocks.save },
  BrowserWindow: class {
    constructor(options: unknown) { mocks.create(options); }
    webContents = { setWindowOpenHandler: vi.fn(), on: vi.fn(), printToPDF: mocks.print };
    loadURL = mocks.load;
    isDestroyed = () => false;
    destroy = mocks.destroy;
  },
}));
vi.mock('node:fs/promises', () => ({ writeFile: mocks.write }));
import { chatPdfHtml, registerPdfHandlers, validatePdfRequest } from '../apps/desktop/electron/export/registerPdfHandlers';
import { chatPdfRequest } from '../apps/desktop/src/api/exportChatPdf';

const chat = { title: 'Private chat', messages: [{ role: 'user', text: 'hello' }] };
const window = { isDestroyed: () => false, webContents: { mainFrame: {} } };
const event = () => ({ sender: window.webContents, senderFrame: window.webContents.mainFrame });
const handler = () => mocks.handle.mock.calls[0][1];

beforeEach(() => { vi.clearAllMocks(); mocks.print.mockResolvedValue(Buffer.from('PDF')); });
describe('offline chat PDF export', () => {
  it('escapes active markup in titles, roles and text with a restrictive CSP', () => {
    const html = chatPdfHtml({ title: '<script>alert(1)</script>', messages: [{ role: '<img src="https://x">', text: '<svg onload="x"> & \'quoted\'' }] });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;svg onload=&quot;x&quot;&gt; &amp; &#39;quoted&#39;');
    expect(html).toContain("default-src 'none'");
  });
  it('rejects malformed and oversized payloads', () => {
    for (const value of [null, {}, { ...chat, title: 1 }, { ...chat, messages: [null] },
      { ...chat, messages: [{ role: 'user', text: 'x'.repeat(2_000_001) }] },
      { ...chat, messages: Array(10001).fill(chat.messages[0]) }]) {
      expect(() => validatePdfRequest(value)).toThrow();
    }
    expect(validatePdfRequest(chat)).toEqual(chat);
  });
  it('converts attachments to labels without their URLs', () => {
    const request = chatPdfRequest({ title: 't', messages: [{ role: 'user', content: [
      { type: 'text', text: 'hello' }, { type: 'image_url' }, { type: 'file' },
    ] }] });
    expect(request.messages[0].text).toBe('hello\n[Image attachment]\n[Attachment]');
  });
  it('rejects foreign senders and child frames before showing dialogs', async () => {
    registerPdfHandlers(window as never);
    await expect(handler()({ ...event(), sender: {} }, chat)).rejects.toThrow();
    await expect(handler()({ ...event(), senderFrame: {} }, chat)).rejects.toThrow();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('cancels without creating a print window or writing', async () => {
    registerPdfHandlers(window as never);
    mocks.save.mockResolvedValue({ canceled: true });
    await expect(handler()(event(), chat)).resolves.toEqual({ canceled: true });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('prints in an unfocusable sandboxed window then destroys it', async () => {
    const stop = registerPdfHandlers(window as never);
    mocks.save.mockResolvedValue({ canceled: false, filePath: '/tmp/chosen.pdf' });
    await expect(handler()(event(), chat)).resolves.toEqual({ canceled: false, filePath: '/tmp/chosen.pdf' });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ show: false, focusable: false,
      webPreferences: expect.objectContaining({ sandbox: true, javascript: false, nodeIntegration: false }) }));
    expect(mocks.load.mock.calls[0][0]).toMatch(/^data:text\/html/);
    expect(mocks.write).toHaveBeenCalledWith('/tmp/chosen.pdf', Buffer.from('PDF'));
    expect(mocks.destroy).toHaveBeenCalledOnce();
    stop();
    expect(mocks.removeHandler).toHaveBeenCalledWith('chat:export-pdf');
  });
  it('cleans up after printing fails and permits a retry', async () => {
    registerPdfHandlers(window as never);
    mocks.save.mockResolvedValue({ canceled: false, filePath: '/tmp/chat.pdf' });
    mocks.print.mockRejectedValueOnce(new Error('printer failed'));
    await expect(handler()(event(), chat)).rejects.toThrow('printer failed');
    expect(mocks.destroy).toHaveBeenCalledOnce();
    await expect(handler()(event(), chat)).resolves.toHaveProperty('canceled', false);
  });
});
