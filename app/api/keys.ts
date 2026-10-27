// API bodies and responses are snake_case (Laravel's default). The front end
// works in camelCase. These two functions are the only place that converts, so
// no page ever sees a snake_case key. Values are never touched, only object keys.
//
// Only keys written like field names are converted (start with a lowercase
// letter, letters and digits only). Keys that are data, such as a serial number
// ('SN-10001'), an SMS code ('SMS-1A') or a gate number ('1'), are left alone.
const FIELD_NAME = /^[a-z][A-Za-z0-9]*$/
const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const toSnake = (key: string) => FIELD_NAME.test(key) ? key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`) : key

function mapKeys(value: unknown, fn: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map(v => mapKeys(v, fn))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [fn(k), mapKeys(v, fn)]))
  }
  return value
}

/** Response from the API to the shape the front end uses. */
export const camelizeKeys = <T>(value: unknown): T => mapKeys(value, toCamel) as T

/** Request body from the front end to the shape the API expects. */
export const snakeizeKeys = <T = unknown>(value: unknown): T => mapKeys(value, toSnake) as T
