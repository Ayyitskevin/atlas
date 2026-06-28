const POSITION_SCALE = 1_000;
const MAX_NUMERIC_20_10_VALUE = 9_999_999_999.999;

export function defaultListPosition(now = Date.now()): number {
  return Math.min(now / POSITION_SCALE, MAX_NUMERIC_20_10_VALUE);
}
