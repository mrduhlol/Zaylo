import type { ChatPdfRequest, ChatPdfResult } from '@local-ai/protocol';
import { api } from './client';

type ExportConversation = {
  title: string;
  messages: Array<{
    role: string;
    content: string | Array<{ type: string; text?: string }>;
  }>;
};

/** Export text and attachment labels locally; attachment URLs are never resolved. */
export function chatPdfRequest(conversation: ExportConversation): ChatPdfRequest {
  return {
    title: conversation.title,
    messages: conversation.messages.map(message => ({
      role: message.role,
      text: typeof message.content === 'string' ? message.content : message.content.map(part =>
        part.type === 'text' ? (part.text ?? '') : part.type === 'image_url' ? '[Image attachment]' : '[Attachment]'
      ).join('\n'),
    })),
  };
}

/** Invoke from an explicit user action so the native save dialog is expected. */
export async function exportChatPdf(conversation: ExportConversation): Promise<ChatPdfResult> {
  const result = await api.invoke('chat:export-pdf', chatPdfRequest(conversation));
  if (!result) throw new Error('PDF export is available in the desktop app.');
  return result;
}
