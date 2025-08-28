import { describe, expect, it } from 'vitest'

import { assertUnreachable, isDefined, newDeferredPromise, sleep, toArrayBuffer } from '../../../src/core/utils'

describe('utils', () => {
  describe('isDefined', () => {
    it('should filter out undefined values from array', () => {
      const values = [42, undefined, null, 0, '', false, undefined]
      const filtered = values.filter(isDefined)

      expect(filtered).toEqual([42, null, 0, '', false])
    })

    it('should narrow type in conditional', () => {
      let value: string | undefined = 'test'
      if (isDefined(value)) {
        expect(typeof value).toBe('string')
      }

      value = undefined
      if (!isDefined(value)) {
        expect(typeof value).toBe('undefined')
      }
    })
  })

  describe('assertUnreachable', () => {
    it('should throw error for any value', () => {
      expect(() => assertUnreachable('unexpected' as never)).toThrow('Unexpected call with value: unexpected')
      expect(() => assertUnreachable(123 as never)).toThrow('Unexpected call with value: 123')
      expect(() => assertUnreachable(null as never)).toThrow('Unexpected call with value: null')
    })

    it('should be used in switch default case', () => {
      type Color = 'red' | 'blue' | 'green'

      const getColorName = (color: Color): string => {
        switch (color) {
          case 'red':
            return 'Red'
          case 'blue':
            return 'Blue'
          case 'green':
            return 'Green'
          default:
            return assertUnreachable(color)
        }
      }

      expect(getColorName('red')).toBe('Red')
      expect(getColorName('blue')).toBe('Blue')
      expect(getColorName('green')).toBe('Green')
    })
  })

  describe('sleep', () => {
    it('should resolve after specified delay', async () => {
      const start = Date.now()
      await sleep(50)
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(45)
    })

    it('should resolve immediately for 0 delay', async () => {
      const start = Date.now()
      await sleep(0)
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(10)
    })
  })

  describe('newDeferredPromise', () => {
    it('should create a deferred promise with resolve and reject', async () => {
      const deferred = newDeferredPromise<string, Error>()

      setTimeout(() => deferred.resolve('success'), 10)

      const result = await deferred.promise
      expect(result).toBe('success')
    })

    it('should allow resolving with value', async () => {
      const deferred = newDeferredPromise<number, unknown>()

      deferred.resolve(42)
      const result = await deferred.promise

      expect(result).toBe(42)
    })

    it('should allow rejecting with reason', async () => {
      const deferred = newDeferredPromise<unknown, string>()

      deferred.reject('error reason')

      await expect(deferred.promise).rejects.toBe('error reason')
    })
  })

  describe('toArrayBuffer', () => {
    it('should return same ArrayBuffer if already ArrayBuffer', () => {
      const original = new ArrayBuffer(100)
      const result = toArrayBuffer(original)

      expect(result).toBe(original)
    })

    it('should convert Uint8Array to ArrayBuffer', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5])
      const result = toArrayBuffer(original)

      expect(result).toBeInstanceOf(ArrayBuffer)
      expect(new Uint8Array(result)).toEqual(original)
    })

    it('should convert Array to ArrayBuffer', () => {
      const original = [1, 2, 3, 4, 5]
      const result = toArrayBuffer(original)

      expect(result).toBeInstanceOf(ArrayBuffer)
      expect(new Uint8Array(result)).toEqual(new Uint8Array(original))
    })

    it('should convert object with buffer property to ArrayBuffer', () => {
      const original = { buffer: new ArrayBuffer(100), otherProp: 'test' }
      const result = toArrayBuffer(original)

      expect(result).toBe(original.buffer)
    })

    it('should throw error for invalid input', () => {
      expect(() => toArrayBuffer('string')).toThrow('Not convertible to ArrayBuffer')
      expect(() => toArrayBuffer(123)).toThrow('Not convertible to ArrayBuffer')
      expect(() => toArrayBuffer({})).toThrow('Not convertible to ArrayBuffer')
      expect(() => toArrayBuffer({ buffer: 'not-arraybuffer' })).toThrow('Not convertible to ArrayBuffer')
    })
  })
})
