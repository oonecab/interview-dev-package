import type { ToolCall } from '../../types/chat';
import { getBuildings } from '../../api/buildings';
import { getDeviceDetail, getDevices } from '../../api/devices';
import { ackAlert, getAlerts } from '../../api/alerts';
import { createWorkOrder, getWorkOrders, updateWorkOrderStatus } from '../../api/workOrders';
import type { Device, DeviceStatus, DeviceType, Priority, WorkOrderStatus } from '../../types/domain';

// ---------- Types ----------

export interface ToolResult {
  success: boolean;
  /** JSON stringified result to send as tool message content */
  content: string;
  /** Human-readable summary for the status card */
  summary: string;
  /** Optional local assistant reply for handled no-op cases. */
  terminalMessage?: string;
  error?: string;
}

// ---------- Helpers ----------

function safeParseArgs(args: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(args);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function summarizeDevices(items: unknown[]): string {
  if (items.length === 0) return '未找到匹配的设备';
  return `返回 ${items.length} 台设备`;
}

function summarizeAlerts(items: unknown[]): string {
  if (items.length === 0) return '没有告警信息';
  return `返回 ${items.length} 条告警`;
}

function toContent(data: unknown): string {
  return JSON.stringify(data);
}

function getStringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizePriority(value: unknown): Priority {
  return typeof value === 'string' && ['low', 'medium', 'high'].includes(value)
    ? (value as Priority)
    : 'medium';
}

function normalizeWorkOrderStatus(value: unknown): WorkOrderStatus | null {
  return typeof value === 'string' && ['pending', 'assigned', 'in_progress', 'completed'].includes(value)
    ? (value as WorkOrderStatus)
    : null;
}

function inferDeviceQueryFromText(text: string): {
  buildingId?: string;
  status?: DeviceStatus;
  type?: DeviceType;
} {
  const buildingMatch = text.match(/B(\d)/i);
  const query: { buildingId?: string; status?: DeviceStatus; type?: DeviceType } = {};

  if (buildingMatch) query.buildingId = `B${buildingMatch[1]}`;
  if (/故障/.test(text)) query.status = 'fault';
  else if (/离线/.test(text)) query.status = 'offline';
  else if (/告警|警告/.test(text)) query.status = 'warning';

  if (/电梯/.test(text)) query.type = 'elevator';
  else if (/空调/.test(text)) query.type = 'hvac';
  else if (/水泵/.test(text)) query.type = 'pump';
  else if (/照明/.test(text)) query.type = 'lighting';
  else if (/消防/.test(text)) query.type = 'fire_pressure';

  return query;
}

function buildWorkOrderTitle(device: Device, fallbackTitle: string): string {
  if (fallbackTitle && fallbackTitle !== '新维修工单' && fallbackTitle !== '新工单') {
    return fallbackTitle;
  }
  return `${device.name}维修工单`;
}

function describeDeviceQuery(query: {
  buildingId?: string;
  status?: DeviceStatus;
  type?: DeviceType;
}): string {
  const statusText: Record<DeviceStatus, string> = {
    normal: '正常',
    warning: '告警',
    fault: '故障',
    offline: '离线',
  };
  const typeText: Record<DeviceType, string> = {
    elevator: '电梯',
    hvac: '空调',
    pump: '水泵',
    lighting: '照明',
    fire_pressure: '消防',
  };
  const parts = [
    query.buildingId ? `${query.buildingId}栋` : '',
    query.status ? statusText[query.status] : '',
    query.type ? typeText[query.type] : '',
  ].filter(Boolean);

  return parts.length > 0 ? parts.join('') : '匹配条件';
}

// ---------- Executor ----------

export async function executeToolCall(tc: ToolCall): Promise<ToolResult> {
  const { name, arguments: argsStr } = tc.function;
  const args = safeParseArgs(argsStr);

  if (args === null) {
    return {
      success: false,
      content: JSON.stringify({ error: 'Invalid tool arguments' }),
      summary: '工具参数解析失败',
      error: '参数不是有效的 JSON',
    };
  }

  switch (name) {
    case 'query_buildings': {
      try {
        const buildings = await getBuildings();
        return {
          success: true,
          content: toContent(buildings),
          summary: `返回 ${buildings.length} 栋楼宇`,
        };
      } catch (err) {
        return {
          success: false,
          content: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
          summary: '查询楼栋失败',
          error: err instanceof Error ? err.message : '未知错误',
        };
      }
    }

    case 'query_devices': {
      try {
        const params: { buildingId?: string; status?: DeviceStatus; type?: DeviceType } = {};
        const buildingId = getStringArg(args, 'buildingId');
        const status = getStringArg(args, 'status');
        const type = getStringArg(args, 'type');
        if (buildingId) params.buildingId = buildingId;
        if (status && ['normal', 'warning', 'fault', 'offline'].includes(status)) {
          params.status = status as DeviceStatus;
        }
        if (type && ['elevator', 'hvac', 'pump', 'lighting', 'fire_pressure'].includes(type)) {
          params.type = type as DeviceType;
        }
        const devices = await getDevices(params);
        return {
          success: true,
          content: toContent(devices),
          summary: summarizeDevices(devices),
        };
      } catch (err) {
        return {
          success: false,
          content: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
          summary: '查询设备失败',
          error: err instanceof Error ? err.message : '未知错误',
        };
      }
    }

    case 'get_device_detail': {
      try {
        const deviceId = getStringArg(args, 'deviceId') ?? getStringArg(args, 'id');
        if (!deviceId) {
          return {
            success: false,
            content: JSON.stringify({ error: 'deviceId is required' }),
            summary: '缺少设备ID',
            error: '调用设备详情接口需要 deviceId',
          };
        }
        const device = await getDeviceDetail(deviceId);
        return {
          success: true,
          content: toContent(device),
          summary: `返回设备详情：${device.name}`,
        };
      } catch (err) {
        return {
          success: false,
          content: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
          summary: '查询设备详情失败',
          error: err instanceof Error ? err.message : '未知错误',
        };
      }
    }

    case 'query_alerts': {
      try {
        const params: { buildingId?: string; level?: string; acknowledged?: boolean } = {};
        const buildingId = getStringArg(args, 'buildingId');
        const level = getStringArg(args, 'level');
        if (buildingId) params.buildingId = buildingId;
        if (level) params.level = level;
        if (typeof args.acknowledged === 'boolean') params.acknowledged = args.acknowledged;
        const alerts = await getAlerts(params);
        return {
          success: true,
          content: toContent(alerts),
          summary: summarizeAlerts(alerts),
        };
      } catch (err) {
        return {
          success: false,
          content: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
          summary: '查询告警失败',
          error: err instanceof Error ? err.message : '未知错误',
        };
      }
    }

    case 'ack_alert': {
      try {
        const alertId = getStringArg(args, 'alertId') ?? getStringArg(args, 'id');
        if (!alertId) {
          return {
            success: false,
            content: JSON.stringify({ error: 'alertId is required' }),
            summary: '缺少告警ID',
            error: '确认告警需要 alertId',
          };
        }
        const result = await ackAlert(alertId);
        return {
          success: true,
          content: toContent(result),
          summary: `告警已确认：${result.id}`,
        };
      } catch (err) {
        return {
          success: false,
          content: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
          summary: '确认告警失败',
          error: err instanceof Error ? err.message : '未知错误',
        };
      }
    }

    case 'query_work_orders': {
      try {
        const params: { status?: WorkOrderStatus } = {};
        const status = normalizeWorkOrderStatus(args.status);
        if (status) params.status = status;
        const workOrders = await getWorkOrders(params);
        return {
          success: true,
          content: toContent(workOrders),
          summary: workOrders.length === 0 ? '没有工单信息' : `返回 ${workOrders.length} 条工单`,
        };
      } catch (err) {
        return {
          success: false,
          content: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
          summary: '查询工单失败',
          error: err instanceof Error ? err.message : '未知错误',
        };
      }
    }

    case 'create_work_order': {
      try {
        const title = getStringArg(args, 'title') ?? '新工单';
        const description = getStringArg(args, 'description') ?? '';
        const deviceId = getStringArg(args, 'deviceId');
        const priority = normalizePriority(args.priority);

        if (!deviceId) {
          const query = inferDeviceQueryFromText(description);
          if (!query.buildingId && !query.status && !query.type) {
            return {
              success: false,
              content: JSON.stringify({ error: 'deviceId is required' }),
              summary: '缺少关联设备',
              error: '创建工单需要明确的 deviceId，或可推断的楼栋/状态/类型条件',
            };
          }

          const devices = await getDevices(query);
          if (devices.length === 0) {
            const target = describeDeviceQuery(query);
            return {
              success: true,
              content: JSON.stringify({
                created: [],
                skipped: true,
                reason: 'No matching devices',
                query,
              }),
              summary: '没有匹配设备，未创建工单',
              terminalMessage: `没有找到${target}设备，因此没有创建工单。`,
            };
          }

          const workOrders = await Promise.all(
            devices.map((device) =>
              createWorkOrder({
                title: buildWorkOrderTitle(device, title),
                description,
                deviceId: device.id,
                priority,
              }),
            ),
          );
          return {
            success: true,
            content: toContent(workOrders),
            summary: `已为 ${workOrders.length} 台设备创建工单`,
          };
        }

        const wo = await createWorkOrder({ title, description, deviceId, priority });
        return {
          success: true,
          content: toContent(wo),
          summary: `工单已创建：${wo.id}`,
        };
      } catch (err) {
        return {
          success: false,
          content: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
          summary: '创建工单失败',
          error: err instanceof Error ? err.message : '未知错误',
        };
      }
    }

    case 'update_work_order': {
      try {
        const workOrderId = getStringArg(args, 'workOrderId') ?? getStringArg(args, 'id');
        const status = normalizeWorkOrderStatus(args.status);
        if (!workOrderId || !status) {
          return {
            success: false,
            content: JSON.stringify({ error: 'workOrderId and status are required' }),
            summary: '缺少工单状态更新参数',
            error: '更新工单状态需要 workOrderId 和合法 status',
          };
        }
        const workOrder = await updateWorkOrderStatus(workOrderId, status);
        return {
          success: true,
          content: toContent(workOrder),
          summary: `工单已更新：${workOrder.id}`,
        };
      } catch (err) {
        return {
          success: false,
          content: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
          summary: '更新工单失败',
          error: err instanceof Error ? err.message : '未知错误',
        };
      }
    }

    default:
      return {
        success: false,
        content: JSON.stringify({ error: `Unknown tool: ${name}` }),
        summary: `未知工具：${name}`,
        error: `不支持的工具调用：${name}`,
      };
  }
}

// ---------- Display helpers ----------

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  query_buildings: '查询楼栋',
  query_devices: '查询设备',
  get_device_detail: '查询设备详情',
  query_alerts: '查询告警',
  ack_alert: '确认告警',
  query_work_orders: '查询工单',
  create_work_order: '创建工单',
  update_work_order: '更新工单',
};

export const TOOL_PROGRESS_MESSAGES: Record<string, string> = {
  query_buildings: '正在查询楼栋...',
  query_devices: '正在查询设备...',
  get_device_detail: '正在查询设备详情...',
  query_alerts: '正在查询告警...',
  ack_alert: '正在确认告警...',
  query_work_orders: '正在查询工单...',
  create_work_order: '正在创建工单...',
  update_work_order: '正在更新工单...',
};
