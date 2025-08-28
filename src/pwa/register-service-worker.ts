const ONE_HOUR = 1000 * 60 * 60

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    if (import.meta.env.PROD) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/service-worker.js')
          .then((registration) => {
            // Check for updates at regular intervals.
            setInterval(() => registration.update(), ONE_HOUR)

            registration.onupdatefound = () => {
              const installingWorker = registration.installing
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed') {
                    if (navigator.serviceWorker.controller) {
                      // New content is available; please refresh.
                      window.dispatchEvent(new CustomEvent('app-update-available'))
                    }
                  }
                }
              }
            }
          }).catch((err) => {
            // eslint-disable-next-line no-console
            console.warn('Service worker registration failed.', err)
          })
      })
    }
  }
}

registerServiceWorker()
