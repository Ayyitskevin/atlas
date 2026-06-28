const POSITION_SCALE = 1_000;
const MAX_NUMERIC_20_10_INTEGER = 9_999_999_999;

export function defaultListPosition(now = Date.now()): number {
  return Math.min(Math.floor(now / POSITION_SCALE), MAX_NUMERIC_20_10_INTEGER);
}
