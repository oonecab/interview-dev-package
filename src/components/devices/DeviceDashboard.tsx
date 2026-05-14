import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Typography, Alert, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { getDevices } from '../../api/devices';
import type { DeviceStatus, DeviceType } from '../../types/domain';
import { getErrorMessage } from '../../utils/error';
import { DeviceStats } from './DeviceStats';
import { DeviceTable } from './DeviceTable';
import { DeviceDetailDrawer } from './DeviceDetailDrawer';
import { DeviceAlertPanel } from '../alerts/DeviceAlertPanel';

const { Text } = Typography;

interface DeviceDashboardProps {
  buildingId: string;
  status: DeviceStatus | 'all';
  type: DeviceType | 'all';
  onCreateWorkOrder?: (deviceId: string) => void;
}

export function DeviceDashboard({
  buildingId,
  status,
  type,
  onCreateWorkOrder,
}: DeviceDashboardProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const filterActive = status !== 'all' || type !== 'all';

  // Filtered query for the table
  const tableParams = {
    buildingId,
    ...(status !== 'all' ? { status } : {}),
    ...(type !== 'all' ? { type } : {}),
  };

  const {
    data: devices = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['devices', 'list', tableParams],
    queryFn: () => getDevices(tableParams),
  });

  // Separate query: full-building stats, unaffected by status/type filter
  const statsParams = { buildingId };

  const {
    data: allDevices = [],
    isError: statsError,
  } = useQuery({
    queryKey: ['devices', 'list', statsParams],
    queryFn: () => getDevices(statsParams),
  });

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ fontSize: 16 }}>
          设备列表
        </Text>
        <Text type="secondary" style={{ marginLeft: 8 }}>
          共 {devices.length} 台设备
        </Text>
      </div>

      {statsError ? (
        <Alert
          type="warning"
          message="统计数据加载失败，已显示可用的设备列表"
          showIcon
          style={{ marginBottom: 16 }}
        />
      ) : (
        <DeviceStats devices={allDevices} />
      )}

      {isError && (
        <Alert
          type="error"
          message="加载设备失败"
          description={getErrorMessage(error)}
          showIcon
          style={{ marginTop: 16 }}
          action={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['devices', 'list'] })}
            >
              重试
            </Button>
          }
        />
      )}

      <DeviceTable
        devices={devices}
        loading={isLoading}
        onDeviceClick={setSelectedDeviceId}
        filterActive={filterActive}
      />

      <DeviceAlertPanel buildingId={buildingId} />

      <DeviceDetailDrawer
        deviceId={selectedDeviceId}
        onClose={() => setSelectedDeviceId(null)}
        onCreateWorkOrder={onCreateWorkOrder}
      />
    </div>
  );
}
