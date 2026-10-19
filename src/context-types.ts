/** Host service faces consumed by the standalone Git plugin. */
import type { Context as CordisContext } from '@deepseek-ai/cordis'
import type { HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
type HostSession = { header: { cwd?: string } }
type HostAgent = { session: HostSession; ctx: { get(name: 'workingDirectory'): WorkingDirectory | undefined } }
interface WorkingDirectory {
  get(session: HostSession): string
  set(agent: HostAgent, path: string): Promise<string>
}
export type Context = CordisContext & {
  sessions: { get(id: string): HostSession | undefined }
  agents: { get(id: string): HostAgent | undefined }
  sessionController: { resolveAgent(id: string): Promise<{ agent: HostAgent } | { error: Error }> }
  workingDirectory?: WorkingDirectory
  connection: HostConnectionHandle
}
