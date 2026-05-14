import { describe, it, expect, vi } from 'vitest';
import { executeToolCall } from './toolExecutor';
import type { ToolCall } from '../../types/chat';
import type { Device, Alert, WorkOrder } from '../../types/domain';

// Mock API modules
vi.mock('../../api/devices', () => ({
  getDevices: vi.fn(),
}));
vi.mock('../../api/alerts', () => ({
  getAlerts: vi.fn(),
}));
vi.mock('../../api/workOrders', () => ({
  createWorkOrder: vi.fn(),
}));

import { getDevices } from '../../api/devices';
import { getAlerts } from '../../api/alerts';
import { createWorkOrder } from '../../api/workOrders';

const mGetDevices = vi.mocked(getDevices);
const mGetAlerts = vi.mocked(getAlerts);
const mCreateWorkOrder = vi.mocked(createWorkOrder);

// ---------- Helpers ----------

function makeToolCall(name: string, args: Record<string, unknown>): ToolCall {
  return {
    id: 'call_test',
    type: 'function',
    function: { name, arguments: JSON.stringify(args) },
  };
}

const mockDevices: Device[] = [
  { id: 'elevator_001', name: '电梯_001', type: 'elevator', typeName: '电梯', buildingId: 'B3', floor: 1, status: 'fault', lastUpdated: '2026-04-15T10:00:00Z' },
  { id: 'hvac_008', name: '空调_008', type: 'hvac', typeName: '空调', buildingId: 'B3', floor: 5, status: 'fault', lastUpdated: '2026-04-15T08:45:00Z' },
];

const mockAlerts: Alert[] = [
  { id: 'alt_001', deviceId: 'elevator_002', deviceName: '电梯_002', buildingId: 'B1', level: 'warning', message: '门故障告警', timestamp: '2026-04-15T14:30:00Z', acknowledged: false },
];

const mockWorkOrder: WorkOrder = {
  id: 'WO-011', title: '测试工单', description: '', deviceId: 'elevator_001', deviceName: '电梯_001',
  status: 'pending', priority: 'high', createdAt: '2026-05-14T10:00:00Z', updatedAt: '2026-05-14T10:00:00Z',
};

// ---------- Tests ----------

describe('executeToolCall', () => {
  it('query_devices: passes buildingId/status/type and returns correct summary', async () => {
    mGetDevices.mockResolvedValue(mockDevices);
    const tc = makeToolCall('query_devices', { buildingId: 'B3', status: 'fault', type: 'elevator' });
    const result = await executeToolCall(tc);

    expect(result.success).toBe(true);
    expect(result.summary).toBe('返回 2 台设备');
    expect(getDevices).toHaveBeenCalledWith({ buildingId: 'B3', status: 'fault', type: 'elevator' });
    expect(JSON.parse(result.content)).toHaveLength(2);
  });

  it('query_devices: empty result shows 未找到匹配的设备', async () => {
    mGetDevices.mockResolvedValue([]);
    const tc = makeToolCall('query_devices', { buildingId: 'B99' });
    const result = await executeToolCall(tc);
    expect(result.success).toBe(true);
    expect(result.summary).toBe('未找到匹配的设备');
  });

  it('query_alerts: passes buildingId/level and returns correct summary', async () => {
    mGetAlerts.mockResolvedValue(mockAlerts);
    const tc = makeToolCall('query_alerts', { buildingId: 'B1', level: 'warning' });
    const result = await executeToolCall(tc);

    expect(result.success).toBe(true);
    expect(result.summary).toBe('返回 1 条告警');
    expect(getAlerts).toHaveBeenCalledWith({ buildingId: 'B1', level: 'warning' });
    expect(JSON.parse(result.content)[0].deviceName).toBe('电梯_002');
  });

  it('create_work_order: passes fields correctly and summary contains WO id', async () => {
    mCreateWorkOrder.mockResolvedValue(mockWorkOrder);
    const tc = makeToolCall('create_work_order', {
      title: '测试工单', description: '给设备创建工单', deviceId: 'elevator_001', priority: 'high',
    });
    const result = await executeToolCall(tc);

    expect(result.success).toBe(true);
    expect(result.summary).toBe('工单已创建：WO-011');
    expect(createWorkOrder).toHaveBeenCalledWith({
      title: '测试工单', description: '给设备创建工单', deviceId: 'elevator_001', priority: 'high',
    });
  });

  it('returns success=false with 工具参数解析失败 for invalid JSON', async () => {
    const tc: ToolCall = {
      id: 'call_bad', type: 'function',
      function: { name: 'query_devices', arguments: 'not valid {{{' },
    };
    const result = await executeToolCall(tc);
    expect(result.success).toBe(false);
    expect(result.summary).toBe('工具参数解析失败');
  });

  it('returns success=false with 未知工具 for unknown tool name', async () => {
    const tc = makeToolCall('unknown_tool', {});
    const result = await executeToolCall(tc);
    expect(result.success).toBe(false);
    expect(result.summary).toBe('未知工具：unknown_tool');
  });

  it('returns success=false when API call rejects', async () => {
    mGetDevices.mockRejectedValue(new Error('Network error'));
    const tc = makeToolCall('query_devices', { buildingId: 'B1' });
    const result = await executeToolCall(tc);

    expect(result.success).toBe(false);
    expect(result.summary).toBe('查询设备失败');
    expect(result.error).toBe('Network error');
  });
});
