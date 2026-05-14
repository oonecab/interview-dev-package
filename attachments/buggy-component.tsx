/**
 * DeviceAlertPanel.tsx — 设备告警面板
 *
 * 这个组件展示指定楼栋的设备告警列表，支持按级别筛选、自动刷新和手动确认告警。
 *
 * ⚠️ 本文件包含 3 个 bug，请找到并修复它们。
 *    修复后请在交付物 2 中为每个 bug 写出：问题现象 → 根因分析 → 修复方法。
 */

import React, { useState, useEffect, useCallback } from 'react';

// ============ Types ============

interface Alert {
  id: string;
  deviceId: string;
  deviceName: string;
  level: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface DeviceAlertPanelProps {
  buildingId: string;
  onAlertClick?: (alert: Alert) => void;
}

// ============ Styles ============

const LEVEL_COLORS: Record<Alert['level'], string> = {
  critical: '#ff4d4f',
  warning: '#faad14',
  info: '#1890ff',
};

// ============ Component ============

export const DeviceAlertPanel: React.FC<DeviceAlertPanelProps> = ({
  buildingId,
  onAlertClick,
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 拉取告警数据
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/alerts?buildingId=${buildingId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Alert[] = await res.json();
      setAlerts(data);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []); // ← 留意这里

  // 初始加载 + buildingId 变化时重新加载
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // 自动刷新
  useEffect(() => {
    if (autoRefresh) {
      const timer = setInterval(fetchAlerts, 5000);
    }
  }, [autoRefresh]);

  // 确认告警
  const handleAcknowledge = async (alertId: string) => {
    try {
      const res = await fetch(`/api/alerts/${alertId}/ack`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // 更新本地状态
      const alert = alerts.find((a) => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        setAlerts(alerts);
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  // 按筛选条件过滤
  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'unacknowledged') return !a.acknowledged;
    return a.level === filter;
  });

  return (
    <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, padding: 16 }}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>
          设备告警
          <span style={{ fontSize: 14, color: '#999', marginLeft: 8 }}>
            ({filteredAlerts.length})
          </span>
        </h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ padding: '4px 8px' }}
          >
            <option value="all">全部</option>
            <option value="critical">严重</option>
            <option value="warning">警告</option>
            <option value="info">信息</option>
            <option value="unacknowledged">未确认</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            自动刷新
          </label>
        </div>
      </div>

      {/* 加载状态 */}
      {loading && <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>加载中...</div>}

      {/* 告警列表 */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {filteredAlerts.map((alert) => (
          <li
            key={alert.id}
            onClick={() => onAlertClick?.(alert)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              marginBottom: 4,
              borderRadius: 4,
              cursor: 'pointer',
              backgroundColor: alert.acknowledged ? '#fafafa' : '#fff',
              borderLeft: `3px solid ${LEVEL_COLORS[alert.level]}`,
              opacity: alert.acknowledged ? 0.6 : 1,
            }}
          >
            <span style={{ fontWeight: 500, minWidth: 100 }}>{alert.deviceName}</span>
            <span style={{ flex: 1, color: '#666' }}>{alert.message}</span>
            <span style={{ fontSize: 12, color: '#999', minWidth: 80 }}>
              {new Date(alert.timestamp).toLocaleTimeString()}
            </span>
            {!alert.acknowledged && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAcknowledge(alert.id);
                }}
                style={{
                  padding: '2px 8px',
                  fontSize: 12,
                  border: '1px solid #d9d9d9',
                  borderRadius: 4,
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                确认
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* 空状态 */}
      {!loading && filteredAlerts.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          暂无告警
        </div>
      )}
    </div>
  );
};
