/**
 * Format ISO datetime string to "YYYY-MM-DD HH:mm" in local time.
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Format building + floor into display string.
 * e.g. B1-8F for above-ground, B1-B1 for basement floor 1.
 */
export function formatFloor(buildingId: string, floor: number): string {
  if (floor >= 0) {
    return `${buildingId}-${floor}F`;
  }
  return `${buildingId}-B${Math.abs(floor)}`;
}
