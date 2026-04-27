import { formatToLocalTime } from '../lib/dateUtils';

describe('Timeline Timezone formatting', () => {
  it('should format YYJ departure correctly in Pacific time', () => {
    const iso = '2023-02-02T16:00:00-08:00';
    const tz = 'America/Vancouver';
    const formatted = formatToLocalTime(iso, tz);
    // 4:00 PM in Feb 2
    expect(formatted).toContain('Feb 2');
    expect(formatted).toContain('4:00 PM');
  });

  it('should format HNL departure correctly in Honolulu time', () => {
    const iso = '2023-02-07T16:00:00-10:00';
    const tz = 'Pacific/Honolulu';
    const formatted = formatToLocalTime(iso, tz);
    // 4:00 PM in Feb 7
    expect(formatted).toContain('Feb 7');
    expect(formatted).toContain('4:00 PM');
  });

  it('should handle UTC strings by converting to the target timezone', () => {
    // 2023-02-03T00:00:00Z is 2023-02-02 4:00 PM in UTC-8
    const iso = '2023-02-03T00:00:00Z';
    const tz = 'America/Vancouver';
    const formatted = formatToLocalTime(iso, tz);
    expect(formatted).toContain('Feb 2');
    expect(formatted).toContain('4:00 PM');
  });
});
