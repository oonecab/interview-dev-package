import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal, Form, Input, Select, Radio, App } from 'antd';
import { getDevices } from '../../api/devices';
import { createWorkOrder } from '../../api/workOrders';
import type { Priority, Device } from '../../types/domain';
import { PRIORITY_LABELS, DEVICE_TYPE_LABELS } from '../../utils/labels';
import { getErrorMessage } from '../../utils/error';

const { TextArea } = Input;

interface CreateWorkOrderModalProps {
  open: boolean;
  onClose: () => void;
  preselectedDeviceId?: string;
}

interface FormValues {
  title: string;
  description: string;
  deviceId: string;
  priority: Priority;
}

export function CreateWorkOrderModal({
  open,
  onClose,
  preselectedDeviceId,
}: CreateWorkOrderModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const { data: devices = [], isLoading: loadingDevices } = useQuery({
    queryKey: ['devices', 'list'],
    queryFn: () => getDevices(),
    enabled: open,
  });

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await createWorkOrder(values);
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      message.success('工单创建成功');
      form.resetFields();
      onClose();
    } catch (err) {
      message.error(getErrorMessage(err, '创建工单失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  // Pre-fill device when modal opens with preselected device
  const handleAfterOpenChange = (visible: boolean) => {
    if (visible && preselectedDeviceId) {
      form.setFieldsValue({ deviceId: preselectedDeviceId });
    }
  };

  return (
    <Modal
      title="创建工单"
      open={open}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      destroyOnHidden
      afterOpenChange={handleAfterOpenChange}
      okText="提交"
      cancelText="取消"
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ priority: 'medium' }}
      >
        <Form.Item
          name="title"
          label="标题"
          rules={[{ required: true, message: '请输入工单标题' }]}
        >
          <Input placeholder="请输入工单标题" />
        </Form.Item>

        <Form.Item
          name="description"
          label="描述"
          rules={[{ required: true, message: '请输入问题描述' }]}
        >
          <TextArea rows={3} placeholder="请描述设备问题和维修需求" />
        </Form.Item>

        <Form.Item
          name="deviceId"
          label="关联设备"
          rules={[{ required: true, message: '请选择关联设备' }]}
        >
          <Select
            placeholder="请选择设备"
            loading={loadingDevices}
            showSearch
            optionFilterProp="label"
            options={devices.map((d: Device) => ({
              value: d.id,
              label: `${d.name} (${d.buildingId} ${DEVICE_TYPE_LABELS[d.type]})`,
            }))}
          />
        </Form.Item>

        <Form.Item
          name="priority"
          label="优先级"
          rules={[{ required: true, message: '请选择优先级' }]}
        >
          <Radio.Group>
            <Radio value="low">{PRIORITY_LABELS.low}</Radio>
            <Radio value="medium">{PRIORITY_LABELS.medium}</Radio>
            <Radio value="high">{PRIORITY_LABELS.high}</Radio>
          </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
}
