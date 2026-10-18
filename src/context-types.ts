/** Host service faces consumed by the standalone Git plugin. */
import type { Context as CordisContext } from '@deepseek-ai/cordis'
import type { HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
export type Context = CordisContext & {
  sessions: { get(id: string): { header: { cwd?: string } } | undefined }
  connection: HostConnectionHandle
}
