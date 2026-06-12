// Maps a timeRange query value to the earliest acceptable Date.
// Returns null for unknown/missing values (no time filter).
export function timeRangeCutoff(range) {
  const HOUR = 3600e3;
  switch (range) {
    case "24h":
      return new Date(Date.now() - 24 * HOUR);
    case "3d":
      return new Date(Date.now() - 72 * HOUR);
    case "7d":
      return new Date(Date.now() - 168 * HOUR);
    default:
      return null;
  }
}
