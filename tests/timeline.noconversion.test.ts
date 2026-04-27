import { formatWallClock, formatToLocalDate } from '../lib/dateUtils';

describe('Timeline No-Conversion Mandate', () => {
  it('should display the wall-clock time exactly as entered (11:00 remains 11:00)', () => {
    // Simulate an ISO string saved with Z but intended as wall-clock time 11:00
    const iso = '2026-04-30T11:00:00Z';
    const formatted = formatWallClock(iso);
    
    // Result should be 11:00 AM regardless of local timezone
    expect(formatted).toContain('11:00 AM');
    expect(formatted).toContain('Apr 30');
  });

  it('should display the wall-clock time exactly as entered even with offset (11:00 remains 11:00)', () => {
    // Simulate an ISO string with offset
    const iso = '2026-04-30T11:00:00-08:00';
    const formatted = formatWallClock(iso);
    
    expect(formatted).toContain('11:00 AM');
  });

  it('should display YYYY-MM-DD exactly as entered in the header range', () => {
    const dateStr = '2026-04-30';
    const formatted = formatToLocalDate(dateStr);
    
    // Result should be Apr 30, 2026 regardless of local timezone
    expect(formatted).toContain('Apr 30');
    expect(formatted).toContain('2026');
  });

  it('should handle displayStartDatetime field which contains raw wall-clock time', () => {
    const raw = '2026-04-30T11:00:00';
    const formatted = formatWallClock(raw);
    
    expect(formatted).toContain('11:00 AM');
    expect(formatted).toContain('Apr 30');
  });
});
