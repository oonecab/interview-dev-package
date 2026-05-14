import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App, ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateWorkOrderModal } from './CreateWorkOrderModal';

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

// ---------- Helpers ----------

function okJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const MOCK_DEVICES = [
  { id: 'elevator_001', name: '电梯_001', type: 'elevator', typeName: '电梯', buildingId: 'B1', floor: 8, status: 'normal', lastUpdated: '2026-04-15T14:32:00Z' },
];

// ---------- Tests ----------

describe('CreateWorkOrderModal', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      // Devices query
      if (url.includes('/api/devices')) {
        return Promise.resolve(okJson(MOCK_DEVICES));
      }
      // Work order creation
      if (url.includes('/api/work-orders')) {
        return Promise.resolve(okJson({
          id: 'WO-020',
          title: '测试工单',
          deviceId: 'elevator_001',
          deviceName: '电梯_001',
          status: 'pending',
          priority: 'high',
          createdAt: '2026-05-14T10:00:00Z',
          updatedAt: '2026-05-14T10:00:00Z',
        }, 201));
      }
      return Promise.resolve(okJson([]));
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('shows validation errors when submitting with empty required fields', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <Wrapper>
        <CreateWorkOrderModal open={false} onClose={onClose} />
      </Wrapper>,
    );
    // Re-render to open
    rerender(
      <Wrapper>
        <CreateWorkOrderModal open={true} onClose={onClose} />
      </Wrapper>,
    );

    // Click submit button without filling form
    const submitBtn = screen.getByRole('button', { name: '提 交' });
    await user.click(submitBtn);

    // Validation messages should appear
    await waitFor(() => {
      expect(screen.getByText('请输入工单标题')).toBeInTheDocument();
    });
    expect(screen.getByText('请输入问题描述')).toBeInTheDocument();
    expect(screen.getByText('请选择关联设备')).toBeInTheDocument();

    // onClose should NOT be called
    expect(onClose).not.toHaveBeenCalled();
  });

  it('submits successfully and calls onClose when all fields are valid', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <Wrapper>
        <CreateWorkOrderModal open={false} onClose={onClose} />
      </Wrapper>,
    );
    rerender(
      <Wrapper>
        <CreateWorkOrderModal open={true} onClose={onClose} />
      </Wrapper>,
    );

    // Fill in form
    await user.type(screen.getByPlaceholderText('请输入工单标题'), '测试工单标题');
    await user.type(screen.getByPlaceholderText('请描述设备问题和维修需求'), '测试描述内容');

    // Select device from dropdown — click the select to open, then click first option
    const deviceSelect = screen.getByRole('combobox', { name: '关联设备' });
    await user.click(deviceSelect);
    // AntD Select renders options in a portal; find by text and click
    const deviceOption = await screen.findByText(/电梯_001/);
    await user.click(deviceOption);

    // Submit
    const submitBtn = screen.getByRole('button', { name: '提 交' });
    await user.click(submitBtn);

    // onClose should be called after success
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('does NOT call onClose when submission fails', async () => {
    const originalF = globalThis.fetch;
    const onClose = vi.fn();

    // Mock work-orders POST to fail
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/devices')) {
        return Promise.resolve(okJson(MOCK_DEVICES));
      }
      if (url.includes('/api/work-orders') && init?.method === 'POST') {
        return Promise.resolve(okJson({ error: 'Server error', message: '创建失败' }, 500));
      }
      return Promise.resolve(okJson([]));
    }) as typeof fetch;

    const user = userEvent.setup();
    const { rerender } = render(
      <Wrapper>
        <CreateWorkOrderModal open={false} onClose={onClose} />
      </Wrapper>,
    );
    rerender(
      <Wrapper>
        <CreateWorkOrderModal open={true} onClose={onClose} />
      </Wrapper>,
    );

    await user.type(screen.getByPlaceholderText('请输入工单标题'), '测试');
    await user.type(screen.getByPlaceholderText('请描述设备问题和维修需求'), '描述');

    const deviceSelect = screen.getByRole('combobox', { name: '关联设备' });
    await user.click(deviceSelect);
    const deviceOption = await screen.findByText(/电梯_001/);
    await user.click(deviceOption);

    await user.click(screen.getByRole('button', { name: '提 交' }));

    // Modal should still be open
    await waitFor(() => {
      expect(screen.getByText('创建工单')).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();

    globalThis.fetch = originalF;
  });
});
