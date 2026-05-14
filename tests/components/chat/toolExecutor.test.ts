import { beforeEach, describe, it, expect, vi } from 'vitest';
import { executeToolCall } from '../../../src/components/chat/toolExecutor';
import type { ToolCall } from '../../../src/types/chat';
import type { Alert, Building, Device, DeviceDetail, WorkOrder } from '../../../src/types/domain';

// Mock API modules
vi.mock('../../../src/api/buildings', () => ({
  getBuildings: vi.fn(),
}));
vi.mock('../../../src/api/devices', () => ({
  getDevices: vi.fn(),
  getDeviceDetail: vi.fn(),
}));
vi.mock('../../../src/api/alerts', () => ({
  getAlerts: vi.fn(),
  ackAlert: vi.fn(),
}));
vi.mock('../../../src/api/workOrders', () => ({
  getWorkOrders: vi.fn(),
  createWorkOrder: vi.fn(),
  updateWorkOrderStatus: vi.fn(),
}));

import { getBuildings } from '../../../src/api/buildings';
import { getDeviceDetail, getDevices } from '../../../src/api/devices';
import { ackAlert, getAlerts } from '../../../src/api/alerts';
import { createWorkOrder, getWorkOrders, updateWorkOrderStatus } from '../../../src/api/workOrders';

const mGetBuildings = vi.mocked(getBuildings);
const mGetDevices = vi.mocked(getDevices);
const mGetDeviceDetail = vi.mocked(getDeviceDetail);
const mGetAlerts = vi.mocked(getAlerts);
const mAckAlert = vi.mocked(ackAlert);
const mGetWorkOrders = vi.mocked(getWorkOrders);
const mCreateWorkOrder = vi.mocked(createWorkOrder);
const mUpdateWorkOrderStatus = vi.mocked(updateWorkOrderStatus);

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

const mockBuildings: Building[] = [
  { id: 'B1', name: 'B1 栋', floors: 20, deviceCount: 32 },
];

const mockDeviceDetail: DeviceDetail = {
  ...mockDevices[0],
  alerts: [
    { id: 'alt_001', level: 'warning', message: '门故障告警', timestamp: '2026-04-15T14:30:00Z', acknowledged: false },
  ],
};

const mockAlerts: Alert[] = [
  { id: 'alt_001', deviceId: 'elevator_002', deviceName: '电梯_002', buildingId: 'B1', level: 'warning', message: '门故障告警', timestamp: '2026-04-15T14:30:00Z', acknowledged: false },
];

const mockWorkOrder: WorkOrder = {
  id: 'WO-011', title: '测试工单', description: '', deviceId: 'elevator_001', deviceName: '电梯_001',
  status: 'pending', priority: 'high', createdAt: '2026-05-14T10:00:00Z', updatedAt: '2026-05-14T10:00:00Z',
};

// ---------- Tests ----------

