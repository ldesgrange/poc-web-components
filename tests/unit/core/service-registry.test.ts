import { describe, expect, it, beforeEach } from 'vitest'

import { inject, serviceRegistry } from '../../../src/core/service-registry'

abstract class DummyService {
  abstract getValue(): string
}

class ConcreteDummyService1 extends DummyService {
  getValue(): string {
    return 'concrete-value-1'
  }
}

class ConcreteDummyService2 extends DummyService {
  getValue(): string {
    return 'concrete-value-2'
  }
}

describe('service-registry', () => {
  beforeEach(() => {
    serviceRegistry.set(DummyService, new ConcreteDummyService1())
  })

  describe('set and get', () => {
    it('should set and retrieve a service', () => {
      const service = serviceRegistry.get(DummyService)
      expect(service.getValue()).toBe('concrete-value-1')
    })

    it('should override existing service', () => {
      serviceRegistry.set(DummyService, new ConcreteDummyService2())
      const service = serviceRegistry.get(DummyService)
      expect(service.getValue()).toBe('concrete-value-2')
    })
  })

  it('should throw error when service is not registered', () => {
    abstract class UnregisteredService {
      abstract doSomething(): void
    }

    expect(() => serviceRegistry.get(UnregisteredService)).toThrow('Service not found for token: UnregisteredService')
  })

  describe('inject', () => {
    it('should inject service using inject function', () => {
      const service = inject(DummyService)
      expect(service.getValue()).toBe('concrete-value-1')
    })
  })
})
