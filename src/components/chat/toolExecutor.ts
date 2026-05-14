import type { ToolCall } from '../../types/chat';
import { getDevices } from '../../api/devices';
import { getAlerts } from '../../api/alerts';
import { createWorkOrder } from '../../api/workOrders';

// ---------- Types ----------

export interface ToolResult {
  success: boolean;
  /** JSON stringified result to send as tool message content */
  content: string;
  /** Human-readable summary for the status card */
  summary: string;
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
    case 'query_devices': {
      try {
        const params: Record<string, string> = {};
        if (typeof args.buildingId === 'string') params.buildingId = args.buildingId;
        if (typeof args.status === 'string') params.status = args.status;
        if (typeof args.type === 'string') params.type = args.type;
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

    case 'query_alerts': {
      try {
        const params: Record<string, string> = {};
        if (typeof args.buildingId === 'string') params.buildingId = args.buildingId;
        if (typeof args.level === 'string') params.level = args.level;
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

    case 'create_work_order': {
      try {
        const title = typeof args.title === 'string' ? args.title : '新工单';
        const description = typeof args.description === 'string' ? args.description : '';
        const deviceId = typeof args.deviceId === 'string' ? args.deviceId : '';
        const priority =
          typeof args.priority === 'string' &&
          ['low', 'medium', 'high'].includes(args.priority)
            ? (args.priority as 'low' | 'medium' | 'high')
            : 'medium';

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
  query_devices: '查询设备',
  query_alerts: '查询告警',
  create_work_order: '创建工单',
};

export const TOOL_PROGRESS_MESSAGES: Record<string, string> = {
  query_devices: '正在查询设备...',
  query_alerts: '正在查询告警...',
  create_work_order: '正在创建工单...',
};
