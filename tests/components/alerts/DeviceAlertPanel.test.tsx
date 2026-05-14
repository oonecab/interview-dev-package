import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App, ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeviceAlertPanel } from '../../../src/components/alerts/DeviceAlertPanel';

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
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const MOCK_ALERTS_B1 = [
  { id: 'alt_001', deviceId: 'elevator_002', deviceName: '电梯_002', buildingId: 'B1', level: 'warning', message: '门故障告警', timestamp: '2026-04-15T14:30:00Z', acknowledged: false },
  { id: 'alt_002', deviceId: 'hvac_003', deviceName: '空调_003', buildingId: 'B1', level: 'warning', message: '出水温度偏高', timestamp: '2026-04-15T14:20:00Z', acknowledged: false },
];

const MOCK_ALERTS_B2 = [
  { id: 'alt_011', deviceId: 'hvac_005', deviceName: '空调_005', buildingId: 'B2', level: 'info', message: '设备离线', timestamp: '2026-04-14T18:00:00Z', acknowledged: false },
];

// ---------- Tests ----------

describe('DeviceAlertPanel', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders alerts for the given buildingId and requests /api/alerts?buildingId=B1', async () => {
    const fetchCalls: { url: string; init?: RequestInit }[] = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      fetchCalls.push({ url, init });
      return Promise.resolve(okJson(MOCK_ALERTS_B1));
    }) as typeof fetch;

    render(
      <Wrapper>
        <DeviceAlertPanel buildingId="B1" />
      </Wrapper>,
    );

    // Wait for alerts to appear
    await waitFor(() => {
      expect(screen.getByText('门故障告警')).toBeInTheDocument();
    });
    expect(screen.getByText('出水温度偏高')).toBeInTheDocument();
    expect(screen.getAllByText('警告')).toHaveLength(2); // level tags

    // Verify the request URL includes buildingId
    const alertsCall = fetchCalls.find((c) => c.url.includes('/api/alerts'));
    expect(alertsCall).toBeDefined();
    expect(alertsCall!.url).toContain('buildingId=B1');
  });

  it('re-fetches when buildingId changes from B1 to B2', async () => {
    const fetchCalls: { url: string }[] = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      fetchCalls.push({ url });
      if (url.includes('buildingId=B2')) {
        return Promise.resolve(okJson(MOCK_ALERTS_B2));
      }
      return Promise.resolve(okJson(MOCK_ALERTS_B1));
    }) as typeof fetch;

    const { rerender } = render(
      <Wrapper>
        <DeviceAlertPanel buildingId="B1" />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('门故障告警')).toBeInTheDocument();
    });

    // Re-render with new buildingId
    rerender(
      <Wrapper>
        <DeviceAlertPanel buildingId="B2" />
      </Wrapper>,
    );

    // Should now show B2 alerts
    await waitFor(() => {
      expect(screen.getByText('设备离线')).toBeInTheDocument();
    });

    // Both B1 and B2 requests should have been made
    const b1Calls = fetchCalls.filter((c) => c.url.includes('buildingId=B1'));
    const b2Calls = fetchCalls.filter((c) => c.url.includes('buildingId=B2'));
    expect(b1Calls.length).toBeGreaterThanOrEqual(1);
    expect(b2Calls.length).toBeGreaterThanOrEqual(1);
  }, 10000);

  it('acknowledges alert with POST /api/alerts/:id/ack and immutable update in UI', async () => {
    const user = userEvent.setup();
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      // Ack request
      if (url.includes('/ack') && init?.method === 'POST') {
        return Promise.resolve(okJson({ id: 'alt_001', acknowledged: true }));
      }
      return Promise.resolve(okJson(MOCK_ALERTS_B1));
    }) as typeof fetch;

    render(
      <Wrapper>
        <DeviceAlertPanel buildingId="B1" />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('门故障告警')).toBeInTheDocument();
    });

    // Click "确认" on first alert
    const ackButtons = screen.getAllByText('确认');
    await user.click(ackButtons[0]);

    // After ack, the button should change to "已确认" tag
    await waitFor(() => {
      expect(screen.getByText('已确认')).toBeInTheDocument();
    });

    // The "确认" button for the ack'd alert should disappear
    const remainingAckButtons = screen.getAllByText('确认');
    expect(remainingAckButtons).toHaveLength(1); // only second alert still has 确认
  });

