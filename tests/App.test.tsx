import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';

const originalFetch = globalThis.fetch;

const MOCK_BUILDINGS = [
  { id: 'B1', name: 'B1 栋', floors: 20, deviceCount: 32 },
];

const MOCK_DEVICES = [
  {
    id: 'elevator_001',
    name: '电梯_001',
    type: 'elevator',
    typeName: '电梯',
    buildingId: 'B1',
    floor: 8,
    status: 'normal',
    lastUpdated: '2026-04-15T14:32:00Z',
  },
];

const MOCK_WORK_ORDERS = [
  {
    id: 'WO-001',
    title: 'B1电梯门故障修复',
    description: 'B1栋1楼电梯门频繁卡住',
    deviceId: 'elevator_002',
    deviceName: '电梯_002',
    status: 'in_progress',
    priority: 'high',
    createdAt: '2026-04-14T09:15:00Z',
    updatedAt: '2026-04-14T11:30:00Z',
  },
  {
    id: 'WO-002',
    title: 'B3空调压缩机维修',
    description: 'B3栋5楼空调压缩机过流保护触发',
    deviceId: 'hvac_008',
    deviceName: '空调_008',
    status: 'assigned',
    priority: 'high',
    createdAt: '2026-04-15T09:00:00Z',
    updatedAt: '2026-04-15T09:30:00Z',
  },
];

function createMockFetch(): typeof fetch {
  return vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : input.toString();
    let responseData: unknown = [];

    if (urlStr.includes('/api/buildings')) {
      responseData = MOCK_BUILDINGS;
    } else if (urlStr.includes('/api/devices')) {
      responseData = MOCK_DEVICES;
    } else if (urlStr.includes('/api/work-orders')) {
      responseData = MOCK_WORK_ORDERS;
    }

    return Promise.resolve(
      new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }) as typeof fetch;
}

describe('App', () => {
  beforeAll(() => {
    globalThis.fetch = createMockFetch();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders the app title "星汇智慧空间"', () => {
    render(<App />);
    expect(screen.getByText('星汇智慧空间')).toBeInTheDocument();
  });

  it('auto-selects the first building and shows it in the sidebar', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('B1 栋')).toBeInTheDocument();
    });
  });

  it('shows device data for the selected building', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('电梯_001')).toBeInTheDocument();
    });
  });

  it('switches to work orders page and shows work order titles', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Click the "工单管理" tab
    const woTab = screen.getByText('工单管理');
    await user.click(woTab);

    // Verify work order titles appear
    await waitFor(() => {
      expect(screen.getByText('B1电梯门故障修复')).toBeInTheDocument();
    });
    expect(screen.getByText('B3空调压缩机维修')).toBeInTheDocument();
  });
});
