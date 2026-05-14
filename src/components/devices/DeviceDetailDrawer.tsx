import { useQuery } from '@tanstack/react-query';
import {
  Drawer,
  Descriptions,
  Tag,
  List,
  Typography,
  Button,
  Spin,
  Alert,
  Empty,
  Space,
} from 'antd';
import { ToolOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { getDeviceDetail } from '../../api/devices';
import {
  DEVICE_STATUS_LABELS,
  DEVICE_STATUS_COLORS,
  DEVICE_TYPE_LABELS,
  ALERT_LEVEL_LABELS,
  ALERT_LEVEL_COLORS,
  alertLevelBorderColor,
} from '../../utils/labels';
import { formatDateTime } from '../../utils/format';
import { getErrorMessage } from '../../utils/error';

const { Text, Title } = Typography;

interface DeviceDetailDrawerProps {
  deviceId: string | null;
  onClose: () => void;
  onCreateWorkOrder?: (deviceId: string) => void;
}

export function DeviceDetailDrawer({
  deviceId,
  onClose,
  onCreateWorkOrder,
}: DeviceDetailDrawerProps) {
  const {
    data: device,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['devices', 'detail', deviceId],
    queryFn: () => getDeviceDetail(deviceId!),
    enabled: deviceId !== null,
  });

  return (
    <Drawer
      title={
        device ? (
          <Space>
            <Text strong style={{ fontSize: 16 }}>
              {device.name}
            </Text>
            <Tag color={DEVICE_STATUS_COLORS[device.status]}>
              {DEVICE_STATUS_LABELS[device.status]}
            </Tag>
          </Space>
        ) : (
          '设备详情'
        )
      }
      open={deviceId !== null}
      onClose={onClose}
      width={480}
      destroyOnClose
    >
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      )}

      {isError && (
        <Alert
          type="error"
          message="加载设备详情失败"
          description={getErrorMessage(error)}
          showIcon
        />
      )}

      {device && (
        <>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="类型">
              {DEVICE_TYPE_LABELS[device.type]}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={DEVICE_STATUS_COLORS[device.status]}>
                {DEVICE_STATUS_LABELS[device.status]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="楼栋">
              {device.buildingId}
            </Descriptions.Item>
            <Descriptions.Item label="楼层">
              {device.floor >= 0 ? `${device.floor}F` : `B${Math.abs(device.floor)}`}
            </Descriptions.Item>
            <Descriptions.Item label="最后更新" span={2}>
              {formatDateTime(device.lastUpdated)}
            </Descriptions.Item>
          </Descriptions>

          <Title level={5} style={{ marginTop: 24, marginBottom: 12 }}>
            最近告警
          </Title>

          {device.alerts.length === 0 ? (
            <Empty description="暂无告警记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <List
              dataSource={device.alerts}
              renderItem={(alert) => (
                <List.Item
                  style={{
                    padding: '8px 0',
                    borderLeft: `3px solid ${alertLevelBorderColor(alert.level)}`,
                    paddingLeft: 12,
                    marginBottom: 8,
                    backgroundColor: alert.acknowledged ? '#fafafa' : '#fff',
                    borderRadius: 4,
                  }}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Tag color={ALERT_LEVEL_COLORS[alert.level]}>
                          {ALERT_LEVEL_LABELS[alert.level]}
                        </Tag>
                        <Text>{alert.message}</Text>
                      </Space>
                    }
                    description={
                      <Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {formatDateTime(alert.timestamp)}
                        </Text>
                        {alert.acknowledged && (
                          <Tag
                            icon={<CheckCircleOutlined />}
                            color="default"
                            style={{ fontSize: 11 }}
                          >
                            已确认
                          </Tag>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}

          <div style={{ marginTop: 24 }}>
            <Button
              type="primary"
              icon={<ToolOutlined />}
              block
              onClick={() => {
                if (onCreateWorkOrder && device) {
                  onCreateWorkOrder(device.id);
                }
              }}
            >
              创建工单
            </Button>
          </div>
        </>
      )}
    </Drawer>
  );
}
