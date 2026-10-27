/** Deep copy by JSON round trip. Deliberately not structuredClone: that throws on Vue reactive proxies. Values must be plain JSON data. */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}
