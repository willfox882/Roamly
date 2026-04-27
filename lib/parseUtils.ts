import type { Gap, Trip } from './schema';

/**
 * Generates a deterministic ID for a warning (gap) based on its type 
 * and the events it relates to. This ensures that the same logical 
 * warning has a consistent ID across parser runs.
 */
export function generateWarningId(gap: Gap): string {
  // Sort IDs to ensure stable output regardless of order in the relatedEventIds array
  const sortedEventIds = [...gap.relatedEventIds].sort().join(',');
  return `${gap.type}:${sortedEventIds}`;
}

/**
 * Returns a list of warnings (gaps) excluding those that have been 
 * explicitly ignored by the user for this specific trip.
 */
export function filterWarningsForTrip(gaps: Gap[], trip: Trip): Gap[] {
  const ignoredIds = new Set((trip as any).meta?.ignoredWarnings || []);
  if (ignoredIds.size === 0) return gaps;
  
  return gaps.filter(gap => !ignoredIds.has(generateWarningId(gap)));
}

/**
 * Returns a map of warning IDs to their original messages for display 
 * in the "Ignored warnings" section.
 */
export function getIgnoredWarningDetails(allPotentialGaps: Gap[], trip: Trip): Array<{ id: string, message: string }> {
  const ignoredIds = new Set((trip as any).meta?.ignoredWarnings || []);
  if (ignoredIds.size === 0) return [];

  const details: Array<{ id: string, message: string }> = [];
  
  for (const gap of allPotentialGaps) {
    const id = generateWarningId(gap);
    if (ignoredIds.has(id)) {
      details.push({ id, message: gap.message });
    }
  }
  
  return details;
}
