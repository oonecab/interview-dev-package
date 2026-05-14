import { describe, it, expect } from 'vitest';
import { getNextWorkOrderStatus, getWorkOrderStepIndex } from './statusFlow';
import type { WorkOrderStatus } from '../types/domain';

describe('getNextWorkOrderStatus', () => {
  it('returns assigned when given pending', () => {
    expect(getNextWorkOrderStatus('pending')).toBe('assigned');
  });

  it('returns in_progress when given assigned', () => {
    expect(getNextWorkOrderStatus('assigned')).toBe('in_progress');
  });

  it('returns completed when given in_progress', () => {
    expect(getNextWorkOrderStatus('in_progress')).toBe('completed');
  });

  it('returns null when given completed', () => {
    expect(getNextWorkOrderStatus('completed')).toBeNull();
  });
});

describe('getWorkOrderStepIndex', () => {
  const cases: [WorkOrderStatus, number][] = [
    ['pending', 0],
    ['assigned', 1],
    ['in_progress', 2],
    ['completed', 3],
  ];

  it.each(cases)('returns %i for status %s', (status, expected) => {
    expect(getWorkOrderStepIndex(status)).toBe(expected);
  });
});
