/**
 * Smart Space Mock API Server
 *
 * 提供设备、告警、工单的 CRUD 接口和模拟 LLM Chat 接口。
 * 启动: node server.js
 * 端口: 3001
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ============ 加载数据 ============

const dataPath = path.join(__dirname, 'data.json');
let db = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// 自增 ID 计数器
let workOrderCounter = db.workOrders.length + 1;

// ============ 楼栋 ============

app.get('/api/buildings', (req, res) => {
  res.json(db.buildings);
});

// ============ 设备 ============

app.get('/api/devices', (req, res) => {
  let result = [...db.devices];
  if (req.query.buildingId) {
    result = result.filter(d => d.buildingId === req.query.buildingId);
  }
  if (req.query.status) {
    result = result.filter(d => d.status === req.query.status);
  }
  if (req.query.type) {
    result = result.filter(d => d.type === req.query.type);
  }
  res.json(result);
});

app.get('/api/devices/:id', (req, res) => {
  const device = db.devices.find(d => d.id === req.params.id);
  if (!device) {
    return res.status(404).json({ error: 'Not found', message: `Device '${req.params.id}' not found` });
  }
  // 附带该设备的告警
  const alerts = db.alerts.filter(a => a.deviceId === device.id);
  res.json({ ...device, alerts });
});

// ============ 告警 ============

app.get('/api/alerts', (req, res) => {
  let result = [...db.alerts];
  if (req.query.buildingId) {
    result = result.filter(a => a.buildingId === req.query.buildingId);
  }
  if (req.query.level) {
    result = result.filter(a => a.level === req.query.level);
  }
  if (req.query.acknowledged !== undefined) {
    const ack = req.query.acknowledged === 'true';
    result = result.filter(a => a.acknowledged === ack);
  }
  res.json(result);
});

app.post('/api/alerts/:id/ack', (req, res) => {
  const alert = db.alerts.find(a => a.id === req.params.id);
  if (!alert) {
    return res.status(404).json({ error: 'Not found', message: `Alert '${req.params.id}' not found` });
  }
  alert.acknowledged = true;
  res.json({ id: alert.id, acknowledged: true });
});

// ============ 工单 ============

const VALID_TRANSITIONS = {
  pending: ['assigned'],
  assigned: ['in_progress'],
  in_progress: ['completed'],
  completed: [],
};

app.get('/api/work-orders', (req, res) => {
  let result = [...db.workOrders];
  if (req.query.status) {
    result = result.filter(wo => wo.status === req.query.status);
  }
  res.json(result);
});

app.post('/api/work-orders', (req, res) => {
  const { title, description, deviceId, priority } = req.body;
  if (!title || !deviceId) {
    return res.status(400).json({ error: 'Bad request', message: 'title and deviceId are required' });
  }

  const device = db.devices.find(d => d.id === deviceId);
  const now = new Date().toISOString();

  const wo = {
    id: `WO-${String(workOrderCounter++).padStart(3, '0')}`,
    title,
    description: description || '',
    deviceId,
    deviceName: device ? device.name : deviceId,
    status: 'pending',
    priority: priority || 'medium',
    createdAt: now,
    updatedAt: now,
  };

  db.workOrders.push(wo);
  res.status(201).json(wo);
});

app.patch('/api/work-orders/:id', (req, res) => {
  const wo = db.workOrders.find(w => w.id === req.params.id);
  if (!wo) {
    return res.status(404).json({ error: 'Not found', message: `Work order '${req.params.id}' not found` });
  }

  if (req.body.status) {
    const allowed = VALID_TRANSITIONS[wo.status] || [];
    if (!allowed.includes(req.body.status)) {
      return res.status(422).json({
        error: 'Invalid transition',
        message: `Cannot transition from '${wo.status}' to '${req.body.status}'. Allowed: ${allowed.join(', ') || 'none'}`,
      });
    }
    wo.status = req.body.status;
  }

  wo.updatedAt = new Date().toISOString();
  res.json(wo);
});

// ============ Chat API (Mock LLM) ============

/**
 * 模拟 LLM 对话接口，支持 Tool Calling。
 *
 * 规则：
 * 1. 如果消息列表末尾是 user 角色且包含设备/告警/工单相关关键词 → 返回 tool_calls
 * 2. 如果消息列表末尾是 tool 角色 → 根据工具结果生成文本回复
 * 3. 其他情况 → 返回通用文本回复
 */
