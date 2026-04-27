/**
 * Formats an ISO datetime string to a human-readable local date.
 * If a timezone is provided, it uses that. Otherwise, it uses the user's local time.
 */
export function formatToLocalDate(isoString: string, timezone?: string): string {
  if (!isoString) return '';
  try {
    // If it's just a date YYYY-MM-DD, treat as local to avoid shifting
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
      const [year, month, day] = isoString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date);
    }

    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString.slice(0, 10);
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: timezone,
    }).format(date);
  } catch (e) {
    console.error('Date formatting error:', e);
    return isoString.slice(0, 10);
  }
}

/**
 * Formats an ISO datetime string to a human-readable local date and time.
 */
export function formatToLocalTime(isoString: string, timezone?: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    }).format(date);
  } catch (e) {
    console.error('Time formatting error:', e);
    return isoString;
  }
}

/**
 * Formats an ISO datetime string to a human-readable local date and time
 * WITHOUT any timezone conversion. It treats the time in the ISO string
 * as the "wall-clock" time.
 */
export function formatWallClock(isoString: string | null): string {
  if (!isoString) return '—';
  try {
    // Extract YYYY-MM-DD and HH:mm from the ISO string directly
    // Format: 2026-04-30T11:00:00Z or 2026-04-30T11:00:00-08:00
    const match = isoString.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    if (!match) return isoString;

    const [_, datePart, timePart] = match;
    const [year, month, day] = datePart.split('-');
    const [hour, minute] = timePart.split(':');
    
    const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch (e) {
    return isoString;
  }
}

/**
 * Extracts the calendar date (YYYY-MM-DD) in the target timezone.
 */
export function getZonedLocalDate(isoString: string, timezone?: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString.slice(0, 10);
    
    if (timezone) {
      // Use Intl to get the parts of the date in the target timezone
      const parts = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: timezone,
      }).formatToParts(date);
      
      const y = parts.find(p => p.type === 'year')?.value;
      const m = parts.find(p => p.type === 'month')?.value;
      const d = parts.find(p => p.type === 'day')?.value;
      
      return `${y}-${m}-${d}`;
    }
    
    return isoString.slice(0, 10);
  } catch {
    return isoString.slice(0, 10);
  }
}
