import { describe, expect, it } from 'vitest';
import { filterWorkOrders } from '../../../src/components/work-orders/WorkOrderPage';
import type { WorkOrder } from '../../../src/types/domain';

const WORK_ORDERS: WorkOrder[] = [
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
    status: 'pending',
    priority: 'medium',
    createdAt: '2026-04-15T09:00:00Z',
    updatedAt: '2026-04-15T09:00:00Z',
  },
  {
    id: 'WO-003',
    title: 'B2水泵巡检',
    description: '例行巡检',
    deviceId: 'pump_002',
    deviceName: '水泵_002',
    status: 'completed',
    priority: 'low',
    createdAt: '2026-04-16T09:00:00Z',
    updatedAt: '2026-04-16T10:00:00Z',
  },
];

describe('filterWorkOrders', () => {
  it('filters by keyword across id, title, description, deviceId, and deviceName', () => {
    expect(filterWorkOrders(WORK_ORDERS, {
      keyword: '空调',
      status: 'all',
      priority: 'all',
    }).map((wo) => wo.id)).toEqual(['WO-002']);

    expect(filterWorkOrders(WORK_ORDERS, {
      keyword: 'pump_002',
      status: 'all',
      priority: 'all',
    }).map((wo) => wo.id)).toEqual(['WO-003']);
  });

  it('filters by status and priority', () => {
    expect(filterWorkOrders(WORK_ORDERS, {
      keyword: '',
      status: 'pending',
      priority: 'medium',
    }).map((wo) => wo.id)).toEqual(['WO-002']);
  });

  it('combines keyword, status, and priority filters', () => {
    expect(filterWorkOrders(WORK_ORDERS, {
      keyword: 'B1',
      status: 'in_progress',
      priority: 'high',
    }).map((wo) => wo.id)).toEqual(['WO-001']);

    expect(filterWorkOrders(WORK_ORDERS, {
      keyword: 'B1',
      status: 'completed',
      priority: 'high',
    })).toEqual([]);
  });
});
