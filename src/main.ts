// The following line allows having type completion for import.meta.env.*
/// <reference types="vite/client" />

// Add extra env var by adding them in a .env file then extending the interface:
// interface ImportMetaEnv {
//   readonly ENV_VAR_NAME: string
// }

import './styles/main.css'
import './pwa/register-service-worker'
import { AppRoot } from './components/app-root'
import { ErrorHandler } from './core/error-handler'
import { MasterKeyService, IndexedDBMasterKeyService } from './core/master-key-service'
import { serviceRegistry } from './core/service-registry'
import { StorageService, EncryptingStorageService } from './core/storage-service'
import { TaskService, PersistedTaskService } from './core/task-service'
import { ToastService, SingleToastService } from './core/toast-service'

serviceRegistry.set(ToastService, new SingleToastService())
serviceRegistry.set(ErrorHandler, new ErrorHandler())
serviceRegistry.set(MasterKeyService, new IndexedDBMasterKeyService())
serviceRegistry.set(StorageService, new EncryptingStorageService())
serviceRegistry.set(TaskService, new PersistedTaskService())

customElements.define('app-root', AppRoot)

// Add extra types for custom HTMLElement.
declare global {
  interface HTMLElement {
    connectedCallback?(): void
    disconnectedCallback?(): void
    connectedMoveCallback?(): void
    adoptedCallback?(): void
    attributeChangedCallback?(name: string, oldValue: string, newValue: string): void
    // static get observedAttributes(): string[]
  }
}
