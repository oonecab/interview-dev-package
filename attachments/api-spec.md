# Mock API 接口规格说明

Base URL: `http://localhost:3001`

> Mock server 自带 CORS 支持，前端开发时直接请求即可。

---

## 1. 楼栋

### GET /api/buildings

返回所有楼栋列表。

**Response 200:**
```json
[
  {
    "id": "B1",
    "name": "B1 栋",
    "floors": 20,
    "deviceCount": 32
  }
]
```

---

## 2. 设备

### GET /api/devices

返回设备列表，支持查询参数过滤。

**Query Parameters:**

| 参数 | 类型 | 说明 |
|---|---|---|
| `buildingId` | string | 按楼栋筛选（如 `B1`） |
| `status` | string | 按状态筛选：`normal` / `warning` / `fault` / `offline` |
| `type` | string | 按类型筛选：`elevator` / `hvac` / `pump` / `lighting` / `fire_pressure` |

**Response 200:**
```json
[
  {
    "id": "elevator_001",
    "name": "电梯_001",
    "type": "elevator",
    "typeName": "电梯",
    "buildingId": "B1",
    "floor": 8,
    "status": "normal",
    "lastUpdated": "2026-04-15T14:32:00Z"
  }
]
```

### GET /api/devices/:id

返回单个设备详情。

**Response 200:**
```json
{
  "id": "elevator_002",
  "name": "电梯_002",
  "type": "elevator",
  "typeName": "电梯",
  "buildingId": "B1",
  "floor": 1,
  "status": "warning",
  "lastUpdated": "2026-04-15T14:30:00Z",
  "alerts": [
    {
      "id": "alt_001",
      "level": "warning",
      "message": "门故障告警",
      "timestamp": "2026-04-15T14:30:00Z",
      "acknowledged": false
    }
  ]
}
```

---

## 3. 告警

### GET /api/alerts

返回告警列表。

**Query Parameters:**

| 参数 | 类型 | 说明 |
|---|---|---|
| `buildingId` | string | 按楼栋筛选 |
| `level` | string | `critical` / `warning` / `info` |
| `acknowledged` | boolean | `true` / `false` |

**Response 200:**
```json
[
  {
    "id": "alt_001",
    "deviceId": "elevator_002",
    "deviceName": "电梯_002",
    "level": "warning",
    "message": "门故障告警",
    "timestamp": "2026-04-15T14:30:00Z",
    "acknowledged": false
  }
]
```

### POST /api/alerts/:id/ack

确认一条告警。

**Response 200:**
```json
{
  "id": "alt_001",
  "acknowledged": true
}
```

---

## 4. 工单

### GET /api/work-orders

返回工单列表。

**Query Parameters:**

| 参数 | 类型 | 说明 |
|---|---|---|
| `status` | string | `pending` / `assigned` / `in_progress` / `completed` |

**Response 200:**
```json
[
  {
    "id": "WO-001",
    "title": "B1电梯门故障修复",
    "description": "B1栋1楼电梯门频繁卡住，需要维修",
    "deviceId": "elevator_002",
    "deviceName": "电梯_002",
    "status": "in_progress",
    "priority": "high",
    "createdAt": "2026-04-14T09:15:00Z",
    "updatedAt": "2026-04-14T11:30:00Z"
  }
]
```

### POST /api/work-orders

创建新工单。

**Request Body:**
```json
{
  "title": "B3空调不制冷",
  "description": "B3栋5楼空调出风温度过高",
  "deviceId": "hvac_008",
  "priority": "medium"
}
```

**Response 201:**
```json
{
  "id": "WO-011",
  "title": "B3空调不制冷",
  "description": "B3栋5楼空调出风温度过高",
  "deviceId": "hvac_008",
  "deviceName": "空调_008",
  "status": "pending",
  "priority": "medium",
  "createdAt": "2026-04-15T16:00:00Z",
  "updatedAt": "2026-04-15T16:00:00Z"
}
```

### PATCH /api/work-orders/:id

更新工单状态。

**Request Body:**
```json
{
  "status": "assigned"
}
```

合法的状态转移：`pending` → `assigned` → `in_progress` → `completed`

**Response 200:** 返回更新后的完整工单对象。

---

## 5. Chat API（AI 助手）

### POST /api/chat

发送对话消息，获取 AI 回复。支持 Tool Calling。

**Request Body:**
```json
{
  "messages": [
    { "role": "user", "content": "B3栋有哪些故障设备？" }
  ]
}
```

**Response 200 — 纯文本回复:**
```json
{
  "role": "assistant",
  "content": "你好！我可以帮你查询设备状态、查看告警、创建工单。请问需要什么帮助？"
}
```

**Response 200 — Tool Calling 回复:**
```json
{
  "role": "assistant",
  "content": null,
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "query_devices",
        "arguments": "{\"buildingId\":\"B3\",\"status\":\"fault\"}"
      }
    }
  ]
}
```

### Tool Calling 流程

当收到 `tool_calls` 时，前端需要：

1. **执行工具调用** — 根据 `function.name` 调用对应的 API（见下表）
2. **将结果发回** — 在 `messages` 数组中追加 `tool` 角色的消息
3. **再次请求** — 发送完整的 messages 获取 AI 最终回复

**第二次请求示例:**
```json
{
  "messages": [
    { "role": "user", "content": "B3栋有哪些故障设备？" },
    {
      "role": "assistant",
      "content": null,
      "tool_calls": [
        {
          "id": "call_abc123",
          "type": "function",
          "function": {
            "name": "query_devices",
            "arguments": "{\"buildingId\":\"B3\",\"status\":\"fault\"}"
          }
        }
      ]
    },
    {
      "role": "tool",
      "tool_call_id": "call_abc123",
      "content": "[{\"id\":\"hvac_008\",\"name\":\"空调_008\",\"status\":\"fault\",\"floor\":5}]"
    }
  ]
}
```

**第二次响应（最终回复）:**
```json
{
  "role": "assistant",
  "content": "B3栋目前有 1 台故障设备：\n\n- 空调_008（5楼）：状态为故障\n\n需要我帮你创建维修工单吗？"
}
```

### 支持的工具

| 工具名 | 描述 | 参数 | 对应 API |
|---|---|---|---|
| `query_devices` | 查询设备列表 | `buildingId?`, `status?`, `type?` | `GET /api/devices` |
| `query_alerts` | 查询告警列表 | `buildingId?`, `level?` | `GET /api/alerts` |
| `create_work_order` | 创建工单 | `title`, `description`, `deviceId`, `priority` | `POST /api/work-orders` |

---

## 6. 错误响应

所有接口的错误响应格式统一：

```json
{
  "error": "Not found",
  "message": "Device with id 'xxx' not found"
}
```

常见状态码：
- `400` — 请求参数有误
- `404` — 资源不存在
- `422` — 非法的状态转移（如工单从 pending 直接跳到 completed）
- `500` — 服务器内部错误
