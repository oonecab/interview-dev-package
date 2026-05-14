import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Drawer,
  Descriptions,
  Tag,
  Typography,
  Button,
  Steps,
  Alert,
  Space,
  App,
} from 'antd';
import { updateWorkOrderStatus } from '../../api/workOrders';
import type { WorkOrder } from '../../types/domain';
import {
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from '../../utils/labels';
import { formatDateTime } from '../../utils/format';
import { getErrorMessage } from '../../utils/error';
import { getNextWorkOrderStatus, getWorkOrderStepIndex } from '../../utils/statusFlow';

const { Text, Title } = Typography;

interface WorkOrderDetailDrawerProps {
  workOrder: WorkOrder | null;
  onClose: () => void;
}

const STEP_ITEMS = [
  { title: '待派单' },
  { title: '已派单' },
  { title: '处理中' },
  { title: '已完成' },
];

export function WorkOrderDetailDrawer({ workOrder, onClose }: WorkOrderDetailDrawerProps) {
  const [advancing, setAdvancing] = useState(false);
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  if (!workOrder) return null;

  const currentStep = getWorkOrderStepIndex(workOrder.status);
  const nextStatus = getNextWorkOrderStatus(workOrder.status);

  const handleAdvance = async () => {
    if (!nextStatus) return;
    setAdvancing(true);
    try {
      await updateWorkOrderStatus(workOrder.id, nextStatus);
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      message.success(
        `工单状态已更新: ${WORK_ORDER_STATUS_LABELS[workOrder.status]} → ${WORK_ORDER_STATUS_LABELS[nextStatus]}`,
      );
      onClose();
    } catch (err) {
      message.error(getErrorMessage(err, '状态更新失败'));
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <Drawer
      title={
        <Space>
          <Text strong style={{ fontSize: 16 }}>
            {workOrder.id}
          </Text>
          <Tag color={WORK_ORDER_STATUS_COLORS[workOrder.status]}>
            {WORK_ORDER_STATUS_LABELS[workOrder.status]}
          </Tag>
        </Space>
      }
      open
      onClose={onClose}
      width={520}
    >
      <Title level={5} style={{ marginBottom: 16 }}>
        {workOrder.title}
      </Title>

      <Descriptions column={2} size="small" bordered style={{ marginBottom: 24 }}>
        <Descriptions.Item label="编号">{workOrder.id}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={WORK_ORDER_STATUS_COLORS[workOrder.status]}>
            {WORK_ORDER_STATUS_LABELS[workOrder.status]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="优先级">
          <Tag color={PRIORITY_COLORS[workOrder.priority]}>
            {PRIORITY_LABELS[workOrder.priority]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="关联设备">
          {workOrder.deviceName}
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {formatDateTime(workOrder.createdAt)}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {formatDateTime(workOrder.updatedAt)}
        </Descriptions.Item>
        <Descriptions.Item label="描述" span={2}>
          {workOrder.description || '无描述'}
        </Descriptions.Item>
      </Descriptions>

      <Title level={5} style={{ marginBottom: 12 }}>
        状态流转
      </Title>

      <Steps
        current={currentStep}
        size="small"
        items={STEP_ITEMS}
        style={{ marginBottom: 24 }}
      />

      {nextStatus ? (
        <Button
          type="primary"
          loading={advancing}
          onClick={handleAdvance}
          block
        >
          推进到{WORK_ORDER_STATUS_LABELS[nextStatus]}
        </Button>
      ) : (
        <Alert
          type="success"
          message="此工单已完成，无需进一步操作"
          showIcon
        />
      )}
    </Drawer>
  );
}
