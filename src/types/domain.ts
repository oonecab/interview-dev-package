// ============ Enums / Union Types ============

export type DeviceStatus = 'normal' | 'warning' | 'fault' | 'offline';

export type DeviceType = 'elevator' | 'hvac' | 'pump' | 'lighting' | 'fire_pressure';

export type WorkOrderStatus = 'pending' | 'assigned' | 'in_progress' | 'completed';

export type Priority = 'low' | 'medium' | 'high';

export type AlertLevel = 'critical' | 'warning' | 'info';

// ============ Domain Entities ============

export interface Building {
  id: string;
  name: string;
  floors: number;
  deviceCount: number;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  typeName: string;
  buildingId: string;
  floor: number;
  status: DeviceStatus;
  lastUpdated: string;
}

export interface DeviceAlert {
  id: string;
  level: AlertLevel;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface DeviceDetail extends Device {
  alerts: DeviceAlert[];
}

export interface Alert {
  id: string;
  deviceId: string;
  deviceName: string;
  buildingId: string;
  level: AlertLevel;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  deviceId: string;
  deviceName: string;
  status: WorkOrderStatus;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
}

// ============ API Error ============

export interface ApiError {
  error: string;
  message: string;
}