app.post('/api/chat', (req, res) => {
  // 模拟延迟 300-800ms
  const delay = 300 + Math.random() * 500;

  setTimeout(() => {
    const messages = req.body.messages || [];
    const lastMsg = messages[messages.length - 1];

    if (!lastMsg) {
      return res.json({
        role: 'assistant',
        content: '你好！我是智慧空间 AI 助手，可以帮你查询设备状态、查看告警、创建工单。请问有什么需要帮助的？',
      });
    }

    // 如果最后一条是 tool 结果 → 生成总结回复
    if (lastMsg.role === 'tool') {
      const toolCallId = lastMsg.tool_call_id;
      const toolResult = safeParseJSON(lastMsg.content);

      // 找到对应的 tool_call 来确定工具名
      let toolName = 'unknown';
      for (const msg of messages) {
        if (msg.tool_calls) {
          const tc = msg.tool_calls.find(t => t.id === toolCallId);
          if (tc) {
            toolName = tc.function.name;
            break;
          }
        }
      }

      const summary = generateToolSummary(toolName, toolResult);
      return res.json({ role: 'assistant', content: summary });
    }

    // 如果最后一条是 user 消息 → 分析意图
    if (lastMsg.role === 'user') {
      const text = lastMsg.content || '';
      const intent = detectIntent(text);

      if (intent) {
        return res.json({
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: `call_${crypto.randomBytes(6).toString('hex')}`,
            type: 'function',
            function: intent,
          }],
        });
      }

      // 无法识别意图 → 通用回复
      return res.json({
        role: 'assistant',
        content: generateGenericReply(text),
      });
    }

    // 其他情况
    res.json({
      role: 'assistant',
      content: '我可以帮你查询设备状态、查看告警信息、创建维修工单。请告诉我你需要什么帮助？',
    });
  }, delay);
});

// ============ Chat 辅助函数 ============

function safeParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function detectIntent(text) {
  const lower = text.toLowerCase();

  // 创建工单意图
  if (/创建工单|新建工单|提交工单|报修/.test(text)) {
    // 尝试提取设备ID
    const deviceMatch = text.match(/(elevator|hvac|pump|lighting|fire)_\d+/);
    const titleMatch = text.match(/(?:标题|主题)[：:]\s*(.+?)(?:\s|$|[，,])/);
    return {
      name: 'create_work_order',
      arguments: JSON.stringify({
        title: titleMatch ? titleMatch[1] : '新维修工单',
        description: text,
        deviceId: deviceMatch ? deviceMatch[0] : '',
        priority: /紧急|严重|高/.test(text) ? 'high' : 'medium',
      }),
    };
  }

  // 查询告警意图
  if (/告警|报警|异常/.test(text)) {
    const buildingMatch = text.match(/B(\d)/i);
    const args = {};
    if (buildingMatch) args.buildingId = `B${buildingMatch[1]}`;
    if (/严重|critical/.test(lower)) args.level = 'critical';
    if (/警告|warning/.test(lower)) args.level = 'warning';
    return {
      name: 'query_alerts',
      arguments: JSON.stringify(args),
    };
  }

  // 查询设备意图
  if (/设备|电梯|空调|水泵|照明|消防|故障|离线|状态/.test(text)) {
    const buildingMatch = text.match(/B(\d)/i);
    const args = {};
    if (buildingMatch) args.buildingId = `B${buildingMatch[1]}`;
    if (/故障/.test(text)) args.status = 'fault';
    if (/离线/.test(text)) args.status = 'offline';
    if (/告警|警告/.test(text)) args.status = 'warning';
    if (/电梯/.test(text)) args.type = 'elevator';
    if (/空调/.test(text)) args.type = 'hvac';
    if (/水泵/.test(text)) args.type = 'pump';
    if (/照明/.test(text)) args.type = 'lighting';
    return {
      name: 'query_devices',
      arguments: JSON.stringify(args),
    };
  }

  return null;
}

