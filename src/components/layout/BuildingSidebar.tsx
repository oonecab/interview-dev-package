import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Menu, Typography, Space, Radio, Select, Spin, Alert } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { getBuildings } from '../../api/buildings';
import type { Building, DeviceStatus, DeviceType } from '../../types/domain';
import { DEVICE_STATUS_LABELS, DEVICE_TYPE_LABELS } from '../../utils/labels';

const { Text } = Typography;

interface BuildingSidebarProps {
  selectedBuildingId: string | null;
  onBuildingSelect: (id: string) => void;
  selectedStatus: DeviceStatus | 'all';
  onStatusChange: (status: DeviceStatus | 'all') => void;
  selectedType: DeviceType | 'all';
  onTypeChange: (type: DeviceType | 'all') => void;
}

const STATUS_OPTIONS: Array<{ value: DeviceStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'normal', label: DEVICE_STATUS_LABELS.normal },
  { value: 'warning', label: DEVICE_STATUS_LABELS.warning },
  { value: 'fault', label: DEVICE_STATUS_LABELS.fault },
  { value: 'offline', label: DEVICE_STATUS_LABELS.offline },
];

const TYPE_OPTIONS: Array<{ value: DeviceType | 'all'; label: string }> = [
  { value: 'all', label: '全部类型' },
  { value: 'elevator', label: DEVICE_TYPE_LABELS.elevator },
  { value: 'hvac', label: DEVICE_TYPE_LABELS.hvac },
  { value: 'pump', label: DEVICE_TYPE_LABELS.pump },
  { value: 'lighting', label: DEVICE_TYPE_LABELS.lighting },
  { value: 'fire_pressure', label: DEVICE_TYPE_LABELS.fire_pressure },
];

export function BuildingSidebar({
  selectedBuildingId,
  onBuildingSelect,
  selectedStatus,
  onStatusChange,
  selectedType,
  onTypeChange,
}: BuildingSidebarProps) {
  const { data: buildings, isLoading, isError, error } = useQuery({
    queryKey: ['buildings'],
    queryFn: getBuildings,
  });

  const menuItems = (buildings ?? []).map((b: Building) => ({
    key: b.id,
    label: (
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Text>{b.name}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {b.deviceCount}台
        </Text>
      </Space>
    ),
  }));

  // Auto-select the first building when data loads and no building is selected
  useEffect(() => {
    if (buildings && buildings.length > 0 && selectedBuildingId === null) {
      onBuildingSelect(buildings[0].id);
    }
  }, [buildings, selectedBuildingId, onBuildingSelect]);

  return (
    <div style={{ padding: '12px 0' }}>
      <div
        style={{
          padding: '0 16px 8px',
          borderBottom: '1px solid #f0f0f0',
          marginBottom: 8,
        }}
      >
        <Text strong style={{ fontSize: 14 }}>
          <HomeOutlined style={{ marginRight: 6 }} />
          楼栋选择
        </Text>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <Spin size="small" />
        </div>
      )}

      {isError && (
        <Alert
          type="error"
          message="加载楼栋失败"
          description={error instanceof Error ? error.message : '未知错误'}
          style={{ margin: '0 8px' }}
        />
      )}

      {buildings && (
        <Menu
          mode="inline"
          selectedKeys={selectedBuildingId ? [selectedBuildingId] : []}
          onClick={({ key }) => onBuildingSelect(key)}
          items={menuItems}
          style={{ borderInlineEnd: 'none' }}
        />
      )}

      <div style={{ borderTop: '1px solid #f0f0f0', margin: '8px 0' }} />

      <div style={{ padding: '0 16px' }}>
        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
          状态筛选
        </Text>
        <Radio.Group
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          style={{ width: '100%' }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {STATUS_OPTIONS.map((opt) => (
              <Radio key={opt.value} value={opt.value}>
                {opt.label}
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      </div>

      <div style={{ borderTop: '1px solid #f0f0f0', margin: '8px 0' }} />

      <div style={{ padding: '0 16px' }}>
        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
          设备类型
        </Text>
        <Select
          value={selectedType}
          onChange={(value) => onTypeChange(value)}
          options={TYPE_OPTIONS}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}
