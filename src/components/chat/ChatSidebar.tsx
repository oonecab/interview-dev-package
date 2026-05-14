import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { Typography, Button, Input, Space, Spin, App, Tag } from 'antd';
import {
  SendOutlined,
  CloseOutlined,
  RobotOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { sendChat } from '../../api/chat';
import type { ChatResponse } from '../../types/chat';
import { getErrorMessage } from '../../utils/error';
import { executeToolCall, TOOL_DISPLAY_NAMES, TOOL_PROGRESS_MESSAGES } from './toolExecutor';
import {
  buildApiMessages,
  nextId,
  WELCOME_MESSAGE,
  type ChatDisplayMessage,
} from './chatProtocol';

export type { ChatDisplayMessage } from './chatProtocol';

const { Text } = Typography;
const { TextArea } = Input;

const MAX_TOOL_ROUNDS = 2;

// ---------- Tool status card helpers ----------

function toolStatusIcon(status?: string) {
  if (status === 'success') return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
  if (status === 'error') return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
  return <LoadingOutlined style={{ color: '#1677ff' }} />;
}

// ---------- Component ----------

interface ChatSidebarProps {
  messages: ChatDisplayMessage[];
  onMessagesChange: (messages: ChatDisplayMessage[]) => void;
  onClose: () => void;
}

export function ChatSidebar({ messages, onMessagesChange, onClose }: ChatSidebarProps) {
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { message: appMessage } = App.useApp();
  const queryClient = useQueryClient();

  // Auto-scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || sending) return;

    // 1. Add user message
    const userMsg: ChatDisplayMessage = {
      id: nextId(),
      role: 'user',
      content: trimmed,
    };
    let currentMsgs = [...messages, userMsg];
    onMessagesChange(currentMsgs);
    setInputText('');
    setSending(true);

    try {
      // 2. First /api/chat call
      let apiMessages = buildApiMessages(currentMsgs);
      let response: ChatResponse = await sendChat(apiMessages);

      // 3. Tool calling loop (max rounds)
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        if (response.content) break;
        if (!response.tool_calls || response.tool_calls.length === 0) break;

        const toolCalls = response.tool_calls;

        // Add tool-status cards (running)
        const toolStatusMsgs: ChatDisplayMessage[] = toolCalls.map((tc, idx) => ({
          id: nextId(),
          role: 'tool-status' as const,
          content: '',
          toolCallId: tc.id,
          toolName: tc.function.name,
          toolArgs: (() => { try { return JSON.parse(tc.function.arguments); } catch { return {}; } })(),
          toolStatus: 'running' as const,
          toolResultSummary: TOOL_PROGRESS_MESSAGES[tc.function.name] ?? `正在调用 ${tc.function.name}...`,
          ...(idx === 0 ? { toolCallsBatch: toolCalls } : {}),
        }));

        currentMsgs = [...currentMsgs, ...toolStatusMsgs];
        onMessagesChange(currentMsgs);

        // Execute each tool call
        const results = await Promise.all(
          toolCalls.map((tc) => executeToolCall(tc)),
        );

        // Update tool-status cards with results
        const updatedToolMsgs = toolStatusMsgs.map((tsm, idx) => {
          const result = results[idx];
          return {
            ...tsm,
            content: result.content,
            toolStatus: result.success ? ('success' as const) : ('error' as const),
            toolResultSummary: result.summary,
          };
        });

        currentMsgs = currentMsgs.map((m) => {
          const updated = updatedToolMsgs.find((u) => u.id === m.id);
          return updated ?? m;
        });
        onMessagesChange(currentMsgs);

        // Invalidate workOrders cache only when create_work_order actually succeeds
        const createdWorkOrder = toolCalls.some(
          (tc, idx) => tc.function.name === 'create_work_order' && results[idx].success,
        );
        if (createdWorkOrder) {
          queryClient.invalidateQueries({ queryKey: ['workOrders'] });
        }

        const terminalMessages = results
          .map((r) => r.terminalMessage)
          .filter((message): message is string => Boolean(message));
        if (terminalMessages.length > 0 && results.every((r) => r.success)) {
          const terminalMsg: ChatDisplayMessage = {
            id: nextId(),
            role: 'assistant' as const,
            content: terminalMessages.join('\n\n'),
          };
          currentMsgs = [...currentMsgs, terminalMsg];
          onMessagesChange(currentMsgs);
          return;
        }

        // If all tools failed, stop
        const allFailed = results.every((r) => !r.success);
        if (allFailed) {
          const failMsg: ChatDisplayMessage = {
            id: nextId(),
            role: 'assistant' as const,
            content: '工具调用全部失败，请稍后重试或检查输入是否正确。',
          };
          currentMsgs = [...currentMsgs, failMsg];
          onMessagesChange(currentMsgs);
          return;
        }

        // Build apiMessages with tool results and send again
        apiMessages = buildApiMessages(currentMsgs);
        response = await sendChat(apiMessages);
      }

      // 4. Final assistant text reply
      if (response.content) {
        const assistantMsg: ChatDisplayMessage = {
          id: nextId(),
          role: 'assistant' as const,
          content: response.content,
        };
        currentMsgs = [...currentMsgs, assistantMsg];
        onMessagesChange(currentMsgs);
      } else {
        const fallbackMsg: ChatDisplayMessage = {
          id: nextId(),
          role: 'assistant' as const,
          content: 'AI 助手需要继续处理，但已达到最大工具调用轮次。请尝试更具体的提问。',
        };
        currentMsgs = [...currentMsgs, fallbackMsg];
        onMessagesChange(currentMsgs);
      }
    } catch (err) {
      const errorMsg: ChatDisplayMessage = {
        id: nextId(),
        role: 'assistant' as const,
        content: `抱歉，请求失败：${getErrorMessage(err)}`,
      };
      onMessagesChange([...currentMsgs, errorMsg]);
      appMessage.error(getErrorMessage(err, '发送消息失败'));
    } finally {
      setSending(false);
    }
  }, [inputText, sending, messages, onMessagesChange, appMessage, queryClient]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = inputText.trim().length > 0 && !sending;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 12,
          borderBottom: '1px solid #f0f0f0',
          marginBottom: 12,
        }}
      >
        <Space>
          <RobotOutlined />
          <Text strong style={{ fontSize: 16 }}>
            AI 助手
          </Text>
        </Space>
        <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 8 }}>
        <WelcomeBubble />
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {sending && (
          <div style={{ textAlign: 'left', marginBottom: 12 }}>
            <Space size={4}>
              <Spin size="small" />
              <Text type="secondary" style={{ fontSize: 12 }}>
                AI 正在回复...
              </Text>
            </Space>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入问题..."
            disabled={sending}
            rows={2}
            style={{ flex: 1, resize: 'none' }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!canSend}
            loading={sending}
            aria-label="发送"
            style={{ height: 'auto' }}
          />
        </Space.Compact>
      </div>
    </div>
  );
}

