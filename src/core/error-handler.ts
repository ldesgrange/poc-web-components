import { inject } from './service-registry'
import { ToastService } from './toast-service'
import { Severity } from './utils'

export class ErrorHandler {
  private toastService = inject(ToastService)
  private listeners: ((message: string) => void)[] = []

  constructor() {
    window.addEventListener('error', event => {
      this.handleError(event.error || event.message)
    })

    window.addEventListener('unhandledrejection', event => {
      this.handleError(event.reason)
    })
  }

  public handleError(error: unknown): void {
    let message = 'An unexpected error occurred.'
    if (error instanceof Error) {
      message = error.message
    } else if (typeof error === 'string') {
      message = error
    }

    this.toastService.show(message, Severity.ERROR)
    this.notifyListeners(message)
  }

  /**
   * Subscribe to error messages.
   * Returns a function to unsubscribe.
   */
  public subscribe(listener: (message: string) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private notifyListeners(message: string): void {
    this.listeners.forEach(listener => listener(message))
  }
}
