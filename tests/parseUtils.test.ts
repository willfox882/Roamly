import { generateWarningId, filterWarningsForTrip } from '../lib/parseUtils';
import type { Gap, Trip } from '../lib/schema';

describe('parseUtils', () => {
  const mockGap: Gap = {
    id: 'test-1',
    type: 'missing_accommodation',
    severity: 'high',
    message: 'No hotel found',
    relatedEventIds: ['event-1', 'event-2'],
    suggestedActions: []
  };

  const mockTrip: Trip = {
    id: 'trip-1',
    userId: 'user-1',
    title: 'Test Trip',
    startDate: '2026-10-24',
    endDate: '2026-10-30',
    timezone: 'UTC',
    dataVersion: 1,
    createdAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
    origin: 'local',
    meta: {
      ignoredWarnings: ['missing_accommodation:event-1,event-2']
    }
  } as any;

  it('should generate a deterministic warning ID', () => {
    const id = generateWarningId(mockGap);
    expect(id).toBe('missing_accommodation:event-1,event-2');
    
    // Test stability with different event ID order
    const gap2 = { ...mockGap, relatedEventIds: ['event-2', 'event-1'] };
    expect(generateWarningId(gap2)).toBe(id);
  });

  it('should filter out ignored warnings', () => {
    const gaps = [mockGap];
    const filtered = filterWarningsForTrip(gaps, mockTrip);
    expect(filtered).toHaveLength(0);
  });

  it('should not filter out non-ignored warnings', () => {
    const anotherGap: Gap = {
      ...mockGap,
      type: 'missing_transport',
      message: 'No return flight'
    };
    const gaps = [anotherGap];
    const filtered = filterWarningsForTrip(gaps, mockTrip);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].type).toBe('missing_transport');
  });
});
