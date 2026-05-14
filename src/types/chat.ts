export type ChatRole = 'user' | 'assistant' | 'tool';

export interface ToolCallFunction {
  name: string;
  arguments: string; // JSON string
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: ToolCallFunction;
}

export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string; // only for role: 'tool'
}

export interface ChatResponse {
  role: 'assistant';
  content: string | null;
  tool_calls?: ToolCall[];
}
