import { api } from './client';
import type { Alert } from '../types/domain';

export interface AlertQueryParams {
  buildingId?: string;
  level?: string;
  acknowledged?: boolean;
}

export function getAlerts(params?: AlertQueryParams) {
  return api.get<Alert[]>('/api/alerts', { params });
}

export function ackAlert(id: string) {
  return api.post<{ id: string; acknowledged: boolean }>(`/api/alerts/${id}/ack`);
}
