import { Table, Tag, Typography, type TableColumnsType } from 'antd';
import type { Device, DeviceStatus } from '../../types/domain';
import {
  DEVICE_STATUS_LABELS,
  DEVICE_STATUS_COLORS,
  DEVICE_TYPE_LABELS,
} from '../../utils/labels';
import { formatDateTime, formatFloor } from '../../utils/format';

const { Text } = Typography;

interface DeviceTableProps {
  devices: Device[];
  loading: boolean;
  onDeviceClick: (deviceId: string) => void;
  /** When true, empty state says "no results for current filters" */
  filterActive?: boolean;
}

const columns: TableColumnsType<Device> = [
  {
    title: '设备名称',
    dataIndex: 'name',
    key: 'name',
    ellipsis: true,
    render: (name: string) => <Text strong>{name}</Text>,
  },
  {
    title: '楼栋/楼层',
    key: 'location',
    render: (_, record) => (
      <Text>{formatFloor(record.buildingId, record.floor)}</Text>
    ),
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    render: (type: string) => (
      <Text>{DEVICE_TYPE_LABELS[type as keyof typeof DEVICE_TYPE_LABELS] ?? type}</Text>
    ),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: DeviceStatus) => (
      <Tag color={DEVICE_STATUS_COLORS[status]}>
        {DEVICE_STATUS_LABELS[status]}
      </Tag>
    ),
  },
  {
    title: '最后更新',
    dataIndex: 'lastUpdated',
    key: 'lastUpdated',
    render: (val: string) => <Text style={{ fontSize: 13 }}>{formatDateTime(val)}</Text>,
  },
];

export function DeviceTable({ devices, loading, onDeviceClick, filterActive }: DeviceTableProps) {
  return (
    <Table<Device>
      columns={columns}
      dataSource={devices}
      rowKey="id"
      loading={loading}
      onRow={(record) => ({
        onClick: () => onDeviceClick(record.id),
        style: { cursor: 'pointer' },
      })}
      locale={{
        emptyText: filterActive ? '当前筛选条件下暂无设备' : '当前楼栋暂无设备',
      }}
      pagination={false}
      size="middle"
      style={{ marginTop: 16 }}
    />
  );
}
