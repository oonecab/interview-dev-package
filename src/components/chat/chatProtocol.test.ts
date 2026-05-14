import { describe, it, expect } from 'vitest';
import { buildApiMessages, type ChatDisplayMessage } from './chatProtocol';

// ---------- Helpers ----------

function uid(role: string, n: number) {
  return `${role}_${n}`;
}

describe('buildApiMessages', () => {
  it('skips the welcome message', () => {
    const msgs: ChatDisplayMessage[] = [
      {
        id: 'welcome',
        role: 'assistant',
        content: '欢迎消息',
      },
      {
        id: uid('user', 1),
        role: 'user',
        content: '你好',
      },
    ];
    const result = buildApiMessages(msgs);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: 'user', content: '你好' });
  });

  it('converts plain user + assistant text history', () => {
    const msgs: ChatDisplayMessage[] = [
      { id: uid('user', 1), role: 'user', content: 'B3栋有多少设备？' },
      { id: uid('assistant', 1), role: 'assistant', content: 'B3栋有30台设备。' },
      { id: uid('user', 2), role: 'user', content: '有哪些告警？' },
      { id: uid('assistant', 2), role: 'assistant', content: '有2条告警。' },
    ];
    const result = buildApiMessages(msgs);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ role: 'user', content: 'B3栋有多少设备？' });
    expect(result[1]).toEqual({ role: 'assistant', content: 'B3栋有30台设备。' });
    expect(result[2]).toEqual({ role: 'user', content: '有哪些告警？' });
    expect(result[3]).toEqual({ role: 'assistant', content: '有2条告警。' });
  });

  it('reconstructs a single tool_call into assistant + tool messages', () => {
    const msgs: ChatDisplayMessage[] = [
      { id: uid('user', 1), role: 'user', content: 'B3栋有哪些设备？' },
      {
        id: uid('tool', 1),
        role: 'tool-status',
        content: JSON.stringify([{ id: 'elevator_001', name: '电梯_001' }]),
        toolCallId: 'call_abc',
        toolName: 'query_devices',
        toolStatus: 'success',
        toolResultSummary: '返回 1 台设备',
        toolCallsBatch: [
          {
            id: 'call_abc',
            type: 'function' as const,
            function: {
              name: 'query_devices',
              arguments: '{"buildingId":"B3"}',
            },
          },
        ],
      },
    ];
    const result = buildApiMessages(msgs);

    expect(result).toHaveLength(3);
    // User
    expect(result[0]).toEqual({ role: 'user', content: 'B3栋有哪些设备？' });
    // Assistant with tool_calls
    expect(result[1].role).toBe('assistant');
    expect(result[1].content).toBeNull();
    expect(result[1].tool_calls).toHaveLength(1);
    expect(result[1].tool_calls![0].function.name).toBe('query_devices');
    // Tool result
    expect(result[2].role).toBe('tool');
    expect(result[2].tool_call_id).toBe('call_abc');
    expect(result[2].content).toContain('elevator_001');
  });

  it('reconstructs multiple tool_calls correctly', () => {
    const msgs: ChatDisplayMessage[] = [
      { id: uid('user', 1), role: 'user', content: '查询B3栋设备和告警' },
      {
        id: uid('tool', 1),
        role: 'tool-status',
        content: JSON.stringify([{ id: 'elevator_001' }]),
        toolCallId: 'call_1',
        toolName: 'query_devices',
        toolStatus: 'success',
        toolResultSummary: '返回 1 台设备',
        toolCallsBatch: [
          {
            id: 'call_1',
            type: 'function' as const,
            function: { name: 'query_devices', arguments: '{"buildingId":"B3"}' },
          },
          {
            id: 'call_2',
            type: 'function' as const,
            function: { name: 'query_alerts', arguments: '{"buildingId":"B3"}' },
          },
        ],
      },
      {
        id: uid('tool', 2),
        role: 'tool-status',
        content: JSON.stringify([{ id: 'alt_001' }]),
        toolCallId: 'call_2',
        toolName: 'query_alerts',
        toolStatus: 'success',
        toolResultSummary: '返回 1 条告警',
      },
    ];
    const result = buildApiMessages(msgs);

    expect(result).toHaveLength(4);
    // User
    expect(result[0]).toEqual({ role: 'user', content: '查询B3栋设备和告警' });
    // Assistant with both tool_calls
    expect(result[1].role).toBe('assistant');
    expect(result[1].tool_calls).toHaveLength(2);
    expect(result[1].tool_calls![0].function.name).toBe('query_devices');
    expect(result[1].tool_calls![1].function.name).toBe('query_alerts');
    // Two tool result messages
    expect(result[2].role).toBe('tool');
    expect(result[2].tool_call_id).toBe('call_1');
    expect(result[3].role).toBe('tool');
    expect(result[3].tool_call_id).toBe('call_2');
  });

  it('handles error tool-status cards (still sends tool result)', () => {
    const msgs: ChatDisplayMessage[] = [
      { id: uid('user', 1), role: 'user', content: '测试' },
      {
        id: uid('tool', 1),
        role: 'tool-status',
        content: JSON.stringify({ error: 'Invalid tool arguments' }),
        toolCallId: 'call_err',
        toolName: 'query_devices',
        toolStatus: 'error',
        toolResultSummary: '查询设备失败',
        toolCallsBatch: [
          {
            id: 'call_err',
            type: 'function' as const,
            function: { name: 'query_devices', arguments: 'bad json' },
          },
        ],
      },
    ];
    const result = buildApiMessages(msgs);

    expect(result).toHaveLength(3);
    expect(result[1].role).toBe('assistant');
    expect(result[2].role).toBe('tool');
    expect(result[2].content).toContain('Invalid tool arguments');
  });
});
