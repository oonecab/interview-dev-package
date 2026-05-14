import { useState, useCallback } from 'react';
import { Layout, Typography, Button, Segmented, theme } from 'antd';
import { CommentOutlined, CloseOutlined } from '@ant-design/icons';
import { BuildingSidebar } from './BuildingSidebar';
import { DeviceDashboard } from '../devices/DeviceDashboard';
import { WorkOrderPage } from '../work-orders/WorkOrderPage';
import { ChatSidebar, type ChatDisplayMessage } from '../chat/ChatSidebar';
import type { DeviceStatus, DeviceType } from '../../types/domain';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

type ActivePage = 'devices' | 'workOrders';

const LEFT_SIDEBAR_WIDTH = 240;
const RIGHT_SIDEBAR_WIDTH = 360;

export function AppShell() {
  const [activePage, setActivePage] = useState<ActivePage>('devices');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<DeviceStatus | 'all'>('all');
  const [selectedType, setSelectedType] = useState<DeviceType | 'all'>('all');
  const [chatOpen, setChatOpen] = useState(false);
  // When set, switches to work orders page and opens create modal with this device
  const [createWorkOrderDeviceId, setCreateWorkOrderDeviceId] = useState<string | null>(null);
  // Chat messages state lifted here to persist across sidebar open/close
  const [chatMessages, setChatMessages] = useState<ChatDisplayMessage[]>([]);

  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const handleBuildingSelect = useCallback((id: string) => {
    setSelectedBuildingId(id);
  }, []);

  const handleCreateWorkOrderFromDevice = useCallback((deviceId: string) => {
    setCreateWorkOrderDeviceId(deviceId);
    setActivePage('workOrders');
  }, []);

  const handleCreateModalClose = useCallback(() => {
    setCreateWorkOrderDeviceId(null);
  }, []);

  const isDevicesPage = activePage === 'devices';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#001529',
          padding: '0 24px',
          height: 56,
          lineHeight: '56px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Title level={4} style={{ color: '#fff', margin: 0, whiteSpace: 'nowrap' }}>
            星汇智慧空间
          </Title>
          <Segmented<string>
            value={activePage}
            onChange={(value) => setActivePage(value as ActivePage)}
            options={[
              { value: 'devices', label: '设备看板' },
              { value: 'workOrders', label: '工单管理' },
            ]}
            style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
          />
        </div>
        <Button
          type="text"
          icon={chatOpen ? <CloseOutlined /> : <CommentOutlined />}
          onClick={() => setChatOpen((v) => !v)}
          style={{ color: '#fff' }}
        >
          {chatOpen ? '关闭助手' : 'AI 助手'}
        </Button>
      </Header>

      <Layout style={{ minHeight: 0 }}>
        {isDevicesPage && (
          <Sider
            width={LEFT_SIDEBAR_WIDTH}
            style={{
              background: colorBgContainer,
              borderRight: '1px solid #f0f0f0',
              overflow: 'auto',
            }}
          >
            <BuildingSidebar
              selectedBuildingId={selectedBuildingId}
              onBuildingSelect={handleBuildingSelect}
              selectedStatus={selectedStatus}
              onStatusChange={setSelectedStatus}
              selectedType={selectedType}
              onTypeChange={setSelectedType}
            />
          </Sider>
        )}

        <Content
          style={{
            padding: 24,
            overflow: 'auto',
            background: '#f5f5f5',
            flex: 1,
            minWidth: 0,
          }}
        >
          {isDevicesPage ? (
            selectedBuildingId ? (
              <DeviceDashboard
                buildingId={selectedBuildingId}
                status={selectedStatus}
                type={selectedType}
                onCreateWorkOrder={handleCreateWorkOrderFromDevice}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: '#999',
                }}
              >
                <Text type="secondary" style={{ fontSize: 16 }}>
                  请从左侧选择楼栋以查看设备
                </Text>
              </div>
            )
          ) : (
            <WorkOrderPage
              preselectedDeviceId={createWorkOrderDeviceId ?? undefined}
              onPreselectedDeviceConsumed={handleCreateModalClose}
            />
          )}
        </Content>

        {chatOpen && (
          <Sider
            width={RIGHT_SIDEBAR_WIDTH}
            style={{
              background: colorBgContainer,
              borderLeft: '1px solid #f0f0f0',
              padding: 16,
              overflow: 'hidden',
            }}
          >
            <ChatSidebar
              messages={chatMessages}
              onMessagesChange={setChatMessages}
              onClose={() => setChatOpen(false)}
            />
          </Sider>
        )}
      </Layout>
    </Layout>
  );
}
