import { Severity } from './utils'

export interface ToastListener {
  showToast(message: string, severity: Severity): void;
}

export abstract class ToastService {
  abstract register(listener: ToastListener): void
  abstract show(message: string, severity: Severity): void
}

export class SingleToastService extends ToastService {
  private toastListener: ToastListener | null = null

  public register(listener: ToastListener): void {
    this.toastListener = listener
  }

  public show(message: string, severity: Severity): void {
    this.toastListener?.showToast(message, severity)
  }
}
