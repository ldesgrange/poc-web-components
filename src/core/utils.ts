export const enum Severity {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

/**
 * Type guard function validating that a given object is not `undefined`.
 * Can be used to filter arrays with proper type check, like:
 * ```
 * const numberArray: number[] = [42, undefined].filter(isDefined)
 * ```
 */
export function isDefined<T> (item: T | undefined): item is T {
  return item !== undefined
}

/**
 * Function throwing an error when called.
 * It takes a parameter of type `never`, typical usage is in the `default` case
 * when switching over an enumeration:
 * ```
 * switch (myEnum) {
 *   case EnumType.A: return true
 *   case EnumType.B: return false
 *   default: return assertUnreachable(myEnum)
 * }
 * ```
 * The purpose being to be sure to get a compilation error when a new value
 * is added to the enum.
 */
export function assertUnreachable(value: never): never {
  throw new Error(`Unexpected call with value: ${value}`)
}

/**
 * Sleep function.
 *
 * Should not be used in production code.
 * Preferably not used in test code either.
 * Could help in debugging.
 *
 * Usage in an async function: `await sleep(1000)`
 *
 * @param delay The delay in milliseconds.
 * @returns A promise that resolves after the given delay.
 */
export function sleep(delay: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, delay))
}

export interface DeferredPromise<V, R> {
  resolve: (value: V) => void;
  reject: (reason?: R) => void
  promise: Promise<V>
}
export function newDeferredPromise<V, R>(): DeferredPromise<V, R> {
  let resolve: (value: V) => void
  let reject: (reason?: R) => void
  const promise = new Promise<V>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { resolve: resolve!, reject: reject!, promise: promise }
}

/**
 * Converts various types (ArrayBuffer, Array, or object with buffer) to an ArrayBuffer.
 * Useful for restoring serialized data.
 */
export function toArrayBuffer(obj: unknown): ArrayBuffer {
  if (obj instanceof ArrayBuffer) return obj
  if (Array.isArray(obj)) return new Uint8Array(obj).buffer
  if (obj && typeof obj === 'object' && 'buffer' in obj && obj.buffer instanceof ArrayBuffer) {
    return obj.buffer
  }
  throw new Error('Not convertible to ArrayBuffer.')
}
