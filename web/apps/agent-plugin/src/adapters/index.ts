import type { PluginAdapters } from '@km/shared-business'
import { agentConversationApi } from './conversation'
import { agentAgentApi } from './agent'
import { agentUploadApi } from './upload'
import { workflowApi } from './workflow'

export const adapters: PluginAdapters = {
  conversationApi: agentConversationApi,
  agentApi: agentAgentApi,
  uploadApi: agentUploadApi,
  workflowApi: workflowApi,
}

export { workflowApi }
