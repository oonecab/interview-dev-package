import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Typography, Select, Button, Alert, Space, Input } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { getWorkOrders } from '../../api/workOrders';
import type { Priority, WorkOrderStatus, WorkOrder } from '../../types/domain';
import { PRIORITY_LABELS, WORK_ORDER_STATUS_LABELS } from '../../utils/labels';
import { getErrorMessage } from '../../utils/error';
import { WorkOrderTable } from './WorkOrderTable';
import { WorkOrderDetailDrawer } from './WorkOrderDetailDrawer';
import { CreateWorkOrderModal } from './CreateWorkOrderModal';

const { Text } = Typography;
const { Search } = Input;

const STATUS_OPTIONS: Array<{ value: WorkOrderStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: WORK_ORDER_STATUS_LABELS.pending },
  { value: 'assigned', label: WORK_ORDER_STATUS_LABELS.assigned },
  { value: 'in_progress', label: WORK_ORDER_STATUS_LABELS.in_progress },
  { value: 'completed', label: WORK_ORDER_STATUS_LABELS.completed },
];

const PRIORITY_OPTIONS: Array<{ value: Priority | 'all'; label: string }> = [
  { value: 'all', label: '全部优先级' },
  { value: 'high', label: PRIORITY_LABELS.high },
  { value: 'medium', label: PRIORITY_LABELS.medium },
  { value: 'low', label: PRIORITY_LABELS.low },
];

interface WorkOrderFilters {
  keyword: string;
  status: WorkOrderStatus | 'all';
  priority: Priority | 'all';
}

export function filterWorkOrders(
  workOrders: WorkOrder[],
  { keyword, status, priority }: WorkOrderFilters,
): WorkOrder[] {
  const normalizedKeyword = keyword.trim().toLowerCase();

  return workOrders.filter((wo) => {
    if (status !== 'all' && wo.status !== status) return false;
    if (priority !== 'all' && wo.priority !== priority) return false;

    if (!normalizedKeyword) return true;

    return [
      wo.id,
      wo.title,
      wo.description,
      wo.deviceId,
      wo.deviceName,
    ].some((field) => field.toLowerCase().includes(normalizedKeyword));
  });
}

interface WorkOrderPageProps {
  preselectedDeviceId?: string;
  onPreselectedDeviceConsumed?: () => void;
}

export function WorkOrderPage({
  preselectedDeviceId,
  onPreselectedDeviceConsumed,
}: WorkOrderPageProps) {
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [keyword, setKeyword] = useState('');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (preselectedDeviceId) {
      setCreateModalOpen(true);
    }
  }, [preselectedDeviceId]);

  const {
    data: workOrders = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['workOrders'],
    queryFn: () => getWorkOrders(),
  });

  const filteredWorkOrders = useMemo(
    () => filterWorkOrders(workOrders, {
      keyword,
      status: statusFilter,
      priority: priorityFilter,
    }),
    [keyword, priorityFilter, statusFilter, workOrders],
  );

  const selectedWorkOrder: WorkOrder | null =
    workOrders.find((wo) => wo.id === selectedWorkOrderId) ?? null;

  const filterActive =
    keyword.trim().length > 0 || statusFilter !== 'all' || priorityFilter !== 'all';

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
          <Text type="secondary">
            共 {workOrders.length} 条工单
            {filterActive ? `，筛选出 ${filteredWorkOrders.length} 条` : ''}
          </Text>
        </Space>

        <Space>
          <Search
            allowClear
            placeholder="搜索编号、标题或设备"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ width: 240 }}
          />
          <Select
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            options={STATUS_OPTIONS}
            style={{ width: 120 }}
          />
          <Select
            value={priorityFilter}
            onChange={(value) => setPriorityFilter(value)}
            options={PRIORITY_OPTIONS}
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
        workOrders={filteredWorkOrders}
        loading={isLoading}
        onWorkOrderClick={setSelectedWorkOrderId}
        filterActive={filterActive}
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
