import { api } from './client';
import type { Building } from '../types/domain';

export function getBuildings() {
  return api.get<Building[]>('/api/buildings');
}
