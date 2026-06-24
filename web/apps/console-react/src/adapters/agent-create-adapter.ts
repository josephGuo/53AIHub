import type { IAgentCreateAdapter, AgentFormData, GroupOption, AgentFormRef, ChannelOption } from '@km/shared-business/agent-create'
import { AgentForm, Chat as SharedChat } from '@km/shared-business/agent-create'
import {
  getOpenClawCompatibleChannelType,
  isOpenClawCompatibleAgentType,
  normalizeOpenClawCompatibleCustomConfig,
  resolveOpenClawCompatibleAgentLogo,
  resolveOpenClawCompatibleAgentTypeFromRecord,
} from '@km/shared-business/agent-create'
import { agentApi, transform53aiBotItem, transformTencentAppItem, transformAppBuilderBotItem, transformCozeBotItem, transformCozeWorkspaceItem } from '@/api/modules/agent'
import { groupApi } from '@/api/modules/group'
import providersApi, { transformProviderList } from '@/api/modules/providers'
import channelApi, { transformSelectData } from '@/api/modules/channel'
import { AGENT_TYPES, getAgentByAgentType, BACKEND_AGENT_TYPE, AGENT_MODES, MODEL_USE_TYPE } from '@/constants/platform/config'
import type { AgentType } from '@/constants/platform/config'
import { GROUP_TYPE } from '@/constants/group'
import { CHANNEL_TYPE_VALUE_MAP } from '@/constants/platform/channel'
import { PageLayoutContent } from '@/components/PageLayout'
import { AgentPreview } from '@/views/agent/create/components/layout/Preview'
import { ConsoleOpenClawEmbeddedChatWorkspace } from '@/views/agent/create-v2/OpenClawEmbeddedChatWorkspace'
import { UseScope } from '@/views/agent/create/components/shared/UseScope'
import { t } from '@/locales'
import { generateRandomId } from '@/utils'
import { copyToClip } from '@km/shared-utils'
import { lib_host, api_host } from '@/utils/config'
import { ImageUpload } from '@/components/Upload/image'
import { GroupSelect } from '@/components/GroupSelect'
import { GroupTabs } from '@/components/GroupTabs'
import { useEnterpriseStore, useConversationStore } from '@/stores'
import { conversationApi } from '@/api/modules/conversation'
import uploadApi from '@/api/modules/upload'
import { XBubbleList, XBubbleUser, XBubbleAssistant, XIcon, XSender } from '@km/hub-ui-x-react'

// ==================== 数据转换 ====================

const DEFAULT_COMPLETION_PARAMS = {
  temperature: 0.2,
  top_p: 0.75,
  presence_penalty: 0.5,
  frequency_penalty: 0.5,
}

/** 转换 API 响应到表单数据 */
export function transformToFormData(data: any): AgentFormData {
  const openClawAgentType = resolveOpenClawCompatibleAgentTypeFromRecord(data)
  const agentType = openClawAgentType || data.custom_config?.agent_type || 'prompt'
  const agentOptionData = getAgentByAgentType(agentType as AgentType)
  const isOpenclaw = Boolean(openClawAgentType) || isOpenClawCompatibleAgentType(agentType)
  const openClawCustomConfig = isOpenclaw
    ? normalizeOpenClawCompatibleCustomConfig(data.custom_config, openClawAgentType || agentType)
    : undefined

  // prompt 类型需要将 model 转换为 model_value 格式
  let model = data.model || ''
  if (!isOpenclaw && agentType === AGENT_TYPES.PROMPT) {
    const customConfig = data.custom_config || {}
    model = `${customConfig.channel_id}_53aikm_${data.model}_53aikm_${data.channel_type}` || ''
  }

  return {
    agent_id: data.agent_id,
    bot_id: data.bot_id || '',
    logo: isOpenclaw ? resolveOpenClawCompatibleAgentLogo(data.logo, agentType) : (data.logo || agentOptionData?.icon || ''),
    name: data.name || '',
    group_id: +data.group_id || 0,
    description: data.description || '',
    channel_type: isOpenclaw ? getOpenClawCompatibleChannelType(openClawAgentType || agentType) : (+data.channel_type || 0),
    model,
    sort: +data.sort || 0,
    prompt: data.prompt || '',
    user_group_ids: data.user_group_ids || [],
    subscription_group_ids: data.subscription_group_ids || [],
    tools: data.tools || [],
    use_cases: data.use_cases || [],
    configs: isOpenclaw
      ? data.configs
      : (data.configs && Object.keys(data.configs).length > 0
        ? data.configs
        : { completion_params: DEFAULT_COMPLETION_PARAMS }),
    enable: !!+data.enable || false,
    custom_config: isOpenclaw
      ? openClawCustomConfig!
      : {
          agent_type: agentType,
          provider_id: 0,
          channel_id: 0,
          coze_workspace_id: '',
          coze_bot_id: '',
          coze_bot_url: '',
          tencent_bot_id: '',
          app_builder_bot_id: '',
          chat53ai_agent_id: '',
          channel_config: data.channel_config || {},
          ...(data.custom_config || {}),
        },
    settings: isOpenclaw
      ? data.settings
      : {
          opening_statement: '',
          suggested_questions: [],
          file_parse: { enable: false },
          image_parse: { vision: false, enable: false },
          relate_agents: [],
          input_fields: [],
          output_fields: [],
          ...(data.settings || {}),
        },
    // 时间戳字段
    created_time: data.created_time,
    updated_time: data.updated_time,
    // 保留原始的 agent_type 数字（0=对话, 1=补全, 2=助手）
    backend_agent_type: data.backend_agent_type,
  }
}

