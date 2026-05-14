import type { WorkOrderStatus } from '../types/domain';

const STATUS_ORDER: WorkOrderStatus[] = ['pending', 'assigned', 'in_progress', 'completed'];

/**
 * Returns the next status in the workflow, or null if at the final state.
 */
export function getNextWorkOrderStatus(status: WorkOrderStatus): WorkOrderStatus | null {
  const index = STATUS_ORDER.indexOf(status);
  if (index === -1 || index === STATUS_ORDER.length - 1) {
    return null;
  }
  return STATUS_ORDER[index + 1];
}

/**
 * Returns the step index (0-based) for rendering Ant Design Steps.
 */
export function getWorkOrderStepIndex(status: WorkOrderStatus): number {
  return STATUS_ORDER.indexOf(status);
}
