import { api } from './client';
import type { Device, DeviceDetail, DeviceStatus, DeviceType } from '../types/domain';

export interface DeviceQueryParams {
  buildingId?: string;
  status?: DeviceStatus;
  type?: DeviceType;
}

export function getDevices(params?: DeviceQueryParams) {
  return api.get<Device[]>('/api/devices', { params });
}

export function getDeviceDetail(id: string) {
  return api.get<DeviceDetail>(`/api/devices/${id}`);
}
