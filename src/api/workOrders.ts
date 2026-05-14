import { api } from './client';
import type { WorkOrder, WorkOrderStatus, Priority } from '../types/domain';

export interface WorkOrderQueryParams {
  status?: WorkOrderStatus;
}

export function getWorkOrders(params?: WorkOrderQueryParams) {
  return api.get<WorkOrder[]>('/api/work-orders', { params });
}

export interface CreateWorkOrderPayload {
  title: string;
  description: string;
  deviceId: string;
  priority: Priority;
}

export function createWorkOrder(payload: CreateWorkOrderPayload) {
  return api.post<WorkOrder>('/api/work-orders', payload);
}

export function updateWorkOrderStatus(id: string, status: WorkOrderStatus) {
  return api.patch<WorkOrder>(`/api/work-orders/${id}`, { status });
}
