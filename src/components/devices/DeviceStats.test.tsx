import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeviceStats } from './DeviceStats';
import type { Device } from '../../types/domain';

const MIXED_DEVICES: Device[] = [
  { id: 'elevator_001', name: '电梯_001', type: 'elevator', typeName: '电梯', buildingId: 'B1', floor: 8, status: 'normal', lastUpdated: '2026-04-15T14:32:00Z' },
  { id: 'elevator_002', name: '电梯_002', type: 'elevator', typeName: '电梯', buildingId: 'B1', floor: 1, status: 'warning', lastUpdated: '2026-04-15T14:30:00Z' },
  { id: 'hvac_001', name: '空调_001', type: 'hvac', typeName: '空调', buildingId: 'B1', floor: 3, status: 'normal', lastUpdated: '2026-04-15T14:00:00Z' },
  { id: 'hvac_003', name: '空调_003', type: 'hvac', typeName: '空调', buildingId: 'B1', floor: 10, status: 'warning', lastUpdated: '2026-04-15T14:20:00Z' },
  { id: 'hvac_008', name: '空调_008', type: 'hvac', typeName: '空调', buildingId: 'B1', floor: 5, status: 'fault', lastUpdated: '2026-04-15T08:45:00Z' },
  { id: 'lighting_001', name: '照明_001', type: 'lighting', typeName: '照明', buildingId: 'B1', floor: 2, status: 'offline', lastUpdated: '2026-04-14T22:00:00Z' },
];

describe('DeviceStats', () => {
  it('counts devices by type correctly', () => {
    render(<DeviceStats devices={MIXED_DEVICES} />);
    // Type labels are present
    expect(screen.getByText('电梯')).toBeInTheDocument();
    expect(screen.getByText('空调')).toBeInTheDocument();
    expect(screen.getByText('照明')).toBeInTheDocument();
    // Elevator=2, HVAC=3, Lighting=1, Pump=0, Fire=0
    // Values appear in Statistic components — use getAllByText for shared numbers
    const twos = screen.getAllByText('2');
    expect(twos.length).toBeGreaterThanOrEqual(1);
    const threes = screen.getAllByText('3');
    expect(threes.length).toBeGreaterThanOrEqual(1);
    const ones = screen.getAllByText('1');
    expect(ones.length).toBeGreaterThanOrEqual(1);
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2); // pump + fire
  });

  it('counts devices by status correctly', () => {
    render(<DeviceStats devices={MIXED_DEVICES} />);
    // Tags: 正常, 告警, 故障, 离线 with counts
    expect(screen.getByText(/正常 2/)).toBeInTheDocument();
    expect(screen.getByText(/告警 2/)).toBeInTheDocument();
    expect(screen.getByText(/故障 1/)).toBeInTheDocument();
    expect(screen.getByText(/离线 1/)).toBeInTheDocument();
  });

  it('shows zero values for empty device array', () => {
    render(<DeviceStats devices={[]} />);
    // All type counts should be 0
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(5);
    // Status labels should all show 0
    expect(screen.getByText(/正常 0/)).toBeInTheDocument();
    expect(screen.getByText(/告警 0/)).toBeInTheDocument();
  });
});
