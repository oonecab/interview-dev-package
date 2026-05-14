import { Table, Tag, Typography, type TableColumnsType } from 'antd';
import type { WorkOrder, WorkOrderStatus, Priority } from '../../types/domain';
import {
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from '../../utils/labels';
import { formatDateTime } from '../../utils/format';

const { Text } = Typography;

interface WorkOrderTableProps {
  workOrders: WorkOrder[];
  loading: boolean;
  onWorkOrderClick: (id: string) => void;
  /** When true, empty state says "no results for current filters" */
  filterActive?: boolean;
}

const columns: TableColumnsType<WorkOrder> = [
  {
    title: '编号',
    dataIndex: 'id',
    key: 'id',
    width: 100,
    render: (id: string) => <Text code>{id}</Text>,
  },
  {
    title: '标题',
    dataIndex: 'title',
    key: 'title',
    ellipsis: true,
    render: (title: string) => <Text strong>{title}</Text>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (status: WorkOrderStatus) => (
      <Tag color={WORK_ORDER_STATUS_COLORS[status]}>
        {WORK_ORDER_STATUS_LABELS[status]}
      </Tag>
    ),
  },
  {
    title: '优先级',
    dataIndex: 'priority',
    key: 'priority',
    width: 80,
    render: (priority: Priority) => (
      <Tag color={PRIORITY_COLORS[priority]}>{PRIORITY_LABELS[priority]}</Tag>
    ),
  },
  {
    title: '关联设备',
    dataIndex: 'deviceName',
    key: 'deviceName',
    width: 140,
    render: (name: string) => <Text>{name}</Text>,
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 160,
    render: (val: string) => (
      <Text style={{ fontSize: 13 }}>{formatDateTime(val)}</Text>
    ),
  },
];

export function WorkOrderTable({ workOrders, loading, onWorkOrderClick, filterActive }: WorkOrderTableProps) {
  return (
    <Table<WorkOrder>
      columns={columns}
      dataSource={workOrders}
      rowKey="id"
      loading={loading}
      onRow={(record) => ({
        onClick: () => onWorkOrderClick(record.id),
        style: { cursor: 'pointer' },
      })}
      locale={{
        emptyText: filterActive ? '当前筛选条件下暂无工单' : '暂无工单',
      }}
      pagination={{
        defaultPageSize: 8,
        showSizeChanger: true,
        pageSizeOptions: [8, 16, 32],
        showTotal: (total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`,
      }}
      size="middle"
    />
  );
}
