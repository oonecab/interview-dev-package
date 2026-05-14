import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkOrderTable } from '../../../src/components/work-orders/WorkOrderTable';
import type { WorkOrder } from '../../../src/types/domain';

const MOCK_WORK_ORDERS: WorkOrder[] = [
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
];

function makeWorkOrder(index: number): WorkOrder {
  return {
    id: `WO-${String(index).padStart(3, '0')}`,
    title: `测试工单 ${index}`,
    description: `测试描述 ${index}`,
    deviceId: `device_${index}`,
    deviceName: `设备_${index}`,
    status: 'pending',
    priority: 'medium',
    createdAt: '2026-04-15T09:00:00Z',
    updatedAt: '2026-04-15T09:00:00Z',
  };
}

describe('WorkOrderTable', () => {
  it('renders work order status, priority, and device name', () => {
    render(
      <WorkOrderTable
        workOrders={MOCK_WORK_ORDERS}
        loading={false}
        onWorkOrderClick={() => {}}
      />,
    );

    // Status tags
    expect(screen.getByText('处理中')).toBeInTheDocument();
    expect(screen.getByText('待派单')).toBeInTheDocument();

    // Priority tags
    expect(screen.getByText('高')).toBeInTheDocument();
    expect(screen.getByText('中')).toBeInTheDocument();

    // Device names
    expect(screen.getByText('电梯_002')).toBeInTheDocument();
    expect(screen.getByText('空调_008')).toBeInTheDocument();

    // Titles
    expect(screen.getByText('B1电梯门故障修复')).toBeInTheDocument();
    expect(screen.getByText('B3空调压缩机维修')).toBeInTheDocument();
  });

  it('calls onWorkOrderClick when a row is clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <WorkOrderTable
        workOrders={MOCK_WORK_ORDERS}
        loading={false}
        onWorkOrderClick={handleClick}
      />,
    );

    // Click on the first work order row
    const row = screen.getByText('B1电梯门故障修复').closest('tr')!;
    await user.click(row);

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith('WO-001');
  });

  it('shows empty state when no work orders', () => {
    render(
      <WorkOrderTable
        workOrders={[]}
        loading={false}
        onWorkOrderClick={() => {}}
      />,
    );

    expect(screen.getByText('暂无工单')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    const { container } = render(
      <WorkOrderTable
        workOrders={[]}
        loading={true}
        onWorkOrderClick={() => {}}
      />,
    );

    // Ant Design Table shows a loading overlay
    expect(container.querySelector('.ant-spin')).toBeInTheDocument();
  });

  it('changes visible row count when page size changes', async () => {
    const user = userEvent.setup();
    const workOrders = Array.from({ length: 12 }, (_, idx) => makeWorkOrder(idx + 1));

    render(
      <WorkOrderTable
        workOrders={workOrders}
        loading={false}
        onWorkOrderClick={() => {}}
      />,
    );

    expect(screen.getByText('测试工单 8')).toBeInTheDocument();
    expect(screen.queryByText('测试工单 9')).toBeNull();

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('16 / page'));

    expect(screen.getByText('测试工单 9')).toBeInTheDocument();
    expect(screen.getByText('测试工单 12')).toBeInTheDocument();
  });
});
