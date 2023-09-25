export function mapObject<K extends string | number | symbol, T, Result>(
  obj: Record<K, T>,
  fn: (v: T, key: K) => Result,
): Record<K, Result> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, fn(value as T, key as K)]),
  ) as Record<K, Result>;
}
