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
- 状态筛选使用 React Query `queryKey: ['workOrders', statusFilter]`。
- 状态流转通过 `getNextWorkOrderStatus` / `getWorkOrderStepIndex`（`utils/statusFlow.ts`）驱动 Ant Design Steps。
- 创建工单成功后 `invalidateQueries(['workOrders'])` 刷新列表。

### AI 助手（ChatSidebar）
- `ChatDisplayMessage` 类型支持 `user` / `assistant` / `tool-status` 三种角色。
- Tool Calling 流程：`用户输入 → POST /api/chat → tool_calls → 执行工具 → 追加 tool 消息 → 再次 POST /api/chat → 展示最终回复`。
- `chatProtocol.ts` 负责从 `ChatDisplayMessage[]` 构建 `/api/chat` 请求的 `ChatMessage[]`，实现显示层和协议层的清晰分离。

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

## 主要权衡

- **React Query 的 refetchInterval vs 手动 setInterval**：选择前者，因为 React Query 自动处理组件卸载时的 timer 清理，且 `refetchInterval: false` 可以优雅停止，避免 buggy-component 的 timer 泄漏问题。
- **chatProtocol 独立模块**：将 `buildApiMessages` 抽出可单独测试，确保工具调用的 assistant/tool 消息重建逻辑正确，不依赖 UI 渲染。
- **测试策略**：优先覆盖纯逻辑（statusFlow、toolExecutor、chatProtocol、DeviceStats），其次覆盖核心交互（DeviceAlertPanel、CreateWorkOrderModal、WorkOrderDetailDrawer）。不追求高覆盖率，追求高价值覆盖。
- **错误处理**：统一 `getErrorMessage` 函数提取 ApiRequestError.serverMessage 优先于 Error.message，避免各组件重复内联判断。
