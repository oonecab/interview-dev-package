# 设计说明

## 项目结构与组件划分

```
src/api          — API 请求层：统一 client 封装、各业务域接口函数
src/types        — TypeScript 类型：domain（Building/Device/Alert/WorkOrder 等）、chat（ChatMessage/ToolCall 等）
src/utils        — 工具函数：format（时间/楼层格式化）、labels（中文标签/颜色）、statusFlow（工单流转）、error（统一错误提取）
src/components/
  layout         — AppShell（三栏布局+页面切换）、BuildingSidebar（楼栋选择+筛选）
  devices        — DeviceDashboard（设备看板容器）、DeviceStats（统计卡片）、DeviceTable（设备表格）、DeviceDetailDrawer（设备详情抽屉）
  alerts         — DeviceAlertPanel（告警面板，修复自 buggy-component.tsx）
  work-orders    — WorkOrderPage（工单管理容器）、WorkOrderTable（工单表格）、WorkOrderDetailDrawer（工单详情+流转）、CreateWorkOrderModal（创建工单表单）
  chat           — ChatSidebar（AI 聊天 UI）、toolExecutor（工具执行器）、chatProtocol（显示消息↔API 协议转换）
tests/           — 自动化测试目录，按 src 模块镜像组织；setupTests.ts 统一放置 jsdom/Ant Design polyfill
```

## 状态管理方案

- **服务端数据**：使用 TanStack React Query 管理所有 API 请求（楼栋、设备、告警、工单、Chat）。React Query 处理缓存、refetch、loading/error 状态，避免手动管理 useEffect/useState 的复杂性。
- **局部 UI 状态**：使用 React useState 管理页面筛选（selectedBuildingId、selectedStatus、selectedType）、抽屉开关、表单可见性等纯 UI 状态。
- **AI 聊天消息**：`chatMessages` 状态提升到 `AppShell`，通过 props 传入 `ChatSidebar`。这样关闭 AI 侧栏后重新打开，消息历史仍然保留。

**为什么没有引入 Redux/Zustand？** 当前应用的服务端数据全部由 React Query 管理，UI 状态简单且局限在单组件内。引入全局状态库会增加样板代码和心智负担，而实际收益很小。Chat 消息状态只需跨一个父子组件边界，用 `useState` + props 提升足够。

## 模块说明

### 设备看板（DeviceDashboard）
- 双查询架构：表格用 `['devices', 'list', filterParams]` 支持筛选，统计用 `['devices', 'list', { buildingId }]` 只看全量，互不干扰。
- 默认选中第一个楼栋（BuildingSidebar 中 useEffect 自动选中）。
- 设备详情 Drawer 调用 `GET /api/devices/:id` 获取设备信息和关联告警。

### 告警面板（DeviceAlertPanel）
- 修复自 `buggy-component.tsx` 的 3 个 bug（详见 `docs/bug-fixes.md`）。
- 使用 React Query `useQuery(['alerts', buildingId])` + `refetchInterval` 实现自动刷新。
- 告警确认使用 `useMutation` + `queryClient.setQueryData` 不可变更新缓存。

### 工单管理（WorkOrderPage）
- 工单列表一次拉取 `GET /api/work-orders` 的完整数组，在前端做本地搜索、状态筛选、优先级筛选和分页，避免扩展 mock server 接口。
- 搜索覆盖工单编号、标题、描述、设备 ID、设备名称；筛选结果计数会和总数同时展示。
- 状态流转通过 `getNextWorkOrderStatus` / `getWorkOrderStepIndex`（`utils/statusFlow.ts`）驱动 Ant Design Steps。
- 创建工单成功后 `invalidateQueries(['workOrders'])` 刷新列表。

### AI 助手（ChatSidebar）
- `ChatDisplayMessage` 类型支持 `user` / `assistant` / `tool-status` 三种角色。
- Tool Calling 流程：`用户输入 → POST /api/chat → tool_calls → 执行工具 → 追加 tool 消息 → 再次 POST /api/chat → 展示最终回复`。
- `chatProtocol.ts` 负责从 `ChatDisplayMessage[]` 构建 `/api/chat` 请求的 `ChatMessage[]`，实现显示层和协议层的清晰分离。
- `toolExecutor.ts` 覆盖 `api-spec.md` 中所有业务接口对应的工具：楼栋查询、设备列表、设备详情、告警查询、告警确认、工单查询、创建工单、更新工单。
- `create_work_order` 增加参数兜底：当 LLM 返回空 `deviceId`，但用户描述中能推断楼栋/状态/类型时，先查询设备，再为匹配设备逐个创建工单；无法推断时返回参数提示，没有匹配设备时返回正常 no-op 提示，不会发送空 `deviceId` 的创建请求。

## Tool Calling 流程

1. 用户输入消息，通过 `buildApiMessages` 将显示消息转为 API 格式。
2. `POST /api/chat`，如果返回 `content` 非空，直接展示文本回复。
3. 如果返回 `tool_calls`：
   a. 展示工具状态卡片（running），每个卡片记录 `toolCallsBatch`。
   b. `Promise.all` 调用 `executeToolCall` 并行执行工具。
   c. 更新卡片为 success/error 状态。
   d. 将工具结果构建为 `role: "tool"` 消息。
   e. 再次 `POST /api/chat`，获取最终 assistant 文本。
4. `create_work_order` 成功后 `invalidateQueries(['workOrders'])`。
5. 最多 2 轮 Tool Calling，超限提示用户。

### 创建工单兜底流程

针对“对 B1 栋出现故障的设备创建工单”这类没有明确设备 ID 的请求，mock LLM 可能返回：

```json
{
  "name": "create_work_order",
  "arguments": "{\"title\":\"新维修工单\",\"description\":\"对B1栋出现故障的设备创建工单\",\"deviceId\":\"\",\"priority\":\"medium\"}"
}
```

前端不会直接把空 `deviceId` 提交给 `POST /api/work-orders`，而是从 `description` 推断 `{ buildingId: "B1", status: "fault" }`，先调用 `GET /api/devices`，再为返回的设备创建工单。这把不完整的 LLM 参数修正为可审计的 API 流程。

如果查询结果为空，例如“对 B2 栋出现故障的设备创建工单”但 B2 没有故障设备，工具执行结果会被视为业务 no-op：状态卡片显示“没有匹配设备，未创建工单”，助手直接回复“没有找到 B2 栋故障设备，因此没有创建工单”，不会展示“工具调用全部失败”，也不会调用 `POST /api/work-orders`。

## 主要权衡

- **React Query 的 refetchInterval vs 手动 setInterval**：选择前者，因为 React Query 自动处理组件卸载时的 timer 清理，且 `refetchInterval: false` 可以优雅停止，避免 buggy-component 的 timer 泄漏问题。
- **chatProtocol 独立模块**：将 `buildApiMessages` 抽出可单独测试，确保工具调用的 assistant/tool 消息重建逻辑正确，不依赖 UI 渲染。
- **测试策略**：测试集中放在 `tests/` 目录，按 `src/` 模块镜像组织。优先覆盖纯逻辑（statusFlow、toolExecutor、chatProtocol、DeviceStats），其次覆盖核心交互（DeviceAlertPanel、CreateWorkOrderModal、WorkOrderDetailDrawer、ChatSidebar Tool Calling）。新增 AI 全接口流程测试，确保 `api-spec.md` 中每个业务接口都有对应工具链覆盖。
- **错误处理**：统一 `getErrorMessage` 函数提取 ApiRequestError.serverMessage 优先于 Error.message，避免各组件重复内联判断。