/** 转换表单数据到 API 请求 */
function transformToSaveData(formData: AgentFormData): any {
  const {
    agent_id,
    bot_id,
    logo,
    name,
    group_id,
    description,
    model,
    channel_type,
    prompt,
    sort,
    tools,
    use_cases,
    user_group_ids,
    subscription_group_ids,
    configs,
    custom_config,
    settings,
    enable,
  } = formData
  
  // Openclaw 类型：保持原始数据，不填充默认值
  const isOpenclaw = isOpenClawCompatibleAgentType(custom_config?.agent_type)

  const data: any = {
    agent_id: agent_id || 0,
    agent_type: BACKEND_AGENT_TYPE.AGENT, // 默认为 chat 类型
    channel_type,
    model,
    logo,
    name,
    group_id: +group_id || 0,
    description,
    sort,
    prompt,
    user_group_ids,
    subscription_group_ids,
    use_cases,
    tools,
    configs,
    custom_config,
    settings,
    enable,
  }

  // 根据平台类型处理 model
  const agentConfig = getAgentByAgentType(custom_config?.agent_type as AgentType)

  if (isOpenclaw) {
    data.channel_type = getOpenClawCompatibleChannelType(custom_config?.agent_type)
    data.model = 'openclaw-ws'
  } else if (!channel_type) {
    data.channel_type = CHANNEL_TYPE_VALUE_MAP.get(custom_config?.agent_type) || 0
  }
  switch (custom_config?.agent_type) {
    case AGENT_TYPES.PROMPT:
      data.custom_config.channel_id = +model.split('_53aikm_')[0] || 0
      data.model = model.split('_53aikm_')[1] || ''
      data.channel_type = +model.split('_53aikm_')[2] || 0
      break
    case AGENT_TYPES.COZE_AGENT_CN:
      data.model = custom_config.coze_bot_id || ''
      break
    case AGENT_TYPES.COZE_WORKFLOW_CN:
      const params = new URLSearchParams(custom_config.coze_bot_url?.split('?')[1] || '')
      data.model = `workflow-${params.get('workflow_id')}` || ''
      break
    case AGENT_TYPES.APP_BUILDER:
      data.model = custom_config.app_builder_bot_id || ''
      break
    case AGENT_TYPES.TENCENT:
      data.model = `bot-${custom_config.tencent_bot_id}` || ''
      break
    case AGENT_TYPES['53AI_AGENT']:
      data.model = custom_config.chat53ai_agent_id || ''
      break
    case AGENT_TYPES['53AI_WORKFLOW']:
      data.model = `workflow-${custom_config.chat53ai_agent_id}` || ''
      break
    case AGENT_TYPES.YUANQI:
      data.model = model || ''
      break
  }
  
  // 设置 agent_type
  // Openclaw 类型特殊处理：agent_type = 2, agent_mode = 'assistant'
  if (isOpenclaw) {
    data.agent_type = 2 // Openclaw 专用类型
    data.custom_config.agent_mode = 'assistant'
  } else if (agentConfig && agentConfig.mode === AGENT_MODES.COMPLETION) {
    data.agent_type = BACKEND_AGENT_TYPE.WORKFLOW
    data.custom_config.agent_mode = agentConfig?.mode || 'chat'
  } else {
    data.custom_config.agent_mode = agentConfig?.mode || 'chat'
  }

  data.custom_config.agent_type = custom_config?.agent_type

  return data
}

