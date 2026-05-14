import { Card, Row, Col, Statistic, Tag } from 'antd';
import type { Device, DeviceStatus, DeviceType } from '../../types/domain';
import {
  DEVICE_TYPE_LABELS,
  DEVICE_STATUS_LABELS,
  DEVICE_STATUS_COLORS,
} from '../../utils/labels';

interface DeviceStatsProps {
  devices: Device[];
}

const ALL_TYPES: DeviceType[] = ['elevator', 'hvac', 'pump', 'lighting', 'fire_pressure'];
const ALL_STATUSES: DeviceStatus[] = ['normal', 'warning', 'fault', 'offline'];

export function DeviceStats({ devices }: DeviceStatsProps) {
  const typeCounts: Record<DeviceType, number> = {
    elevator: 0,
    hvac: 0,
    pump: 0,
    lighting: 0,
    fire_pressure: 0,
  };

  const statusCounts: Record<DeviceStatus, number> = {
    normal: 0,
    warning: 0,
    fault: 0,
    offline: 0,
  };

  for (const d of devices) {
    typeCounts[d.type]++;
    statusCounts[d.status]++;
  }

  return (
    <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
      <Row gutter={[8, 8]}>
        {ALL_TYPES.map((type) => (
          <Col key={type} xs={24} sm={12} md={12} lg={4} xl={4}>
            <Statistic
              title={DEVICE_TYPE_LABELS[type]}
              value={typeCounts[type]}
              suffix="台"
              valueStyle={{ fontSize: 20 }}
            />
          </Col>
        ))}
      </Row>
      <Row
        gutter={[8, 0]}
        style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}
      >
        {ALL_STATUSES.map((status) => (
          <Col key={status}>
            <Tag
              color={DEVICE_STATUS_COLORS[status]}
              style={{ marginRight: 4, fontSize: 13 }}
            >
              {DEVICE_STATUS_LABELS[status]} {statusCounts[status]}
            </Tag>
          </Col>
        ))}
      </Row>
    </Card>
  );
}
