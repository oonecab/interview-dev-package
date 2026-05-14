import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Typography, Select, Button, Alert, Space } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { getWorkOrders } from '../../api/workOrders';
import type { WorkOrderStatus, WorkOrder } from '../../types/domain';
import { WORK_ORDER_STATUS_LABELS } from '../../utils/labels';
import { getErrorMessage } from '../../utils/error';
import { WorkOrderTable } from './WorkOrderTable';
import { WorkOrderDetailDrawer } from './WorkOrderDetailDrawer';
import { CreateWorkOrderModal } from './CreateWorkOrderModal';

const { Text } = Typography;

const STATUS_OPTIONS: Array<{ value: WorkOrderStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: WORK_ORDER_STATUS_LABELS.pending },
  { value: 'assigned', label: WORK_ORDER_STATUS_LABELS.assigned },
  { value: 'in_progress', label: WORK_ORDER_STATUS_LABELS.in_progress },
  { value: 'completed', label: WORK_ORDER_STATUS_LABELS.completed },
];

interface WorkOrderPageProps {
  preselectedDeviceId?: string;
  onPreselectedDeviceConsumed?: () => void;
}

export function WorkOrderPage({
  preselectedDeviceId,
  onPreselectedDeviceConsumed,
}: WorkOrderPageProps) {
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | 'all'>('all');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (preselectedDeviceId) {
      setCreateModalOpen(true);
    }
  }, [preselectedDeviceId]);

  const queryParams = statusFilter !== 'all' ? { status: statusFilter } : undefined;

  const {
    data: workOrders = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['workOrders', statusFilter],
    queryFn: () => getWorkOrders(queryParams),
  });

  const selectedWorkOrder: WorkOrder | null =
    workOrders.find((wo) => wo.id === selectedWorkOrderId) ?? null;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Space>
          <Text strong style={{ fontSize: 16 }}>
            工单列表
          </Text>
          <Text type="secondary">共 {workOrders.length} 条工单</Text>
        </Space>

        <Space>
          <Select
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            options={STATUS_OPTIONS}
            style={{ width: 120 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            创建工单
          </Button>
        </Space>
      </div>

      {isError && (
        <Alert
          type="error"
          message="加载工单失败"
          description={getErrorMessage(error)}
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['workOrders'] })}
            >
              重试
            </Button>
          }
        />
      )}

      <WorkOrderTable
        workOrders={workOrders}
        loading={isLoading}
        onWorkOrderClick={setSelectedWorkOrderId}
        filterActive={statusFilter !== 'all'}
      />

      <WorkOrderDetailDrawer
        workOrder={selectedWorkOrder}
        onClose={() => setSelectedWorkOrderId(null)}
      />

      <CreateWorkOrderModal
        open={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          onPreselectedDeviceConsumed?.();
        }}
        preselectedDeviceId={preselectedDeviceId}
      />
    </div>
  );
}