describe('auto-refresh with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('triggers auto-refetch after 5-second interval', async () => {
      const fetchFn = vi.fn(() => Promise.resolve(okJson(MOCK_ALERTS_B1))) as typeof fetch;
      globalThis.fetch = fetchFn;

      render(
        <Wrapper>
          <DeviceAlertPanel buildingId="B1" />
        </Wrapper>,
      );

      // Allow initial fetch
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      const callsAfterInit = (fetchFn as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(callsAfterInit).toBeGreaterThanOrEqual(1);

      // After 5s, auto-refresh should trigger another fetch
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      const countAfterRefresh = (fetchFn as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(countAfterRefresh).toBeGreaterThan(callsAfterInit);
    });
  });

  it('filter: selecting "警告" shows only warning alerts', async () => {
    const mixedAlerts = [
      ...MOCK_ALERTS_B1,
      { id: 'alt_004', deviceId: 'elevator_005', deviceName: '电梯_005', buildingId: 'B1', level: 'critical' as const, message: '电梯停运', timestamp: '2026-04-15T10:15:00Z', acknowledged: false },
      { id: 'alt_010', deviceId: 'fire_002', deviceName: '消防水压_002', buildingId: 'B1', level: 'info' as const, message: '水压波动', timestamp: '2026-04-15T13:30:00Z', acknowledged: true },
    ];
    globalThis.fetch = vi.fn(() => Promise.resolve(okJson(mixedAlerts))) as typeof fetch;
    const user = userEvent.setup();

    render(
      <Wrapper>
        <DeviceAlertPanel buildingId="B1" />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('电梯停运')).toBeInTheDocument();
    });

    // Open select dropdown by clicking the current value "全部"
    await user.click(screen.getByText('全部'));
    // Click on "警告" option — use getAllByText since "警告" also appears in alert level tags
    const warningOptions = screen.getAllByText('警告');
    // The last one should be the select option (rendered after alert tags)
    await user.click(warningOptions[warningOptions.length - 1]);

    // Should show only warning alerts
    await waitFor(() => {
      expect(screen.getByText('门故障告警')).toBeInTheDocument();
      expect(screen.getByText('出水温度偏高')).toBeInTheDocument();
    });
    expect(screen.queryByText('电梯停运')).toBeNull();
    expect(screen.queryByText('水压波动')).toBeNull();
  });

  it('shows error state when fetch fails', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(okJson({ error: 'Server error' }, 500)),
    ) as typeof fetch;

    render(
      <Wrapper>
        <DeviceAlertPanel buildingId="B1" />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('加载告警失败')).toBeInTheDocument();
    });
  });

  it('shows empty state when no alerts', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(okJson([])),
    ) as typeof fetch;

    render(
      <Wrapper>
        <DeviceAlertPanel buildingId="B1" />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('当前楼栋暂无告警')).toBeInTheDocument();
    });
  });

  it('shows filter-specific empty state when filter has no results', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(okJson(MOCK_ALERTS_B1)),
    ) as typeof fetch;

    const user = userEvent.setup();
    render(
      <Wrapper>
        <DeviceAlertPanel buildingId="B1" />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('门故障告警')).toBeInTheDocument();
    });

    // Open select and pick "严重"
    const select = screen.getByText('全部');
    await user.click(select);
    const criticalOption = await screen.findByText('严重');
    await user.click(criticalOption);

    // No critical alerts in B1 data
    await waitFor(() => {
      expect(screen.getByText('当前筛选条件下暂无告警')).toBeInTheDocument();
    });
  });

  it('does not show "已确认" when ack API fails', async () => {
    const user = userEvent.setup();
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/ack') && init?.method === 'POST') {
        return Promise.resolve(okJson({ error: 'Server error' }, 500));
      }
      return Promise.resolve(okJson(MOCK_ALERTS_B1));
    }) as typeof fetch;

    render(
      <Wrapper>
        <DeviceAlertPanel buildingId="B1" />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('门故障告警')).toBeInTheDocument();
    });

    // Click 确认 on first alert
    const ackButtons = screen.getAllByText('确认');
    await user.click(ackButtons[0]);

    // After a short wait, the ack button should still be visible (not replaced by 已确认)
    await waitFor(() => {
      const buttons = screen.getAllByText('确认');
      expect(buttons.length).toBeGreaterThanOrEqual(2); // still 2 确认 buttons
    });

    // 已确认 tag should NOT appear
    expect(screen.queryByText('已确认')).toBeNull();
  });
});
