/** Host service faces consumed by the standalone Git plugin. */
import type { Context as CordisContext } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
export type SidebarHttpRequest = IncomingMessage
export type SidebarHttpResponse = ServerResponse
export type Context = CordisContext & {
  sessions: { get(id: string): { header: { cwd?: string } } | undefined }
  webRuntime: { trustedHosts: readonly string[] }
  webServer: { register(route: { kind: 'prefix'; path: string; handler(req: IncomingMessage, res: ServerResponse): Promise<void> }): () => void }
}