// ---------- Sub-components ----------

function WelcomeBubble() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
      <div
        style={{
          maxWidth: '85%',
          padding: '8px 12px',
          borderRadius: 8,
          fontSize: 13,
          lineHeight: '20px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          backgroundColor: '#f6f8fa',
          color: '#333',
        }}
      >
        {WELCOME_MESSAGE.content}
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatDisplayMessage }) {
  if (msg.role === 'tool-status') {
    return <ToolStatusCard msg={msg} />;
  }

  const isUser = msg.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          maxWidth: '85%',
          padding: '8px 12px',
          borderRadius: 8,
          fontSize: 13,
          lineHeight: '20px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          ...(isUser
            ? { backgroundColor: '#1677ff', color: '#fff' }
            : { backgroundColor: '#f0f0f0', color: '#333' }),
        }}
      >
        {msg.content}
      </div>
    </div>
  );
}

function formatArgsBrief(args?: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) return '无参数';
  return Object.entries(args)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}

function ToolStatusCard({ msg }: { msg: ChatDisplayMessage }) {
  const displayName = TOOL_DISPLAY_NAMES[msg.toolName ?? ''] ?? msg.toolName ?? '未知工具';
  const icon = toolStatusIcon(msg.toolStatus);
  const argsBrief = formatArgsBrief(msg.toolArgs);

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
      <div
        style={{
          width: '100%',
          maxWidth: '92%',
          border: '1px solid #e8e8e8',
          borderRadius: 8,
          padding: '10px 12px',
          backgroundColor: '#fafafa',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <Space size={4}>
            <ToolOutlined style={{ fontSize: 12, color: '#666' }} />
            <Text strong style={{ fontSize: 12, color: '#333' }}>
              {displayName}
            </Text>
          </Space>
          <Tag
            color={msg.toolStatus === 'success' ? 'success' : msg.toolStatus === 'error' ? 'error' : 'processing'}
            style={{ fontSize: 10, lineHeight: '16px', margin: 0 }}
          >
            {msg.toolStatus === 'running' ? '执行中' : msg.toolStatus === 'success' ? '成功' : '失败'}
          </Tag>
        </div>
        <Text type="secondary" style={{ fontSize: 11, wordBreak: 'break-all', display: 'block' }}>
          {argsBrief}
        </Text>
        <div
          style={{
            marginTop: 6,
            paddingTop: 6,
            borderTop: '1px solid #f0f0f0',
            fontSize: 12,
            color: msg.toolStatus === 'error' ? '#ff4d4f' : '#52c41a',
          }}
        >
          <Space size={4}>
            {icon}
            <Text style={{ fontSize: 12, color: 'inherit', wordBreak: 'break-word' }}>
              {msg.toolResultSummary || (msg.toolStatus === 'running' ? '处理中...' : '')}
            </Text>
          </Space>
        </div>
      </div>
    </div>
  );
}
