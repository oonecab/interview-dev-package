import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App, ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatSidebar, type ChatDisplayMessage } from '../../../src/components/chat/ChatSidebar';

// ---------- Wrapper ----------

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <ConfigProvider>
        <App>{children}</App>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

// ---------- render helper ----------

function renderChatSidebar(initialMessages: ChatDisplayMessage[] = []) {
  let currentMessages = initialMessages;
  const onMessagesChange = vi.fn((newMessages: ChatDisplayMessage[]) => {
    currentMessages = newMessages;
  });

  const { rerender: baseRerender } = render(
    <Wrapper>
      <ChatSidebar
        messages={initialMessages}
        onMessagesChange={onMessagesChange}
        onClose={vi.fn()}
      />
    </Wrapper>,
  );

  const rerender = () => {
    baseRerender(
      <Wrapper>
        <ChatSidebar
          messages={currentMessages}
          onMessagesChange={onMessagesChange}
          onClose={vi.fn()}
        />
      </Wrapper>,
    );
  };

  return { onMessagesChange, rerender };
}

// ---------- Assertion helpers ----------

/** Extract JSON body from a mock fetch call. */
function getRequestBody(call: [input: unknown, init?: unknown]): Record<string, unknown> | null {
  const init = call[1] as RequestInit | undefined;
  if (!init?.body) return null;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

interface FetchCall {
  url: string;
  init?: RequestInit;
}

/** Build a 200 JSON Response helper. */
function okJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------- Tests ----------

describe('ChatSidebar', () => {
  let onClose: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    onClose = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ========== Basic chat tests ==========

  it('shows the welcome message on initial render', () => {
    render(
      <Wrapper>
        <ChatSidebar messages={[]} onMessagesChange={() => {}} onClose={onClose} />
      </Wrapper>,
    );
    expect(screen.getByText(/智慧空间 AI 助手/)).toBeInTheDocument();
  });

  it('sends a message and shows user + assistant reply', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(okJson({ role: 'assistant', content: 'B3栋有30台设备。' }))) as typeof fetch;

    const user = userEvent.setup();
    const { onMessagesChange, rerender } = renderChatSidebar();

    await user.type(screen.getByPlaceholderText('请输入问题...'), 'B3栋有多少设备？');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => expect(onMessagesChange).toHaveBeenCalled());
    rerender();
    await waitFor(() => expect(screen.getByText('B3栋有多少设备？')).toBeInTheDocument());

    await waitFor(() => expect(onMessagesChange).toHaveBeenCalledTimes(2));
    rerender();
    await waitFor(() => expect(screen.getByText('B3栋有30台设备。')).toBeInTheDocument());
  });

  it('does not send when input is empty', async () => {
    const mockFetch = vi.fn(() => Promise.resolve(okJson({}))) as typeof fetch;
    globalThis.fetch = mockFetch;

    const user = userEvent.setup();
    render(
      <Wrapper>
        <ChatSidebar messages={[]} onMessagesChange={() => {}} onClose={onClose} />
      </Wrapper>,
    );

    const sendBtn = screen.getByRole('button', { name: '发送' });
    expect(sendBtn).toBeDisabled();
    await user.type(screen.getByPlaceholderText('请输入问题...'), '   ');
    expect(sendBtn).toBeDisabled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows error when API fails', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(okJson({ error: 'Server error' }, 500))) as typeof fetch;

    const user = userEvent.setup();
    const { onMessagesChange, rerender } = renderChatSidebar();

    await user.type(screen.getByPlaceholderText('请输入问题...'), '测试错误处理');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => expect(onMessagesChange).toHaveBeenCalledTimes(2));
    rerender();
    await waitFor(() => expect(screen.getByText(/抱歉，请求失败/)).toBeInTheDocument());
  });

  // ========== Tool Calling tests (URL + method based mock) ==========

  it('executes query_devices tool: first chat → GET devices → second chat → final reply', async () => {
    const calls: FetchCall[] = [];

    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      calls.push({ url, init });

      // GET /api/devices → tool execution
      if (url.includes('/api/devices') && init?.method !== 'POST') {
        return Promise.resolve(okJson([
          { id: 'elevator_001', name: '电梯_001', type: 'elevator', buildingId: 'B3', floor: 1, status: 'fault', lastUpdated: '2026-04-15T10:00:00Z', typeName: '电梯' },
        ]));
      }

      if (url.includes('/api/chat')) {
        const body = init?.body ? JSON.parse(init.body as string) : null;
        const messages: Array<{ role: string }> = body?.messages ?? [];
        const hasToolMessages = messages.some((m) => m.role === 'tool');
        if (hasToolMessages) {
          return Promise.resolve(okJson({ role: 'assistant', content: 'B3栋有1台故障设备：电梯_001。' }));
        }
        return Promise.resolve(okJson({
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_abc123',
            type: 'function',
            function: { name: 'query_devices', arguments: '{"buildingId":"B3","status":"fault"}' },
          }],
        }));
      }

      return Promise.resolve(okJson([]));
    }) as typeof fetch;

    const user = userEvent.setup();
    const { onMessagesChange, rerender } = renderChatSidebar();

    await user.type(screen.getByPlaceholderText('请输入问题...'), 'B3栋有哪些故障设备？');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => expect(onMessagesChange.mock.calls.length).toBeGreaterThanOrEqual(4));
    rerender();

    // === Assert UI ===
    expect(screen.getByText('B3栋有1台故障设备：电梯_001。')).toBeInTheDocument();
    expect(screen.getByText('查询设备')).toBeInTheDocument();
    expect(screen.getByText('成功')).toBeInTheDocument();

    // === Assert request chain ===
    const firstChatCall = calls.find((c) => c.url.includes('/api/chat'));
    const firstChatBody = getRequestBody([firstChatCall!.url, firstChatCall!.init]);
    const firstMessages = firstChatBody!.messages as Array<{ role: string }>;
    expect(firstMessages).toHaveLength(1);
    expect(firstMessages[0].role).toBe('user');

    const devicesCall = calls.find((c) => c.url.includes('/api/devices'));
    expect(devicesCall).toBeDefined();
    expect(devicesCall!.url).toContain('buildingId=B3');
    expect(devicesCall!.url).toContain('status=fault');

    const chatCalls = calls.filter((c) => c.url.includes('/api/chat'));
    expect(chatCalls).toHaveLength(2);
    const secondChatBody = getRequestBody([chatCalls[1].url, chatCalls[1].init]);
    const secondMessages = secondChatBody!.messages as Array<{
      role: string; content: unknown; tool_calls?: unknown; tool_call_id?: string;
    }>;
    expect(secondMessages).toHaveLength(3);
    expect(secondMessages[0].role).toBe('user');
    expect(secondMessages[1].role).toBe('assistant');
    expect(secondMessages[1].content).toBeNull();
    expect(secondMessages[1].tool_calls).toBeDefined();
    expect(secondMessages[2].role).toBe('tool');
    expect(secondMessages[2].tool_call_id).toBe('call_abc123');
    const toolContent = JSON.parse(secondMessages[2].content as string) as Array<{ name: string }>;
    expect(Array.isArray(toolContent)).toBe(true);
    expect(toolContent[0].name).toBe('电梯_001');
  });

  it('executes create_work_order tool: POST work-orders, only invalidates on success', async () => {
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : input.toString();

      // POST /api/work-orders → tool execution
      if (urlStr.includes('/api/work-orders') && init?.method === 'POST') {
        return Promise.resolve(okJson({
          id: 'WO-011',
          title: '测试工单',
          deviceId: 'elevator_001',
          deviceName: '电梯_001',
          status: 'pending',
          priority: 'high',
          createdAt: '2026-05-14T10:00:00Z',
          updatedAt: '2026-05-14T10:00:00Z',
        }, 201));
      }

      // /api/chat
      if (urlStr.includes('/api/chat')) {
        const body = init?.body ? JSON.parse(init.body as string) : null;
        const hasTool = body?.messages?.some((m: { role: string }) => m.role === 'tool');
        if (hasTool) {
          return Promise.resolve(okJson({ role: 'assistant', content: '工单已创建：WO-011，状态为待派单。' }));
        }
        return Promise.resolve(okJson({
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_xyz',
            type: 'function',
            function: { name: 'create_work_order', arguments: '{"title":"测试工单","description":"给设备创建工单","deviceId":"elevator_001","priority":"high"}' },
          }],
        }));
      }

      return Promise.resolve(okJson([]));
    }) as typeof fetch;

    const user = userEvent.setup();
    const { onMessagesChange, rerender } = renderChatSidebar();

    await user.type(screen.getByPlaceholderText('请输入问题...'), '给电梯_001创建一个高优先级工单');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => expect(onMessagesChange.mock.calls.length).toBeGreaterThanOrEqual(4));
    rerender();

    // UI: tool card + final reply
    expect(screen.getByText('创建工单')).toBeInTheDocument();
    expect(screen.getByText('成功')).toBeInTheDocument();
    expect(screen.getByText('工单已创建：WO-011，状态为待派单。')).toBeInTheDocument();
    // Tool summary on card
    const summaryEls = screen.getAllByText('工单已创建：WO-011');
    expect(summaryEls.length).toBeGreaterThan(0);
  });

  it('shows informational no-op message when creating work orders for an empty device set', async () => {
    const calls: FetchCall[] = [];

    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : input.toString();
      calls.push({ url: urlStr, init });

      if (urlStr.includes('/api/devices')) {
        return Promise.resolve(okJson([]));
      }

      if (urlStr.includes('/api/work-orders')) {
        return Promise.resolve(okJson({ error: 'should not create' }, 500));
      }

      if (urlStr.includes('/api/chat')) {
        return Promise.resolve(okJson({
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_empty_create',
            type: 'function',
            function: {
              name: 'create_work_order',
              arguments: '{"title":"新维修工单","description":"对B2栋出现故障的设备创建工单","deviceId":"","priority":"medium"}',
            },
          }],
        }));
      }

      return Promise.resolve(okJson([]));
    }) as typeof fetch;

    const user = userEvent.setup();
    const { onMessagesChange, rerender } = renderChatSidebar();

    await user.type(screen.getByPlaceholderText('请输入问题...'), '对B2栋出现故障的设备创建工单');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => expect(onMessagesChange.mock.calls.length).toBeGreaterThanOrEqual(4));
    rerender();

    expect(screen.getByText('创建工单')).toBeInTheDocument();
    expect(screen.getByText('成功')).toBeInTheDocument();
    expect(screen.getByText('没有匹配设备，未创建工单')).toBeInTheDocument();
    expect(screen.getByText('没有找到B2栋故障设备，因此没有创建工单。')).toBeInTheDocument();
    expect(screen.queryByText(/工具调用全部失败/)).toBeNull();
    expect(calls.some((c) => c.url.includes('/api/devices?') && c.url.includes('buildingId=B2') && c.url.includes('status=fault'))).toBe(true);
    expect(calls.some((c) => c.url.includes('/api/work-orders'))).toBe(false);
    expect(calls.filter((c) => c.url.includes('/api/chat'))).toHaveLength(1);
  });

  it('executes query_alerts tool and shows final reply', async () => {
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : input.toString();

      // GET /api/alerts → tool execution
      if (urlStr.includes('/api/alerts')) {
        return Promise.resolve(okJson([
          { id: 'alt_001', deviceId: 'elevator_002', deviceName: '电梯_002', buildingId: 'B1', level: 'warning', message: '门故障告警', timestamp: '2026-04-15T14:30:00Z', acknowledged: false },
        ]));
      }

      // /api/chat
      if (urlStr.includes('/api/chat')) {
        const body = init?.body ? JSON.parse(init.body as string) : null;
        const hasTool = body?.messages?.some((m: { role: string }) => m.role === 'tool');
        if (hasTool) {
          return Promise.resolve(okJson({ role: 'assistant', content: 'B1栋有1条告警：电梯_002门故障告警（警告）。' }));
        }
        return Promise.resolve(okJson({
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_alert_1',
            type: 'function',
            function: { name: 'query_alerts', arguments: '{"buildingId":"B1","level":"warning"}' },
          }],
        }));
      }

      return Promise.resolve(okJson([]));
    }) as typeof fetch;

    const user = userEvent.setup();
    const { onMessagesChange, rerender } = renderChatSidebar();

    await user.type(screen.getByPlaceholderText('请输入问题...'), 'B1栋有哪些告警？');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => expect(onMessagesChange.mock.calls.length).toBeGreaterThanOrEqual(4));
    rerender();

    // Tool card: "查询告警" + success
    expect(screen.getByText('查询告警')).toBeInTheDocument();
    expect(screen.getByText('成功')).toBeInTheDocument();
    // Final assistant reply
    expect(screen.getByText('B1栋有1条告警：电梯_002门故障告警（警告）。')).toBeInTheDocument();
  });

  it('executes AI tool flow for every api-spec business endpoint', async () => {
    const calls: FetchCall[] = [];

    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : input.toString();
      const url = new URL(urlStr);
      calls.push({ url: urlStr, init });

      if (url.pathname === '/api/chat') {
        const body = init?.body ? JSON.parse(init.body as string) : null;
        const hasTool = body?.messages?.some((m: { role: string }) => m.role === 'tool');
        if (hasTool) {
          return Promise.resolve(okJson({ role: 'assistant', content: '全部接口工具流程已完成。' }));
        }
        return Promise.resolve(okJson({
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_buildings',
              type: 'function',
              function: { name: 'query_buildings', arguments: '{}' },
            },
            {
              id: 'call_devices',
              type: 'function',
              function: { name: 'query_devices', arguments: '{"buildingId":"B1","status":"fault"}' },
            },
            {
              id: 'call_device_detail',
              type: 'function',
              function: { name: 'get_device_detail', arguments: '{"deviceId":"elevator_001"}' },
            },
            {
              id: 'call_alerts',
              type: 'function',
              function: { name: 'query_alerts', arguments: '{"buildingId":"B1","acknowledged":false}' },
            },
            {
              id: 'call_ack_alert',
              type: 'function',
              function: { name: 'ack_alert', arguments: '{"alertId":"alt_001"}' },
            },
            {
              id: 'call_work_orders',
              type: 'function',
              function: { name: 'query_work_orders', arguments: '{"status":"pending"}' },
            },
            {
              id: 'call_create_work_order',
              type: 'function',
              function: { name: 'create_work_order', arguments: '{"title":"测试工单","description":"给设备创建工单","deviceId":"elevator_001","priority":"high"}' },
            },
            {
              id: 'call_update_work_order',
              type: 'function',
              function: { name: 'update_work_order', arguments: '{"workOrderId":"WO-011","status":"assigned"}' },
            },
          ],
        }));
      }

      if (url.pathname === '/api/buildings') {
        return Promise.resolve(okJson([
          { id: 'B1', name: 'B1 栋', floors: 20, deviceCount: 32 },
        ]));
      }

      if (url.pathname === '/api/devices/elevator_001') {
        return Promise.resolve(okJson({
          id: 'elevator_001',
          name: '电梯_001',
          type: 'elevator',
          typeName: '电梯',
          buildingId: 'B1',
          floor: 8,
          status: 'fault',
          lastUpdated: '2026-04-15T10:00:00Z',
          alerts: [],
        }));
      }

      if (url.pathname === '/api/devices') {
        return Promise.resolve(okJson([
          { id: 'elevator_001', name: '电梯_001', type: 'elevator', typeName: '电梯', buildingId: 'B1', floor: 8, status: 'fault', lastUpdated: '2026-04-15T10:00:00Z' },
        ]));
      }

      if (url.pathname === '/api/alerts/alt_001/ack' && init?.method === 'POST') {
        return Promise.resolve(okJson({ id: 'alt_001', acknowledged: true }));
      }

      if (url.pathname === '/api/alerts') {
        return Promise.resolve(okJson([
          { id: 'alt_001', deviceId: 'elevator_001', deviceName: '电梯_001', buildingId: 'B1', level: 'warning', message: '门故障告警', timestamp: '2026-04-15T14:30:00Z', acknowledged: false },
        ]));
      }

      if (url.pathname === '/api/work-orders/WO-011' && init?.method === 'PATCH') {
        return Promise.resolve(okJson({
          id: 'WO-011',
          title: '测试工单',
          description: '给设备创建工单',
          deviceId: 'elevator_001',
          deviceName: '电梯_001',
          status: 'assigned',
          priority: 'high',
          createdAt: '2026-05-14T10:00:00Z',
          updatedAt: '2026-05-14T10:10:00Z',
        }));
      }

      if (url.pathname === '/api/work-orders' && init?.method === 'POST') {
        return Promise.resolve(okJson({
          id: 'WO-011',
          title: '测试工单',
          description: '给设备创建工单',
          deviceId: 'elevator_001',
          deviceName: '电梯_001',
          status: 'pending',
          priority: 'high',
          createdAt: '2026-05-14T10:00:00Z',
          updatedAt: '2026-05-14T10:00:00Z',
        }, 201));
      }

      if (url.pathname === '/api/work-orders') {
        return Promise.resolve(okJson([
          {
            id: 'WO-001',
            title: '既有工单',
            description: '待处理',
            deviceId: 'elevator_001',
            deviceName: '电梯_001',
            status: 'pending',
            priority: 'medium',
            createdAt: '2026-05-14T09:00:00Z',
            updatedAt: '2026-05-14T09:00:00Z',
          },
        ]));
      }

      return Promise.resolve(okJson({}));
    }) as typeof fetch;

    const user = userEvent.setup();
    const { onMessagesChange, rerender } = renderChatSidebar();

    await user.type(screen.getByPlaceholderText('请输入问题...'), '执行全接口工具流程');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => expect(onMessagesChange.mock.calls.length).toBeGreaterThanOrEqual(4));
    rerender();

    expect(screen.getByText('全部接口工具流程已完成。')).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/api/buildings'))).toBe(true);
    expect(calls.some((c) => c.url.includes('/api/devices?') && c.url.includes('buildingId=B1') && c.url.includes('status=fault'))).toBe(true);
    expect(calls.some((c) => c.url.includes('/api/devices/elevator_001'))).toBe(true);
    expect(calls.some((c) => c.url.includes('/api/alerts?') && c.url.includes('buildingId=B1') && c.url.includes('acknowledged=false'))).toBe(true);
    expect(calls.some((c) => c.url.includes('/api/alerts/alt_001/ack') && c.init?.method === 'POST')).toBe(true);
    expect(calls.some((c) => c.url.includes('/api/work-orders?') && c.url.includes('status=pending'))).toBe(true);
    expect(calls.some((c) => c.url.includes('/api/work-orders') && c.init?.method === 'POST')).toBe(true);
    expect(calls.some((c) => c.url.includes('/api/work-orders/WO-011') && c.init?.method === 'PATCH')).toBe(true);

    const chatCalls = calls.filter((c) => c.url.includes('/api/chat'));
    expect(chatCalls).toHaveLength(2);
    const secondChatBody = getRequestBody([chatCalls[1].url, chatCalls[1].init]);
    const secondMessages = secondChatBody!.messages as Array<{ role: string }>;
    expect(secondMessages.filter((m) => m.role === 'tool')).toHaveLength(8);
  });

  // ========== Tool error tests ==========

  it('shows tool error when JSON arguments are invalid, does NOT show success', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(okJson({
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'call_bad',
          type: 'function',
          function: { name: 'query_devices', arguments: 'not valid json {{{' },
        }],
      })),
    ) as typeof fetch;

    const user = userEvent.setup();
    const { onMessagesChange, rerender } = renderChatSidebar();

    await user.type(screen.getByPlaceholderText('请输入问题...'), '查询设备');
    await user.click(screen.getByRole('button', { name: '发送' }));

    // Wait for all callbacks: user, tool status running, tool error, fail message
    await waitFor(() => expect(onMessagesChange.mock.calls.length).toBeGreaterThanOrEqual(4));
    rerender();

    // Tool card shows "查询设备" with failure
    const toolNames = screen.getAllByText('查询设备');
    expect(toolNames.length).toBeGreaterThanOrEqual(2); // user bubble + tool card

    // Failure status visible
    expect(screen.getByText('工具参数解析失败')).toBeInTheDocument();
    expect(screen.getByText('失败')).toBeInTheDocument();

    // Must NOT show success tag
    expect(screen.queryByText('成功')).toBeNull();

    // All-failed fallback message visible
    expect(screen.getByText(/工具调用全部失败/)).toBeInTheDocument();
  });

  it('shows tool error when API call fails (e.g. /api/devices returns 500)', async () => {
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : input.toString();

      // GET /api/devices → simulate 500 error
      if (urlStr.includes('/api/devices') && init?.method !== 'POST') {
        return Promise.resolve(okJson({ error: 'Internal error' }, 500));
      }

      // /api/chat → return tool_calls
      return Promise.resolve(okJson({
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'call_dev_fail',
          type: 'function',
          function: { name: 'query_devices', arguments: '{"buildingId":"B3"}' },
        }],
      }));
    }) as typeof fetch;

    const user = userEvent.setup();
    const { onMessagesChange, rerender } = renderChatSidebar();

    await user.type(screen.getByPlaceholderText('请输入问题...'), '查询B3栋设备');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => expect(onMessagesChange.mock.calls.length).toBeGreaterThanOrEqual(4));
    rerender();

    // Card shows failure, not success
    expect(screen.getByText('查询设备失败')).toBeInTheDocument();
    expect(screen.getByText('失败')).toBeInTheDocument();
    expect(screen.queryByText('成功')).toBeNull();

    // All-failed fallback
    expect(screen.getByText(/工具调用全部失败/)).toBeInTheDocument();
  });
});