describe('executeToolCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('query_buildings: calls GET buildings and returns count summary', async () => {
    mGetBuildings.mockResolvedValue(mockBuildings);
    const result = await executeToolCall(makeToolCall('query_buildings', {}));

    expect(result.success).toBe(true);
    expect(result.summary).toBe('返回 1 栋楼宇');
    expect(getBuildings).toHaveBeenCalled();
  });

  it('query_devices: passes buildingId/status/type and returns correct summary', async () => {
    mGetDevices.mockResolvedValue(mockDevices);
    const tc = makeToolCall('query_devices', { buildingId: 'B3', status: 'fault', type: 'elevator' });
    const result = await executeToolCall(tc);

    expect(result.success).toBe(true);
    expect(result.summary).toBe('返回 2 台设备');
    expect(getDevices).toHaveBeenCalledWith({ buildingId: 'B3', status: 'fault', type: 'elevator' });
    expect(JSON.parse(result.content)).toHaveLength(2);
  });

  it('get_device_detail: requires deviceId and calls detail API', async () => {
    mGetDeviceDetail.mockResolvedValue(mockDeviceDetail);
    const result = await executeToolCall(makeToolCall('get_device_detail', { deviceId: 'elevator_001' }));

    expect(result.success).toBe(true);
    expect(result.summary).toBe('返回设备详情：电梯_001');
    expect(getDeviceDetail).toHaveBeenCalledWith('elevator_001');
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

  it('ack_alert: confirms an alert by id', async () => {
    mAckAlert.mockResolvedValue({ id: 'alt_001', acknowledged: true });
    const result = await executeToolCall(makeToolCall('ack_alert', { alertId: 'alt_001' }));

    expect(result.success).toBe(true);
    expect(result.summary).toBe('告警已确认：alt_001');
    expect(ackAlert).toHaveBeenCalledWith('alt_001');
  });

  it('query_work_orders: passes status and returns count summary', async () => {
    mGetWorkOrders.mockResolvedValue([mockWorkOrder]);
    const result = await executeToolCall(makeToolCall('query_work_orders', { status: 'pending' }));

    expect(result.success).toBe(true);
    expect(result.summary).toBe('返回 1 条工单');
    expect(getWorkOrders).toHaveBeenCalledWith({ status: 'pending' });
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

  it('create_work_order: infers devices before creating when deviceId is missing', async () => {
    const b1FaultDevices: Device[] = [
      { id: 'hvac_003', name: '空调_003', type: 'hvac', typeName: '空调', buildingId: 'B1', floor: 10, status: 'fault', lastUpdated: '2026-04-15T10:00:00Z' },
    ];
    mGetDevices.mockResolvedValue(b1FaultDevices);
    mCreateWorkOrder.mockResolvedValue({
      ...mockWorkOrder,
      id: 'WO-012',
      title: '空调_003维修工单',
      deviceId: 'hvac_003',
      deviceName: '空调_003',
      priority: 'medium',
    });

    const result = await executeToolCall(makeToolCall('create_work_order', {
      title: '新维修工单',
      description: '对B1栋出现故障的设备创建工单',
      deviceId: '',
      priority: 'medium',
    }));

    expect(result.success).toBe(true);
    expect(result.summary).toBe('已为 1 台设备创建工单');
    expect(getDevices).toHaveBeenCalledWith({ buildingId: 'B1', status: 'fault' });
    expect(createWorkOrder).toHaveBeenCalledWith({
      title: '空调_003维修工单',
      description: '对B1栋出现故障的设备创建工单',
      deviceId: 'hvac_003',
      priority: 'medium',
    });
  });

  it('create_work_order: returns handled no-op when inferred query has no matching devices', async () => {
    mGetDevices.mockResolvedValue([]);

    const result = await executeToolCall(makeToolCall('create_work_order', {
      title: '新维修工单',
      description: '对B2栋出现故障的设备创建工单',
      deviceId: '',
      priority: 'medium',
    }));

    expect(result.success).toBe(true);
    expect(result.summary).toBe('没有匹配设备，未创建工单');
    expect(result.terminalMessage).toBe('没有找到B2栋故障设备，因此没有创建工单。');
    expect(JSON.parse(result.content)).toMatchObject({
      created: [],
      skipped: true,
      reason: 'No matching devices',
      query: { buildingId: 'B2', status: 'fault' },
    });
    expect(getDevices).toHaveBeenCalledWith({ buildingId: 'B2', status: 'fault' });
    expect(createWorkOrder).not.toHaveBeenCalled();
  });

  it('create_work_order: rejects empty deviceId when no device query can be inferred', async () => {
    const result = await executeToolCall(makeToolCall('create_work_order', {
      title: '新维修工单',
      description: '创建一个工单',
      deviceId: '',
      priority: 'medium',
    }));

    expect(result.success).toBe(false);
    expect(result.summary).toBe('缺少关联设备');
    expect(createWorkOrder).not.toHaveBeenCalled();
  });

  it('update_work_order: updates a work order status', async () => {
    mUpdateWorkOrderStatus.mockResolvedValue({ ...mockWorkOrder, status: 'assigned' });
    const result = await executeToolCall(makeToolCall('update_work_order', {
      workOrderId: 'WO-011',
      status: 'assigned',
    }));

    expect(result.success).toBe(true);
    expect(result.summary).toBe('工单已更新：WO-011');
    expect(updateWorkOrderStatus).toHaveBeenCalledWith('WO-011', 'assigned');
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
