import { Gap, Trip } from '../lib/schema';

// Minimal mock for filtering logic (logic is inside ParsedReviewPanel usually, 
// but we can simulate the data transformation here)

describe('Persistent Warning Ignore', () => {
  it('should filter out ignored warnings', () => {
    const gaps: Gap[] = [
      { id: 'missing_hotel_coverage:2023-01-01', message: 'No hotel on Jan 1' } as any,
      { id: 'missing_hotel_coverage:2023-01-02', message: 'No hotel on Jan 2' } as any,
    ];

    const trip: Trip = {
      id: 't1',
      meta: {
        ignoredWarnings: ['missing_hotel_coverage:2023-01-01']
      }
    } as any;

    const ignoredWarnings = (trip as any).meta?.ignoredWarnings || [];
    const visibleGaps = gaps.filter(g => !ignoredWarnings.includes(g.id));

    expect(visibleGaps.length).toBe(1);
    expect(visibleGaps[0].id).toBe('missing_hotel_coverage:2023-01-02');
  });

  it('should add to ignored list correctly', () => {
    const meta: any = { ignoredWarnings: [] };
    const newGapId = 'missing_hotel_coverage:2023-01-01';
    
    const ignored = Array.from(new Set([...(meta.ignoredWarnings || []), newGapId]));
    
    expect(ignored).toContain(newGapId);
    expect(ignored.length).toBe(1);
  });

  it('should remove from ignored list on Undo', () => {
    const meta: any = { ignoredWarnings: ['gap-1', 'gap-2'] };
    const gapIdToRemove = 'gap-1';
    
    const ignored = (meta.ignoredWarnings || []).filter((id: string) => id !== gapIdToRemove);
    
    expect(ignored).not.toContain('gap-1');
    expect(ignored).toContain('gap-2');
  });
});
