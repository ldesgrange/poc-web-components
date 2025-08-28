import { resolve } from 'path'
import type { UserConfig } from 'vite'

export default {
  resolve: {
    alias: {
      '@app': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        app: './index.html',
        'service-worker': './src/pwa/service-worker.ts',
      },
      output: {
        entryFileNames: assetInfo => {
          // Don’t hash the service worker, otherwise the registration will fail.
          return assetInfo.name === 'service-worker' ? '[name].js' : 'assets/[name]-[hash].js'
        },
      },
    },
  },
} satisfies UserConfig
