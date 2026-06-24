import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react'
import { Button, message } from 'antd'
import { useAgentCreateAdapter } from '../../adapters'
import { useAgentFormStore } from '../../store'
import { copyToClip } from '@km/shared-utils'

interface ChatMessage {
  question: {
    role: string
    content: string
    user_files: any[]
  }
  answer: {
    loading: boolean
    role: string
    content: string
    reasoning_expanded: boolean
    reasoning_content: string
  }
}

const ConversationType = {
  FORMAL: 0,
  TEST: 1,
} as const

interface ChatProps {
  className?: string
  onSave?: (options?: { restart?: boolean }) => void
  /** 是否隐藏标题（用于 CreatePageLayout 等已有外部标题的场景） */
  hideTitle?: boolean
}

export interface ChatRef {
  restart: (options?: { saveAction?: boolean }) => void
  getIsConfigChanged: () => boolean
}

export const Chat = forwardRef<ChatRef, ChatProps>(({ className, onSave: _onSave, hideTitle = false }, ref) => {
  const adapter = useAgentCreateAdapter()
  const t = adapter.t || ((key: string) => key)

  const agentFormStore = useAgentFormStore()

  const scrollRef = useRef<any>(null)
  const [chatList, setChatList] = useState<ChatMessage[]>([])
  const [conversationCreating, setConversationCreating] = useState(false)
  const [isConfigChanged, setIsConfigChanged] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const conversationIdRef = useRef(0)
  const activeChatIndexRef = useRef(-1)
  const renderTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeChatDataRef = useRef<ChatMessage>({
    question: {
      role: 'user',
      content: '',
      user_files: [],
    },
    answer: {
      loading: false,
      role: '',
      content: '',
      reasoning_expanded: false,
      reasoning_content: '',
    },
  })

  const chatLoading = conversationCreating || chatList.some(item => item.answer.loading)

  const enableUpload = Boolean(
    agentFormStore.form_data.settings?.file_parse?.enable ||
    agentFormStore.form_data.settings?.image_parse?.enable
  )

  const uploadAccept = (() => {
    let accept = ''
    if (agentFormStore.form_data.settings?.file_parse?.enable) {
      accept += '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.html,.json,.xml,.md'
    }
    if (agentFormStore.form_data.settings?.image_parse?.enable) {
      accept += ',image/*'
    }
    return accept
  })()

  const AGENT_TYPES = adapter.AGENT_TYPES || {}
  const allowSendWithFiles = [AGENT_TYPES['53AI_AGENT'], AGENT_TYPES.FASTGPT_AGENT].includes(
    agentFormStore.agent_type as any
  )

  const showWelcome = (() => {
    const { settings } = agentFormStore.form_data
    if (settings.opening_statement?.replace(/\s/g, '')) return true
    if (settings.suggested_questions?.length && settings.suggested_questions?.some(item => item.content?.replace?.(/\s/g, ''))) {
      return true
    }
    return false
  })()

  const showChatListEmpty = !chatList.length

  const Bubble = adapter.BubbleComponents

  const httpRequest = async (dataFile: File) => {
    if (!adapter.uploadFile) return {}
    try {
      const res = await adapter.uploadFile(dataFile)
      return {
        id: res.id,
        url: res.url,
        size: res.size,
        name: res.name,
        mime_type: res.mime_type,
      }
    } catch (error) {
      return {}
    }
  }

  const onSendConfirm = async (question: string, userFiles?: any[], type = '') => {
    if (chatLoading) return
    userFiles = userFiles || []

    const agentId = agentFormStore.agent_id
    if (!agentId) {
      message.warning(t('agent.preview_publish_first'))
      return
    }

    if (!agentFormStore.agent_data.channel_type) {
      if (adapter.save) {
        await adapter.save(agentFormStore.form_data)
      }
    }

    if (!conversationIdRef.current) {
      if (!adapter.createConversation) {
        message.warning('createConversation not configured')
        return
      }
      setConversationCreating(true)
      try {
        const data = await adapter.createConversation({
          agent_id: agentId,
          title: question,
          conversation_type: ConversationType.TEST,
        })
        conversationIdRef.current = data.conversation_id
      } finally {
        setConversationCreating(false)
      }
    }

    if (type !== 'regenerate') {
      userFiles = userFiles?.map(item => ({
        type: 'image',
        content: `file_id:${item.id}`,
        filename: item.name,
        size: item.size,
        mime_type: item.mime_type,
        url: item.url,
      })) || []
    }

    const newChat: ChatMessage = {
      question: {
        role: 'user',
        content: question,
        user_files: userFiles as any[],
      },
      answer: {
        loading: true,
        role: 'assistant',
        content: '',
        reasoning_expanded: true,
        reasoning_content: '',
      },
    }

    setChatList(prev => {
      const newList = [...prev, newChat]
      activeChatIndexRef.current = newList.length - 1
      activeChatDataRef.current = newList[activeChatIndexRef.current] || {}
      return newList
    })

    let messages = [{ role: 'user', content: question }]
    if (userFiles && userFiles.length) {
      messages = [
        {
          role: 'user',
          content: JSON.stringify([
            {
              type: 'text',
              content: question,
            },
            ...userFiles,
          ]),
        },
      ]
    }

    abortControllerRef.current = new AbortController()

    if (!adapter.sendChatMessage) {
      message.warning('sendChatMessage not configured')
      return
    }

    let receivedContent = ''

    await adapter.sendChatMessage({
      conversation_id: conversationIdRef.current,
      messages,
      agent_id: agentId,
      agent_configs: agentFormStore.agent_data.configs,
      signal: abortControllerRef.current.signal,
      onDownloadProgress: async ({ chunks = [], intact_content, intact_reasoning_content }: any = {}) => {
        receivedContent = intact_content || ''
        if (activeChatDataRef.current && activeChatDataRef.current.answer) {
          activeChatDataRef.current.answer.content = intact_content || activeChatDataRef.current.answer.content || ''
          activeChatDataRef.current.answer.reasoning_content =
            intact_reasoning_content || activeChatDataRef.current.answer.reasoning_content || ''
          if (chunks[0] && chunks[0].role) {
            activeChatDataRef.current.answer.role = chunks[0].role || activeChatDataRef.current.answer.role || ''
          }
          if (
            activeChatDataRef.current.answer.content?.trim() &&
            activeChatDataRef.current.answer.reasoning_content?.trim() &&
            activeChatDataRef.current.answer.reasoning_expanded
          ) {
            activeChatDataRef.current.answer.reasoning_expanded = false
          }
        }
        if (renderTimerRef.current) {
          clearTimeout(renderTimerRef.current)
        }
        renderTimerRef.current = setTimeout(() => {
          setChatList(prev => [...prev])
          renderTimerRef.current = null
        }, 200)
      },
    }).catch(() => {}).finally(() => {
      if (renderTimerRef.current) {
        clearTimeout(renderTimerRef.current)
        renderTimerRef.current = null
      }
      const lastIntactContent = receivedContent || activeChatDataRef.current?.answer?.content || ''
      if (
        lastIntactContent?.startsWith('Upstream Error') ||
        lastIntactContent?.startsWith('Error: 当前应用模型余额不足') ||
        !lastIntactContent
      ) {
        if (activeChatDataRef.current?.answer) {
          activeChatDataRef.current.answer.content = t('app.failed_tip')
        }
        message.warning(t('app.failed_tip'))
      }
      if (activeChatDataRef.current?.answer?.loading) {
        activeChatDataRef.current.answer.loading = false
      }
      setChatList(prev => [...prev])
      abortControllerRef.current = null
    })

    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollToBottom?.()
      }
    }, 0)
  }

  const onStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    if (activeChatDataRef.current && activeChatDataRef.current.answer) {
      activeChatDataRef.current.answer.loading = false
      setChatList(prev => [...prev])
    }
  }

  const onRestartGeneration = (data: ChatMessage) => {
    onSendConfirm(data.question.content, data.question.user_files, 'regenerate')
  }

  const onRestart = ({ saveAction: _saveAction = false } = {}) => {
    conversationIdRef.current = 0
    setChatList([])
    setIsConfigChanged(false)
  }

  const onCopy = async (text = '') => {
    await copyToClip(text)
    message.success(t('action.copy_success'))
  }

  const handleSuggestion = (question: string) => {
    onSendConfirm(question)
  }

  useEffect(() => {
    setIsConfigChanged(false)
    if (conversationIdRef.current) {
      setIsConfigChanged(true)
    }
  }, [agentFormStore.form_data.custom_config])

  useImperativeHandle(ref, () => ({
    restart: onRestart,
    getIsConfigChanged: () => isConfigChanged,
  }))

  // 如果没有配置 BubbleComponents，显示占位符
  if (!Bubble) {
    return (
      <div className={`h-full flex items-center justify-center text-gray-400 ${className || ''}`}>
        {t('agent.preview_not_configured')}
      </div>
    )
  }

  const { XBubbleList, XBubbleUser, XBubbleAssistant, XIcon, XSender } = Bubble

  return (
    <div className={`h-full flex flex-col bg-white rounded-lg relative ${className || ''}`}>
      {/* 标题 - 仅在 Openclaw 等独立场景显示 */}
      {!hideTitle && (
        <div className="px-6 py-[14px]">
          <span className="text-base font-medium text-[#333]">
            {t('agent.preview_debug')}
          </span>
        </div>
      )}

      {/* 配置变更遮罩 */}
      {isConfigChanged && (
        <div className="absolute top-0 left-0 w-full h-full bg-black/70 z-10 rounded-lg">
          <div className="flex flex-col items-center justify-center gap-6 w-full h-full box-border">
            <div className="text-base text-[#fff] text-center mx-8">
              {t('app.config_change_confirm')}
            </div>
            <Button type="primary" onClick={() => onRestart({ saveAction: true })}>
              {t('app.save_and_restart')}
            </Button>
          </div>
        </div>
      )}

      {/* 气泡列表区域 */}
      <XBubbleList
        ref={scrollRef}
        messages={chatList}
        className="flex-1 px-4 relative py-4"
        mainClass={`mx-5 ${ showChatListEmpty ? 'min-h-full' : '' }`}
      >
        {showChatListEmpty ? (
          <div className="min-h-full flex flex-col items-center justify-center gap-3">
            {agentFormStore.form_data.logo && (
              <img
                src={agentFormStore.form_data.logo}
                alt={agentFormStore.form_data.name || 'Agent'}
                className="w-14 h-14 rounded-xl object-cover"
              />
            )}
            {agentFormStore.form_data.name && (
              <span className="text-lg text-primary">
                {agentFormStore.form_data.name}
              </span>
            )}
            <div className="h-8"></div>
            {showWelcome && (
              <div className='w-full'>
                <XBubbleAssistant
                  type="welcome"
                  content={agentFormStore.form_data.settings.opening_statement}
                  suggestions={agentFormStore.form_data.settings.suggested_questions}
                  onSuggestion={handleSuggestion}
                />
              </div>
            )}
          </div>
        ) : null}

        {chatList.map((message, messageIndex) => (
          <div key={messageIndex}>
            <XBubbleUser content={message.question.content} files={message.question.user_files}>
              {!message.answer.loading && (
                <span slot="menu">
                  <XIcon size={16} className="cursor-pointer" name="copy" onClick={() => onCopy(message.question.content)} />
                </span>
              )}
            </XBubbleUser>
            <XBubbleAssistant
              content={message.answer.content}
              reasoning={message.answer.reasoning_content}
              reasoningExpanded={message.answer.reasoning_expanded}
              streaming={message.answer.loading}
              alwaysShowMenu={messageIndex === chatList.length - 1}
            >
              {!message.answer.loading && (
                <>
                  <span slot="menu">
                    <XIcon size={16} className="cursor-pointer" name="copy" onClick={() => onCopy(message.answer.content)} />
                  </span>
                  <span slot="menu">
                    <XIcon size={16} className="cursor-pointer" name="refresh" onClick={() => onRestartGeneration(message)} />
                  </span>
                </>
              )}
            </XBubbleAssistant>
          </div>
        ))}
      </XBubbleList>

      {/* 发送区域 */}
      <div className="px-6 py-3">
        <XSender
          enableUpload={enableUpload}
          acceptTypes={uploadAccept}
          httpRequest={httpRequest}
          loading={chatLoading}
          allowMultiple={true}
          enableDragUpload={true}
          allowSendWithFiles={allowSendWithFiles}
          onSend={onSendConfirm}
          onStop={onStopGeneration}
        />
        {/* AI generated tip */}
        <div className="text-center mt-2">
          <span className="text-xs text-[#999]">
            {t('agent.ai_generated_tip')}
          </span>
        </div>
      </div>
    </div>
  )
})

Chat.displayName = 'Chat'

export default Chat