// ==================== 适配器实现 ====================

export const consoleAgentAdapter: IAgentCreateAdapter = {
  // ========== 能力声明 ==========

  supportedPlatforms: [
    AGENT_TYPES.PROMPT,
    AGENT_TYPES.COZE_AGENT_CN,
    AGENT_TYPES.COZE_WORKFLOW_CN,
    AGENT_TYPES.COZE_AGENT_OSV,
    AGENT_TYPES.COZE_WORKFLOW_OSV,
    AGENT_TYPES.DIFY_AGENT,
    AGENT_TYPES.DIFY_WORKFLOW,
    AGENT_TYPES.FASTGPT_AGENT,
    AGENT_TYPES.FASTGPT_WORKFLOW,
    AGENT_TYPES.MAXKB_AGENT,
    AGENT_TYPES.N8N_WORKFLOW,
    AGENT_TYPES.TENCENT,
    AGENT_TYPES.VOLCENGINE,
    AGENT_TYPES.BAILIAN,
    AGENT_TYPES.APP_BUILDER,
    AGENT_TYPES['53AI_AGENT'],
    AGENT_TYPES['53AI_WORKFLOW'],
    AGENT_TYPES.YUANQI,
    AGENT_TYPES.OPENCLAW,
    AGENT_TYPES.QCLAW,
    AGENT_TYPES.CODEX,
    AGENT_TYPES.MANUS,
  ] as AgentType[],

  defaultPlatform: AGENT_TYPES.PROMPT as AgentType,

  visibleConfigKeys: [
    'model',
    'prompt',
    'tools',
    'relate_agents',
    'input_fields',
    'output_fields',
    'file_parse',
    'image_parse',
    'opening_statement',
    'suggested_questions',
  ],

  // ========== API 操作 ==========

  async getDetail(agentId: number | string): Promise<AgentFormData> {
    const data = await agentApi.detail({ data: { agent_id: agentId } })

    // 参考Vue toolbox版本：需要先加载分组列表，再从 user_group_ids 中过滤出对应的分组ID
    const enterprise = useEnterpriseStore.getState().info
    const allGroupIds = data.user_group_ids || []

    // 并行加载注册用户分组和内部用户分组
    const [subscriptionGroups, internalGroups] = await Promise.all([
      (enterprise.is_independent || enterprise.is_industry)
        ? groupApi.list({ params: { group_type: GROUP_TYPE.USER } }).then(list => (list || []).map((item: any) => item.group_id))
        : Promise.resolve([]),
      (enterprise.is_enterprise || enterprise.is_industry)
        ? groupApi.list({ params: { group_type: GROUP_TYPE.INTERNAL_USER } }).then(list => (list || []).map((item: any) => item.group_id))
        : Promise.resolve([]),
    ])

    // 更新 data 中的分组字段，根据分组类型拆分
    data.subscription_group_ids = allGroupIds.filter((id: number) => subscriptionGroups.includes(id))
    data.user_group_ids = allGroupIds.filter((id: number) => internalGroups.includes(id))

    return transformToFormData(data)
  },

  async save(formData: AgentFormData): Promise<AgentFormData> {
    const saveData = transformToSaveData(formData)
    const result = await agentApi.save({ data: saveData })
    return transformToFormData(result)
  },

  async getGroupOptions(): Promise<GroupOption[]> {
    const list = await groupApi.list({ params: { group_type: GROUP_TYPE.AGENT } })
    return (list || []).map((item: any) => ({
      value: +item.group_id || 0,
      label: item.group_name || '',
    }))
  },

  async delete(agentId: number): Promise<void> {
    await agentApi.delete({ data: { agent_id: agentId } })
  },

  async saveChannel(saveData: Record<string, any>): Promise<Record<string, any>> {
    const { channel_id, key, base_url, config, models, name, type } = saveData
    const payload = {
      key,
      base_url: base_url || '',
      name,
      models: Array.isArray(models) ? models.join(',') : models,
      config: JSON.stringify(config || {}),
      type: type || 1,
      priority: 0,
      weight: 0,
      other: '',
      model_mapping: '',
      custom_config: '',
      provider_id: 0,
    }
    let result
    if (channel_id) {
      result = await channelApi.update(channel_id, payload)
    } else {
      result = await channelApi.create(payload)
    }
    return result || {}
  },

  // ========== 平台配置 ==========

  getAgentConfig(platform: AgentType) {
    const config = getAgentByAgentType(platform)
    return {
      icon: config?.icon || '',
      name: config?.name || '',
      channelName: config?.channelName || '',
      channelType: config?.channelType || 0,
      mode: config?.mode || 'chat',
    }
  },

  async getPlatformConfig(params: { platform: AgentType; type?: string; provider_id?: number; agent_id?: string; workspace_id?: string; channel_id?: number; bot_id?: string | number; group_id?: number; keyword?: string; offset?: number; limit?: number }): Promise<any> {
    const { platform, type, provider_id, agent_id } = params

    if (type === 'providers') {
      const agentConfig = getAgentByAgentType(platform)
      const providerType = agentConfig?.providerId
      const list = await providersApi.list({ providerType })
      return { providers: transformProviderList(list || []) }
    }

    switch (platform) {
      case AGENT_TYPES.COZE_AGENT_CN:
      case AGENT_TYPES.COZE_WORKFLOW_CN: {
        if (type === 'bots') {
          const list = await agentApi.coze.bots_list(params.workspace_id || '', { provider_id })
          return { bots: (list || []).map(transformCozeBotItem) }
        }
        if (type === 'workspaces') {
          const ws = await agentApi.coze.workspaces_list({ provider_id })
          return { workspaces: (ws || []).map(transformCozeWorkspaceItem) }
        }
        // 默认返回 workspaces（向后兼容）
        const ws = await agentApi.coze.workspaces_list({ provider_id })
        return { workspaces: (ws || []).map(transformCozeWorkspaceItem) }
      }
      case AGENT_TYPES.APP_BUILDER: {
        const list = await agentApi.appbuilder.bots_list({ provider_id })
        return { bots: (list || []).map(transformAppBuilderBotItem) }
      }
      case AGENT_TYPES['53AI_AGENT']: {
        if (type === 'input_fields') {
          const res = await agentApi.chat53ai.workflow_field_list(agent_id || '', { provider_id })
          const fields = (res?.user_input_form || []).map((item: any) => Object.values(item)[0])
          return { input_fields: fields }
        }
        const list = await agentApi.chat53ai.bots_list({ provider_id })
        return { bots: (list || []).map(transform53aiBotItem) }
      }
      case AGENT_TYPES['53AI_WORKFLOW']: {
        if (type === 'input_fields') {
          const res = await agentApi.chat53ai.workflow_field_list(agent_id || '', { provider_id })
          const fields = (res?.user_input_form || []).map((item: any) => Object.values(item)[0])
          return { input_fields: fields }
        }
        const list = await agentApi.chat53ai.workflow_list({ provider_id })
        return { workflows: (list || []).map(transform53aiBotItem) }
      }
      case AGENT_TYPES.TENCENT: {
        const list = await agentApi.tencent.bots_list({ provider_id })
        return { bots: (list || []).map(transformTencentAppItem) }
      }
      case AGENT_TYPES.DIFY_WORKFLOW: {
        if (type === 'workflow_fields' && params.channel_id) {
          const res = await agentApi.dify.workflow_field_list(params.channel_id)
          return { user_input_form: res?.user_input_form || [] }
        }
        return null
      }
      default:
        return null
    }
  },

  // ========== UI 组件注入 ==========

  PageLayout: PageLayoutContent,

  AgentFormComponent: AgentForm as React.ComponentType<{
    agentType: string
    showChannelConfig?: boolean
    className?: string
    ref?: React.Ref<AgentFormRef>
  }>,

  // ========== 工具函数注入 ==========

  t,
  generateRandomId,
  ImageUploadComponent: ImageUpload as React.ComponentType<{
    className?: string
    value?: string
    onChange?: (url: string) => void
  }>,

  PreviewComponent: AgentPreview as React.ComponentType<{
    ref?: any
  }>,

  InlinePreviewComponent: SharedChat as React.ComponentType<{
    className?: string
  }>,

  OpenClawPreviewComponent: ConsoleOpenClawEmbeddedChatWorkspace,

  UseScopeComponent: UseScope as React.ComponentType<{}>,

  markdownEditorConfig: {
    cdn: `${lib_host}/js/vditor`,
    apiHost: api_host,
  },

  apiHost: api_host,

  // ========== 企业信息 ==========

  get isIndependent() { return useEnterpriseStore.getState().info.is_independent },
  get isIndustry() { return useEnterpriseStore.getState().info.is_industry },
  get isEnterprise() { return useEnterpriseStore.getState().info.is_enterprise },

  // ========== 分组类型常量 ==========

  GROUP_TYPE: {
    USER: GROUP_TYPE.USER,
    INTERNAL_USER: GROUP_TYPE.INTERNAL_USER,
    AGENT: GROUP_TYPE.AGENT,
  },

  // ========== 分组选择组件 ==========

  GroupSelectComponent: GroupSelect as React.ComponentType<{
    value?: number | number[]
    onChange?: (value: number | number[]) => void
    type?: string
    groupType?: string
    multiple?: boolean
    onOptionsLoad?: (options: any[]) => void
  }>,

  GroupTabsComponent: GroupTabs as React.ComponentType<{
    type?: string
    groupType?: string
    value?: string | number | (string | number)[]
    options?: any[]
    disabled?: boolean
    hideFooter?: boolean
    hidePrefix?: boolean
    className?: string
    onChange?: (value: string | number | (string | number)[]) => void
    onOptionsChange?: (options: any[]) => void
  }>,

  // ========== AGENT_TYPES 常量 ==========

  AGENT_TYPES,

  // ========== 会话/预览相关 API ==========

  createConversation: async (data) => {
    const conversationStore = useConversationStore.getState()
    const res = await conversationStore.save({ data })
    return { conversation_id: (res as any).data?.conversation_id || (res as any).conversation_id }
  },

  sendChatMessage: async (params) => {
    const conversationStore = useConversationStore.getState()
    await conversationStore.chat({
      data: {
        conversation_id: params.conversation_id,
        messages: params.messages,
        agent_id: params.agent_id,
        agent_configs: params.agent_configs,
      },
      hideError: true,
      onDownloadProgress: params.onDownloadProgress,
      signal: params.signal,
    })
  },

  runWorkflow: async (data, options) => {
    return conversationApi.workflow.run(data, options)
  },

  uploadFile: async (file) => {
    const res = await uploadApi.upload(file)
    return {
      id: res.data.id,
      url: `${api_host}/api/preview/${res.data.preview_key || ''}`,
      size: res.data.size,
      name: res.data.file_name,
      mime_type: res.data.mime_type,
    }
  },

  // ========== 模型列表 ==========

  loadModels: async () => {
    const list = await channelApi.listv2()
    const options: ChannelOption[] = []
    for (const item of list || []) {
      // 使用 transformSelectData 过滤模型，默认过滤推理模型
      const transformed = transformSelectData(item, MODEL_USE_TYPE.REASONING, undefined)
      if (transformed.options && transformed.options.length > 0) {
        options.push({
          value: `${item.channel_id}`,
          label: transformed.platform_name || transformed.name || '',
          icon: transformed.platform_icon || '',
          options: transformed.options.map((model: any) => ({
            value: model.value,
            model_value: model.model_value,
            label: model.label,
            icon: model.icon,
            vision: model.vision || false,
            deep_thinking: model.deep_thinking || false,
          })),
        })
      }
    }
    return options
  },

  // ========== 智能体列表 ==========

  getAgentList: async (params) => {
    const result = await agentApi.list({
      params: {
        group_id: params.group_id,
        keyword: params.keyword,
        offset: params.offset,
        limit: params.limit,
      },
    })
    return {
      count: result.count || 0,
      agents: result.agents || [],
    }
  },

  // ========== 消息气泡组件库 ==========

  BubbleComponents: {
    XBubbleList,
    XBubbleUser,
    XBubbleAssistant,
    XIcon,
    XSender,
  },

  // ========== Openclaw 密钥重置 ==========

  resetSecret: async (agentId: number) => {
    const data = await agentApi.resetSecret({ data: { agent_id: agentId } })
    return { secret: data.secret }
  },

  // ========== 复制到剪贴板 ==========

  copyToClip,
}

export default consoleAgentAdapter
