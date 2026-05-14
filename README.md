# 星汇智慧空间 —— 设备监控与 AI 工单助手

"星汇智慧产业园"设备监控 Web 管理后台，支持设备状态看板、告警管理、工单管理和 AI 助手对话（含 Tool Calling）。

## 技术栈

| 类别 | 技术 |
|---|---|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite |
| UI 组件库 | Ant Design 5 |
| 状态管理 | TanStack React Query（远端数据）+ React useState（UI 状态） |
| 测试 | Vitest + React Testing Library |
| 包管理器 | npm |

## 快速启动

### 1. 安装前端依赖

```bash
npm install
```

### 2. 启动 Mock Server

```bash
cd attachments/mock-server
npm install
npm start
```

Mock API 运行在 `http://localhost:3001`，提供楼栋、设备、告警、工单和 Chat API。

### 3. 启动前端开发服务器

回到项目根目录：

```bash
npm run dev
```

前端运行在 `http://localhost:5173`。

## 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `VITE_API_BASE_URL` | Mock API 地址 | `http://localhost:3001` |

可通过 `.env` 或 `.env.example` 覆盖。

## 项目结构

```
src/
  api/              # API 请求封装 (client, buildings, devices, alerts, workOrders, chat)
  types/            # TypeScript 类型定义 (domain, chat)
  utils/            # 工具函数 (format, labels, statusFlow, error)
  hooks/            # 自定义 Hooks（预留）
  components/
    layout/         # AppShell, BuildingSidebar
    devices/        # DeviceDashboard, DeviceStats, DeviceTable, DeviceDetailDrawer
    alerts/         # DeviceAlertPanel（Bug 修复后集成）
    work-orders/    # WorkOrderPage, WorkOrderTable, WorkOrderDetailDrawer, CreateWorkOrderModal
    chat/           # ChatSidebar, toolExecutor, chatProtocol
  pages/            # 页面组件（预留）
tests/              # 自动化测试，按 src 模块镜像组织
  components/       # 组件交互测试
  utils/            # 纯逻辑测试
  setupTests.ts     # Vitest / jsdom 测试环境配置
attachments/        # 题目提供的 mock-server、api-spec、wireframes、buggy-component
docs/               # 交付文档（设计说明、Bug 修复说明、AI 使用记录、自测清单）
milestone/          # 开发阶段划分与里程碑计划
my_promopts/        # 交付给 Claude Code 的分阶段提示词记录
```

## 可用命令

| 命令 | 说明 |
|---|---|
| `npm install` | 安装依赖 |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | TypeScript 检查 + Vite 生产构建 |
| `npm run test` | 运行 Vitest 测试 |
| `npm run test:watch` | 以 watch 模式运行测试 |

## 交付物

| 交付物 | 位置 |
|---|---|
| 可运行前端项目 | 本仓库 |
| Bug 修复说明 | `docs/bug-fixes.md` |
| 单元测试 | `tests/**/*.test.ts*`，共 68 个测试 |
| 设计说明 | `docs/design.md` |
| AI 工具使用记录 | `docs/ai-usage.md` |
| 自测清单 | `docs/manual-checklist.md` |

## 测试

```bash
npm run test
```

使用 Vitest + React Testing Library，mock fetch，不依赖真实 mock server。覆盖状态流转、Tool Calling 工具执行器、DeviceAlertPanel、DeviceStats 统计、创建工单表单、工单状态推进、ChatSidebar 协议重建等。
