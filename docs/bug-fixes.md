# Bug 修复说明

附件 `attachments/buggy-component.tsx` 包含 3 个 React bug，已在项目 `src/components/alerts/DeviceAlertPanel.tsx` 中全部修复。

---

## Bug 1：fetchAlerts 缺少 buildingId 依赖

### 问题现象
用户切换楼栋后，告警面板仍展示前一栋的告警数据，不会重新拉取新楼栋的告警。

### 根因分析
`fetchAlerts` 使用 `useCallback(async () => { ... }, [])`，依赖数组为空。函数内部引用了 `buildingId` prop，但闭包捕获的是初始值（或上一次渲染的值，因为依赖为空）。虽然 `useEffect([fetchAlerts])` 会触发，但 `fetchAlerts` 实例始终是旧的（因为依赖为空，不会重建），其内部 `buildingId` 仍是旧值。

### 修复方法
在 `DeviceAlertPanel.tsx` 中，完全使用 React Query 替代手动 `useCallback/useEffect`：

```ts
useQuery({
  queryKey: ['alerts', buildingId],
  queryFn: () => getAlerts({ buildingId }),
});
```

`queryKey` 包含 `buildingId`，当 buildingId 变化时 React Query 自动重新请求。

### 当前代码位置
`src/components/alerts/DeviceAlertPanel.tsx` — useQuery 行。

---

## Bug 2：自动刷新定时器没有清理

### 问题现象
- 关闭"自动刷新"开关后，定时器仍在运行，继续发起请求。
- 组件卸载后，定时器没有清除，造成内存泄漏和后台继续请求。
- 快速切换楼栋时，多个定时器并存，同时请求不同楼栋数据。

### 根因分析
`useEffect` 中 `setInterval(fetchAlerts, 5000)` 返回的 timer ID 没有被存储，也没有返回清理函数。`useEffect` 依赖数组只包含 `[autoRefresh]`，即使 `fetchAlerts` 变化也不需要清理旧 timer（但 Bug 1 导致 `fetchAlerts` 从不变化）。依赖中缺少 `fetchAlerts`（而 `fetchAlerts` 本身依赖 `buildingId`）。

### 修复方法
使用 React Query 的 `refetchInterval` 属性：

```ts
useQuery({
  queryKey: ['alerts', buildingId],
  queryFn: () => getAlerts({ buildingId }),
  refetchInterval: autoRefresh ? 5000 : false,
});
```

React Query 内部管理定时器生命周期：组件卸载时自动清理，`refetchInterval: false` 时停止刷新，queryKey 变化时重置。

### 当前代码位置
`src/components/alerts/DeviceAlertPanel.tsx` — useQuery 的 refetchInterval 行。

---

## Bug 3：确认告警时直接修改 React state

### 问题现象
点击"确认"按钮调用 `POST /api/alerts/:id/ack` 成功后，UI 不更新，已确认的告警仍然显示"确认"按钮而非"已确认"。

### 根因分析
```ts
const alert = alerts.find((a) => a.id === alertId);
if (alert) {
  alert.acknowledged = true;  // 直接修改 state 中的对象
  setAlerts(alerts);           // 传入同一个引用
}
```

`alert.acknowledged = true` 直接修改了 `alerts` 数组中对象的属性。由于 `alerts` 是同一个数组引用，`setAlerts(alerts)` 传入的是 React 已持有的旧引用，浅比较无法检测到变化，组件不重新渲染。

### 修复方法
使用不可变更新：

```ts
queryClient.setQueryData<Alert[]>(['alerts', buildingId], (prev) => {
  if (!prev) return prev;
  return prev.map((a) =>
    a.id === alertId ? { ...a, acknowledged: true } : a,
  );
});
```

通过 `prev.map` 返回新数组，被修改的告警对象通过展开运算符创建新对象，确保引用变化。React Query 检测到缓存变化后触发重新渲染。

### 当前代码位置
`src/components/alerts/DeviceAlertPanel.tsx` — ackMutation 的 onSuccess 回调。
