# 智慧空间设备监控与 AI 工单助手开发阶段

本文档记录项目按阶段推进的开发计划。整体策略是先跑通主业务链路，再补 AI Tool Calling、Bug 修复、测试和交付文档，避免一次性铺太大导致结构失控。

## 阶段 0：确认基线

目标：理解题目、接口、线框图和交付要求。

- 阅读 `question.md`
- 阅读 `attachments/wireframes.md`
- 阅读 `attachments/api-spec.md`
- 阅读 `attachments/buggy-component.tsx`
- 启动并验证 mock server
- 确认五项交付物：
  - 可运行前端项目
  - Bug 修复说明
  - 单元测试
  - 设计说明
  - AI 工具使用记录

## 阶段 1：初始化前端工程

目标：搭建可运行、可构建、可测试的 React TypeScript 工程骨架。

- 使用 Vite 创建 React + TypeScript 项目
- 使用 `npm` 作为包管理器
- 接入 Ant Design
- 接入 `@tanstack/react-query`
- 配置 Vitest 和 React Testing Library
- 配置 `.env` 中的 `VITE_API_BASE_URL`
- 建立基础目录结构：
  - `src/api`
  - `src/types`
  - `src/hooks`
  - `src/components`
  - `src/pages`
  - `src/utils`
- 定义核心业务类型：
  - `Building`
  - `Device`
  - `DeviceDetail`
  - `Alert`
  - `WorkOrder`
  - `DeviceStatus`
  - `DeviceType`
  - `WorkOrderStatus`
  - `Priority`
- 定义聊天相关类型：
  - `ChatRole`
  - `ChatMessage`
  - `ToolCall`
  - `ChatResponse`
- 封装统一 API client
- 封装基础 API 函数
- 创建最小可运行 `App`
- 添加基础测试
- 更新 `README.md`
- 验证：
  - `npm run build`
  - `npm run test`

## 阶段 2：设备状态看板

目标：实现模块 A，完成三栏管理台布局和设备看板主流程。

- 实现整体布局：
  - 顶部导航
  - 左侧楼栋和筛选侧栏
  - 主内容区
  - 右侧 AI 助手占位
- 实现楼栋选择器
- 默认选中第一个楼栋
- 实现设备状态筛选：
  - 全部
  - 正常
  - 告警
  - 故障
  - 离线
- 实现设备类型筛选：
  - 全部
  - 电梯
  - 空调
  - 水泵
  - 照明
  - 消防
- 调用 `GET /api/devices`
- 展示设备表格：
  - 设备名称
  - 楼栋/楼层
  - 类型
  - 状态
  - 最后更新时间
- 实现设备统计概览：
  - 各类型数量
  - 各状态数量
- 点击设备打开详情抽屉
- 调用 `GET /api/devices/:id`
- 展示设备详情和最近告警
- 补齐 `Alert.buildingId` 类型
- 添加 `.gitignore`
- 验证：
  - `npm run build`
  - `npm run test`

## 阶段 3：工单管理

目标：实现模块 B，完成工单列表、创建、详情和状态流转。

- 增加页面切换：
  - 设备看板
  - 工单管理
- 实现工单列表
- 调用 `GET /api/work-orders`
- 展示：
  - 工单编号
  - 标题
  - 状态
  - 优先级
  - 关联设备
  - 创建时间
- 实现工单状态筛选：
  - 全部
  - 待派单
  - 已派单
  - 处理中
  - 已完成
- 实现创建工单表单：
  - 标题
  - 描述
  - 关联设备
  - 优先级
- 调用 `POST /api/work-orders`
- 创建成功后刷新工单列表
- 点击工单打开详情抽屉
- 展示工单详情
- 使用 Steps 展示状态流转
- 实现状态推进：
  - `pending -> assigned`
  - `assigned -> in_progress`
  - `in_progress -> completed`
  - `completed -> null`
- 调用 `PATCH /api/work-orders/:id`
- 添加 `src/utils/statusFlow.ts`
- 测试状态流转工具函数
- 验证：
  - `npm run build`
  - `npm run test`

## 阶段 4：AI 助手基础聊天

目标：实现右侧 AI 助手的聊天 UI 和普通文本回复。

- 实现 AI 助手侧栏展开/收起
- 实现消息列表
- 实现欢迎消息
- 实现输入框和发送按钮
- 调用 `POST /api/chat`
- 展示普通 assistant 文本回复
- 处理发送中状态
- 处理空输入
- 处理接口失败
- 自动滚动到最新消息
- 验证：
  - `npm run build`
  - `npm run test`

