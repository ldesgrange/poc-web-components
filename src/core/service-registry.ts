type Constructor<T> = new (...args: unknown[]) => T
type AbstractConstructor<T> = abstract new (...args: unknown[]) => T

type InjectionToken<T> = | Constructor<T> | AbstractConstructor<T>

class ServiceRegistry {
  private services = new Map<InjectionToken<unknown>, unknown>()

  public set<T>(token: InjectionToken<T>, instance: T) {
    this.services.set(token, instance)
  }

  public get<T>(token: InjectionToken<T>): T {
    const service = this.services.get(token)
    if (!service) {
      const tokenName = token?.name
      throw new Error(`Service not found for token: ${tokenName}`)
    }
    return service as T
  }
}

export const serviceRegistry = new ServiceRegistry()

export function inject<T>(token: Constructor<T>): T
export function inject<T>(token: AbstractConstructor<T>): T
export function inject<T>(token: InjectionToken<T>): T {
  return serviceRegistry.get(token)
}
