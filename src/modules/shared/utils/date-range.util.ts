/**
 * Parses optional startDate/endDate query params into Date objects.
 * Falls back to defaults (start = `defaultDaysAgo` days ago, end = now).
 */
export function parseDateRange(
  startDate?: string,
  endDate?: string,
  defaultDaysAgo = 30,
): { start: Date; end: Date } {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - defaultDaysAgo * 86_400_000);

  // Clamp end to now if it's in the future
  const now = new Date();
  if (end > now) end.setTime(now.getTime());

  return { start, end };
}
