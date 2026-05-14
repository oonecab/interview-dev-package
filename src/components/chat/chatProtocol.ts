import type { ChatMessage, ToolCall } from '../../types/chat';

// ---------- Display message type ----------

export interface ChatDisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool-status';
  content: string;
  // Tool status fields (only for role === 'tool-status')
  toolCallId?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolStatus?: 'running' | 'success' | 'error';
  toolResultSummary?: string;
  toolError?: string;
  // Stores the full tool_calls array from the assistant response,
  // only on the first tool-status message in a batch.
  toolCallsBatch?: ToolCall[];
}

// ---------- Welcome message ----------

export const WELCOME_MESSAGE: ChatDisplayMessage = {
  id: 'welcome',
  role: 'assistant' as const,
  content:
    '你好！我是智慧空间 AI 助手，可以帮你：\n\n· 查询设备状态\n· 查看告警信息\n· 创建维修工单\n\n请问有什么需要帮助的？',
};

// ---------- ID generator ----------

let messageIdCounter = 0;
export function nextId(): string {
  return `msg_${++messageIdCounter}`;
}

// ---------- Protocol builder ----------

/**
 * Build apiMessages from display messages for sending to /api/chat.
 *
 * Rules:
 * - Skips the welcome message (never sent to backend).
 * - user / assistant text messages → { role, content }.
 * - Consecutive tool-status messages are rebuilt into:
 *   1. An assistant message with tool_calls (from the first card's toolCallsBatch).
 *   2. One tool result message per card (role: "tool", tool_call_id, content).
 */
export function buildApiMessages(displayMsgs: ChatDisplayMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  let i = 0;
  while (i < displayMsgs.length) {
    const dm = displayMsgs[i];
    if (dm.id === 'welcome') {
      i++;
      continue;
    }

    if (dm.role === 'user') {
      result.push({ role: 'user', content: dm.content });
      i++;
    } else if (dm.role === 'assistant') {
      result.push({ role: 'assistant', content: dm.content });
      i++;
    } else if (dm.role === 'tool-status') {
      const batch: ChatDisplayMessage[] = [];
      while (i < displayMsgs.length && displayMsgs[i].role === 'tool-status') {
        batch.push(displayMsgs[i]);
        i++;
      }
      if (batch[0]?.toolCallsBatch && batch[0].toolCallsBatch.length > 0) {
        result.push({
          role: 'assistant',
          content: null,
          tool_calls: batch[0].toolCallsBatch,
        });
      }
      for (const ts of batch) {
        result.push({
          role: 'tool',
          tool_call_id: ts.toolCallId!,
          content: ts.content || '',
        });
      }
    }
  }
  return result;
}
