import type { DeviceStatus, DeviceType, AlertLevel, Priority, WorkOrderStatus } from '../types/domain';

export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  normal: '正常',
  warning: '告警',
  fault: '故障',
  offline: '离线',
};

export const DEVICE_STATUS_COLORS: Record<DeviceStatus, string> = {
  normal: 'green',
  warning: 'orange',
  fault: 'red',
  offline: 'default',
};

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  elevator: '电梯',
  hvac: '空调',
  pump: '水泵',
  lighting: '照明',
  fire_pressure: '消防',
};

export const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  critical: '严重',
  warning: '警告',
  info: '信息',
};

export const ALERT_LEVEL_COLORS: Record<AlertLevel, string> = {
  critical: 'red',
  warning: 'orange',
  info: 'blue',
};

/**
 * Returns the CSS border color for a given AlertLevel.
 * Centralizes the color mapping so both DeviceDetailDrawer and DeviceAlertPanel stay in sync.
 */
export function alertLevelBorderColor(level: AlertLevel): string {
  const color = ALERT_LEVEL_COLORS[level];
  if (color === 'red') return '#ff4d4f';
  if (color === 'orange') return '#faad14';
  return '#1890ff';
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'green',
  medium: 'orange',
  high: 'red',
};

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  pending: '待派单',
  assigned: '已派单',
  in_progress: '处理中',
  completed: '已完成',
};

export const WORK_ORDER_STATUS_COLORS: Record<WorkOrderStatus, string> = {
  pending: 'default',
  assigned: 'blue',
  in_progress: 'orange',
  completed: 'green',
};
