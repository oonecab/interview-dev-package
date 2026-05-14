import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App, ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkOrderDetailDrawer } from './WorkOrderDetailDrawer';
import type { WorkOrder } from '../../types/domain';

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

function okJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const PENDING_WO: WorkOrder = {
  id: 'WO-001',
  title: 'B1电梯门故障修复',
  description: 'B1栋1楼电梯门频繁卡住',
  deviceId: 'elevator_002',
  deviceName: '电梯_002',
  status: 'pending',
  priority: 'high',
  createdAt: '2026-04-14T09:15:00Z',
  updatedAt: '2026-04-14T11:30:00Z',
};

// ---------- Tests ----------

describe('WorkOrderDetailDrawer', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('advances pending to assigned on success and calls onClose', async () => {
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/work-orders') && init?.method === 'PATCH') {
        return Promise.resolve(okJson({ ...PENDING_WO, status: 'assigned' }));
      }
      return Promise.resolve(okJson([]));
    }) as typeof fetch;

    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Wrapper>
        <WorkOrderDetailDrawer workOrder={PENDING_WO} onClose={onClose} />
      </Wrapper>,
    );

    expect(screen.getByText('B1电梯门故障修复')).toBeInTheDocument();

    // Click the advance button
    const advanceBtn = screen.getByText('推进到已派单');
    await user.click(advanceBtn);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('does NOT call onClose when PATCH fails, drawer stays open', async () => {
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/work-orders') && init?.method === 'PATCH') {
        return Promise.resolve(okJson({ error: 'Invalid transition', message: 'Cannot transition' }, 422));
      }
      return Promise.resolve(okJson([]));
    }) as typeof fetch;

    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Wrapper>
        <WorkOrderDetailDrawer workOrder={PENDING_WO} onClose={onClose} />
      </Wrapper>,
    );

    const advanceBtn = screen.getByText('推进到已派单');
    await user.click(advanceBtn);

    // Wait for the error to be handled — drawer title is still visible
    await waitFor(() => {
      expect(screen.getByText('B1电梯门故障修复')).toBeInTheDocument();
    });

    // onClose should NOT have been called
    expect(onClose).not.toHaveBeenCalled();
  });
});
