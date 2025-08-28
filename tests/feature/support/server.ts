import { createServer, ViteDevServer } from 'vite'

let server: ViteDevServer | undefined

export async function startServer(url = 'http://127.0.0.1:8042'): Promise<string> {
  if (server) return Promise.resolve(url)

  const u = new URL(url)
  const host = u.hostname || '127.0.0.1'
  const port = (u.port && Number(u.port)) || 8042

  server = await createServer({
    server: {
      host: host,
      port: port,
      strictPort: true,
      hmr: false,
    },
  })
  await server.listen()
  return Promise.resolve(url)
}

export async function stopServer(): Promise<void> {
  if (!server) return
  return server.close()
}
