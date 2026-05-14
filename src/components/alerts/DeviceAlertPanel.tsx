import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Typography,
  Select,
  Switch,
  Button,
  Tag,
  List,
  Spin,
  Alert as AntAlert,
  Empty,
  Space,
  App,
} from 'antd';
import { CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import { getAlerts, ackAlert } from '../../api/alerts';
import type { Alert, AlertLevel } from '../../types/domain';
import {
  ALERT_LEVEL_LABELS,
  ALERT_LEVEL_COLORS,
  alertLevelBorderColor,
} from '../../utils/labels';
import { formatDateTime } from '../../utils/format';
import { getErrorMessage } from '../../utils/error';

const { Text, Title } = Typography;

// ---------- Props ----------

interface DeviceAlertPanelProps {
  buildingId: string;
  onAlertClick?: (alert: Alert) => void;
}

// ---------- Filter options ----------

type FilterValue = AlertLevel | 'all' | 'unacknowledged';

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'critical', label: ALERT_LEVEL_LABELS.critical },
  { value: 'warning', label: ALERT_LEVEL_LABELS.warning },
  { value: 'info', label: ALERT_LEVEL_LABELS.info },
  { value: 'unacknowledged', label: '未确认' },
];

// ---------- Component ----------

export function DeviceAlertPanel({ buildingId, onAlertClick }: DeviceAlertPanelProps) {
  const [filter, setFilter] = useState<FilterValue>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const {
    data: alerts = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['alerts', buildingId],
    queryFn: () => getAlerts({ buildingId }),
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const ackMutation = useMutation({
    mutationFn: (alertId: string) => ackAlert(alertId),
    onSuccess: (_data, alertId) => {
      queryClient.setQueryData<Alert[]>(['alerts', buildingId], (prev) => {
        if (!prev) return prev;
        return prev.map((a) =>
          a.id === alertId ? { ...a, acknowledged: true } : a,
        );
      });
      message.success('告警已确认');
    },
    onError: (err: Error) => {
      message.error(err.message || '确认告警失败');
    },
  });

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'unacknowledged') return !a.acknowledged;
    return a.level === filter;
  });

  const emptyDescription =
    filter !== 'all' ? '当前筛选条件下暂无告警' : '当前楼栋暂无告警';

  return (
    <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, padding: 16, marginTop: 16 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Space>
          <Title level={5} style={{ margin: 0 }}>
            设备告警
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            ({filteredAlerts.length})
          </Text>
        </Space>

        <Space>
          <Select
            value={filter}
            onChange={(value) => setFilter(value)}
            options={FILTER_OPTIONS}
            size="small"
            style={{ width: 110 }}
          />
          <Space size={4}>
            <Switch
              checked={autoRefresh}
              onChange={setAutoRefresh}
              size="small"
            />
            <Text style={{ fontSize: 12, color: '#666' }}>
              自动刷新
            </Text>
          </Space>
        </Space>
      </div>

      {/* Error state */}
      {isError && (
        <AntAlert
          type="error"
          message="加载告警失败"
          description={getErrorMessage(error)}
          showIcon
          style={{ marginBottom: 12 }}
          action={
            <Button size="small" icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['alerts', buildingId] })}>
              重试
            </Button>
          }
        />
      )}

      {/* Loading state */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin size="small" />
        </div>
      )}

      {/* Alert list */}
      {!isLoading && !isError && (
        <>
          {filteredAlerts.length > 0 ? (
            <List
              dataSource={filteredAlerts}
              renderItem={(alert) => (
                <List.Item
                  key={alert.id}
                  onClick={() => onAlertClick?.(alert)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 12px',
                    marginBottom: 4,
                    borderRadius: 4,
                    cursor: onAlertClick ? 'pointer' : 'default',
                    backgroundColor: alert.acknowledged ? '#fafafa' : '#fff',
                    borderLeft: `3px solid ${alertLevelBorderColor(alert.level)}`,
                    opacity: alert.acknowledged ? 0.6 : 1,
                  }}
                >
                  <Text strong style={{ minWidth: 100, fontSize: 13 }}>
                    {alert.deviceName}
                  </Text>
                  <Text style={{ flex: 1, color: '#666', fontSize: 13 }}>
                    {alert.message}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12, minWidth: 80 }}>
                    {formatDateTime(alert.timestamp)}
                  </Text>
                  <Tag color={ALERT_LEVEL_COLORS[alert.level]}>
                    {ALERT_LEVEL_LABELS[alert.level]}
                  </Tag>
                  {!alert.acknowledged ? (
                    <Button
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        ackMutation.mutate(alert.id);
                      }}
                      loading={ackMutation.isPending && ackMutation.variables === alert.id}
                      style={{ fontSize: 12 }}
                    >
                      确认
                    </Button>
                  ) : (
                    <Tag color="default" style={{ fontSize: 11 }}>
                      已确认
                    </Tag>
                  )}
                </List.Item>
              )}
            />
          ) : (
            <Empty description={emptyDescription} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </>
      )}
    </div>
  );
}
