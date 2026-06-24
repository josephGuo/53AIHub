/**
 * API Adapter Interfaces
 * Plugins implement these interfaces to provide data access
 */

export interface ChatCompletionParams {
  conversation_id?: string | number;
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream: boolean;
  enable_process_steps?: boolean;
  frequency_penalty?: number;
  presence_penalty?: number;
  temperature?: number;
  top_p?: number;
  knowledge_base_ids?: number[];
  file_ids?: string[];
  message_file_id?: string;
  solo_file_mode?: boolean;
  search_config?: any;
  web_search_config?: any;
  enable_graph_search?: boolean;
  completion_params?: any;
  metadata?: Record<string, any>;
}

export interface ConversationControlParams {
  action: "stop" | "respond_interruption" | "submit_answer" | "resolve_interruption";
  [key: string]: any;
}

export interface IConversationApi {
  create(agentId: string, question: string, title?: string, type?: string): Promise<any>;
  list(agentId: string, params?: { conversation_type?: string; offset?: number; limit?: number }): Promise<any>;
  messages(conversationId: string, params?: { offset?: number; limit?: number }): Promise<any>;
  events?(conversationId: string, params?: { offset?: number; limit?: number; after_seq?: number }): Promise<any>;
  snapshot?(conversationId: string, params?: { after_seq?: number }): Promise<any>;
  control?(conversationId: string, data: ConversationControlParams): Promise<any>;
  edit(conversationId: string | number, data: { title: string }): Promise<any>;
  del(conversationId: string | number): Promise<any>;
  completions(
    params: ChatCompletionParams,
    options: {
      responseType: "stream";
      onDownloadProgress: (e: any) => void;
      signal?: AbortSignal;
    }
  ): Promise<any>;
}

export interface IAgentApi {
  detail(agentId: string): Promise<any>;
  list(): Promise<any>;
  myDetail(agentId: string): Promise<any>;
  myList(): Promise<any>;
}

export interface IUploadApi {
  upload(file: File, type?: string): Promise<any>;
}

export interface IWorkflowApi {
  run(
    data: {
      conversation_id: string | number;
      model: string;
      parameters: Record<string, any>;
      stream: boolean;
    },
    options?: { signal?: AbortSignal }
  ): Promise<any>;
}

/**
 * Agent 设置对象类型
 */
export interface IAgentSettings {
  opening_statement?: string;
  suggested_questions?: Array<{ id: string; content: string }>;
  input_fields?: Array<{
    id: string;
    variable: string;
    label: string;
    type: string;
    required?: boolean;
    options?: Array<{ label: string; value: string }>;
    multiple?: boolean;
    max_length?: number;
    show_word_limit?: boolean;
    desc?: string;
    file_limit?: number;
    file_size?: number;
    file_accept?: string[];
  }>;
  output_fields?: Array<{
    id: string;
    variable: string;
    label?: string;
    type: string;
  }>;
  relate_agents?: any[];
  file_parse?: { enable: boolean };
  image_parse?: { vision: boolean; enable: boolean };
}

/**
 * Agent 自定义配置类型
 */
export interface IAgentCustomConfig {
  agent_mode?: 'chat' | 'completion';
  agent_type?: string;
  openclaw_app_secret?: string;
}

/**
 * Agent 信息类型
 * 被 ChatView 和 CompletionView 共用
 */
export interface IAgentInfo {
  agent_id: string | number;
  name: string;
  logo?: string;
  description?: string;
  configs?: string | Record<string, any>;
  settings?: IAgentSettings;
  settings_obj?: IAgentSettings;
  custom_config_obj?: IAgentCustomConfig;
  use_cases?: any[];
  /** 用户组 IDs - 用于 AuthTagGroup 显示使用范围 */
  user_group_ids?: number[];
}