## 阶段 5：AI Tool Calling 闭环

目标：实现题目核心考点之一，即前端编排 Tool Calling。

- 识别 `/api/chat` 返回的 `tool_calls`
- 实现工具执行器：
  - `query_devices`
  - `query_alerts`
  - `create_work_order`
- 解析 `function.arguments`
- 根据工具名调用对应业务 API：
  - `query_devices -> GET /api/devices`
  - `query_alerts -> GET /api/alerts`
  - `create_work_order -> POST /api/work-orders`
- 展示工具调用中间状态卡片：
  - 正在查询设备
  - 正在查询告警
  - 正在创建工单
  - 调用成功
  - 调用失败
- 将工具结果追加为 `role: "tool"` 消息
- 再次调用 `POST /api/chat`
- 展示最终 assistant 回复
- 创建工单成功后刷新工单列表
- 处理工具参数解析失败
- 处理工具 API 调用失败
- 测试工具执行器或 Tool Calling 流程中的关键函数
- 验证：
  - `npm run build`
  - `npm run test`

## 阶段 6：Bug 组件修复与集成

目标：修复附件 `buggy-component.tsx` 中的 3 个 bug，并集成到项目中。

- 修复 `fetchAlerts` 缺少 `buildingId` 依赖的问题
- 修复自动刷新定时器没有清理的问题
- 修复确认告警时直接修改 React state 的问题
- 将修复后的 `DeviceAlertPanel` 集成到项目中
- 支持当前楼栋告警展示
- 支持告警级别筛选
- 支持未确认筛选
- 支持确认告警
- 添加必要测试
- 准备 Bug 修复说明：
  - 问题现象
  - 根因分析
  - 修复方法
- 验证：
  - `npm run build`
  - `npm run test`

## 阶段 7：错误处理和边界状态

目标：补齐用户体验中容易被忽略的失败、空状态和边界情况。

- 设备列表加载失败
- 工单列表加载失败
- 设备详情不存在
- 创建工单失败
- 工单状态流转失败
- AI 工具参数解析失败
- AI 工具调用失败
- 空状态展示：
  - 当前楼栋无设备
  - 当前筛选无工单
  - 当前无告警
- 表单校验提示
- 操作成功提示
- 操作失败提示
- 验证：
  - `npm run build`
  - `npm run test`

## 阶段 8：测试完善

目标：满足交付物中的单元测试要求，并让测试覆盖真正有价值的行为。

- 覆盖至少 3 个组件或函数
- 推荐测试：
  - `statusFlow`
  - Tool Calling 工具执行器
  - `DeviceAlertPanel`
  - 创单表单校验
  - 设备统计聚合逻辑
- 清理 jsdom 下 Ant Design 的无意义 warning
- 保证测试稳定、可重复
- 验证：
  - `npm run test`

## 阶段 9：体验打磨

目标：让项目看起来像一个成熟的后台管理工具，而不是功能堆叠。

- 统一中文文案
- 统一时间格式
- 统一状态标签颜色
- 统一优先级标签颜色
- 优化表格 loading、empty、error 状态
- 优化 AI 侧栏滚动体验
- 优化工具调用卡片
- 优化表单交互
- 检查 1280px 宽度下布局无横向溢出
- 避免 landing page、夸张 hero 和装饰性视觉
- 验证：
  - `npm run build`
  - `npm run test`

## 阶段 10：最终构建、自测和交付文档

目标：形成完整可交付项目。

- 启动 mock server
- 启动前端
- 手动走完整流程：
  - 切楼栋
  - 筛设备
  - 看设备详情
  - 确认告警
  - 创建工单
  - 推进工单状态
  - AI 查询设备
  - AI 查询告警
  - AI 创建工单
- 跑测试：
  - `npm run test`
- 跑构建：
  - `npm run build`
- 完善 `README.md`
- 编写设计说明：
  - 项目结构
  - 组件划分
  - 状态管理选择
  - Tool Calling 流程
  - 技术取舍
- 编写 Bug 修复说明
- 编写 AI 工具使用记录
- 初始化 git 仓库并确认 `.gitignore`
- 最终确认提交内容不包含：
  - `node_modules`
  - `dist`
  - `*.tsbuildinfo`
  - 本地环境文件

## 优先级说明

第一优先级：

- 设备看板
- 工单管理
- AI Tool Calling 闭环
- Bug 修复

第二优先级：

- 测试
- 错误处理
- 文档

第三优先级：

- 视觉细节
- 动效
- 更精致的统计展示

