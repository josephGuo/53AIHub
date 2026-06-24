import { create } from 'zustand';
import { conversationApi, type ChatCompletionParams } from '@/api/modules/conversation';

interface ConversationState {
  loadListData: (opts?: { data?: { offset?: number; limit?: number } }) => Promise<unknown[]>
  save: (opts?: { data?: Record<string, unknown> }) => Promise<unknown>
  chat: (opts?: {
    data?: ChatCompletionParams
    onDownloadProgress?: (e: unknown) => void
    signal?: AbortSignal
    hideError?: boolean
  }) => Promise<unknown>
}

export const useConversationStore = create<ConversationState>(() => ({
  async loadListData({ data: { offset, limit } = {} } = {}) {
    const { conversations = [] } = await conversationApi.list({ offset, limit })
    return conversations.map((item: any = {}) => {
      return item
    })
  },

  async save({ data = {} } = {}) {
    const d = {
      conversation_id: 0,
      agent_id: 0,
      ...data,
    } as Record<string, unknown>
    if (!d.conversation_id) {
      delete d.conversation_id
      return conversationApi.create(d)
    } else {
      return conversationApi.update(d.conversation_id as number, d)
    }
  },

  async chat({ data, onDownloadProgress, signal, hideError } = {}) {
    const completionParams = (data as any)?.agent_configs?.completion_params || {
      frequency_penalty: 0.5,
      presence_penalty: 0.5,
      temperature: 0.2,
      top_p: 0.75,
    }

    // Need to delete agent_configs here, otherwise some channels will report errors
    const chatData = { ...data } as Record<string, unknown>
    if ((chatData as any).agent_configs) delete (chatData as any).agent_configs

    const finalData: ChatCompletionParams = {
      conversation_id: 0,
      frequency_penalty: completionParams.frequency_penalty || 0,
      messages: [],
      model: '',
      presence_penalty: completionParams.presence_penalty || 0,
      stream: true,
      temperature: completionParams.temperature || 0,
      top_p: completionParams.top_p || 0,
      ...chatData,
    }

    if (finalData.agent_id) {
      finalData.model = `agent-${finalData.agent_id}`
      delete finalData.agent_id
    }
    return conversationApi.chat(finalData, { onDownloadProgress, signal, hideError })
  },
}))