function generateToolSummary(toolName, result) {
  if (!result) return '抱歉，查询没有返回结果。';

  const items = Array.isArray(result) ? result : [result];

  switch (toolName) {
    case 'query_devices': {
      if (items.length === 0) return '未找到匹配的设备。';
      const statusMap = { normal: '正常', warning: '告警', fault: '故障', offline: '离线' };
      const list = items.map(d => `- ${d.name}（${d.buildingId}-${d.floor}F）：${statusMap[d.status] || d.status}`).join('\n');
      return `找到 ${items.length} 台设备：\n\n${list}\n\n需要我帮你创建维修工单吗？`;
    }

    case 'query_alerts': {
      if (items.length === 0) return '当前没有告警信息。';
      const list = items.map(a => `- ${a.deviceName}：${a.message}（${a.level}${a.acknowledged ? '，已确认' : ''}）`).join('\n');
      return `找到 ${items.length} 条告警：\n\n${list}\n\n需要对某条告警进行处理吗？`;
    }

    case 'create_work_order': {
      const wo = items[0];
      return `工单已创建成功！\n\n- 编号：${wo.id}\n- 标题：${wo.title}\n- 状态：待派单\n- 优先级：${wo.priority === 'high' ? '高' : wo.priority === 'medium' ? '中' : '低'}\n\n你可以在工单管理页面查看详情。`;
    }

    default:
      return `工具调用完成，返回了 ${items.length} 条结果。`;
  }
}

function generateGenericReply(text) {
  if (/你好|hi|hello/i.test(text)) {
    return '你好！我是智慧空间 AI 助手。我可以帮你：\n\n1. 查询设备状态（如"B3栋有哪些故障设备？"）\n2. 查看告警信息（如"有哪些严重告警？"）\n3. 创建维修工单（如"给水泵_003创建一个维修工单"）\n\n请问有什么需要帮助的？';
  }
  if (/谢谢|感谢|thanks/i.test(text)) {
    return '不客气！如果还有其他需要，随时告诉我。';
  }
  if (/工单/.test(text)) {
    return '关于工单，我可以帮你创建新工单。请告诉我：\n1. 哪个设备需要维修？\n2. 问题描述\n3. 优先级（高/中/低）\n\n例如："给空调_008创建一个高优先级工单，空调不制冷"';
  }
  return '我可以帮你查询设备状态、查看告警信息、创建维修工单。请告诉我你需要什么帮助？\n\n试试这样问：\n- "B3栋有哪些故障设备？"\n- "有哪些未确认的告警？"\n- "给电梯_005创建一个维修工单"';
}

// ============ 启动 ============

app.listen(PORT, () => {
  console.log(`🚀 Smart Space Mock API running at http://localhost:${PORT}`);
  console.log(`   ${db.buildings.length} buildings, ${db.devices.length} devices, ${db.alerts.length} alerts, ${db.workOrders.length} work orders`);
  console.log('');
  console.log('Available endpoints:');
  console.log('   GET  /api/buildings');
  console.log('   GET  /api/devices?buildingId=&status=&type=');
  console.log('   GET  /api/devices/:id');
  console.log('   GET  /api/alerts?buildingId=&level=&acknowledged=');
  console.log('   POST /api/alerts/:id/ack');
  console.log('   GET  /api/work-orders?status=');
  console.log('   POST /api/work-orders');
  console.log('   PATCH /api/work-orders/:id');
  console.log('   POST /api/chat');
});
