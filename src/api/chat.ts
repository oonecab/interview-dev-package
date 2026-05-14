import { api } from './client';
import type { ChatMessage, ChatResponse } from '../types/chat';

export function sendChat(messages: ChatMessage[]) {
  return api.post<ChatResponse>('/api/chat', { messages });
}
