/** 流程记录 */
export interface ProcessRecord {
  step_code: string;
  status: 'start' | 'completed' | 'success' | 'streaming';
  message: string;
  data?: string | object;
}

/** 技能运行项状态 */
export type SkillRunItemStatus = 'pending' | 'running' | 'completed';

/** 技能运行项 - 脚本 */
export interface SkillRunScriptItem {
  type: 'script';
  title: string;
  bash: string;
  output: string;
  status: SkillRunItemStatus;
}

/** 技能运行项 - LLM */
export interface SkillRunLlmItem {
  type: 'llm';
  title: string;
  content: string;
  status: SkillRunItemStatus;
}

/** 技能运行项 - 搜索 */
export interface SkillRunSearchItem {
  type: 'search';
  title: string;
  icon?: string;
  sourceCount?: number;
  tags?: string[];
  sources?: Array<{ title: string; url?: string; icon?: string }>;
  status?: SkillRunItemStatus;
}

/** 技能运行项 - 技能 */
export interface SkillRunSkillItem {
  type: 'skill';
  title: string;
  status: SkillRunItemStatus;
  skillName?: string;
  intentData?: {
    intent?: string;
    skill_name?: string;
    confidence?: number;
    reasoning?: string;
    keywords?: string[];
    answer?: string;
  };
  _bash?: string;
  _toolCallId?: string;
}

/** 技能运行项联合类型 */
export type SkillRunItem =
  | SkillRunScriptItem
  | SkillRunSearchItem
  | SkillRunSkillItem
  | SkillRunLlmItem;

/** Openclaw 活动 */
export interface OpenClawInteractionOption {
  id?: string | number;
  value?: string | number | boolean;
  label?: string;
  title?: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

export interface OpenClawInteractionInfo {
  id?: string;
  type?: string;
  method?: string;
  question?: string;
  toolCallId?: string;
  requestId?: string;
  options?: OpenClawInteractionOption[];
  [key: string]: unknown;
}

export interface OpenClawActivityItem {
  key: string;
  sessionId?: string;
  seq?: number;
  kind: string;
  title: string;
  summary?: string;
  detail?: string;
  createdAt?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'error';
  tool?: {
    toolCallId?: string;
    name?: string;
    displayName?: string;
    meta?: string;
    input?: string;
    output?: string;
    isError?: boolean;
  };
  requiresUserInput?: boolean;
  interaction?: OpenClawInteractionInfo;
  questions?: OpenClawInteractionInfo[];
  resolved?: boolean;
}

export type OpenClawTimelineItemType =
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'answer'
  | 'run_terminal'
  | 'output_files';

/** 文件项 */
export interface FileItem {
  id: string | number;
  name?: string;
  file_name?: string;
  file_path?: string;
  file_ext?: string;
  file_mime?: string;
  file_size?: number;
  file_url?: string;
  icon?: string;
  url?: string;
  preview_key?: string;
  library_id?: string | number;
  upload_file_id?: string | number;
  isfolder?: boolean;
  is_favorite?: boolean;
  chunk_type?: string;
  source_key?: string;
  source?: string;
}

/** 知识图谱实体 */
export interface GraphEntity {
  id: string;
  name?: string;
  description?: string;
}

/** 知识图谱关系 */
export interface GraphRelation {
  source_entity_id: string;
  target_entity_id: string;
  predicate?: string;
}

/** 知识图谱数据 */
export interface GraphData {
  entities?: GraphEntity[];
  relations?: GraphRelation[];
}

/** 知识库引用片段 */
export interface ChunkItem {
  chunk_id?: string;
  chunk_type?: string;
  content?: string;
  file_id?: string | number;
  file_name?: string;
  file_path?: string;
  file_icon?: string;
  library_id?: string | number;
  library_name?: string;
  source_key?: string;
  source?: string;
  score?: number;
  url?: string;
  graph?: GraphData;
}

/** 知识库搜索结果 */
export interface RagStats {
  type?: string;
  chunks?: ChunkItem[];
  files_search?: FileItem[];
  library_search?: Array<{ id: string | number; name: string }>;
  file_quotations?: FileItem[];
}

/** 技能信息 */
export interface SkillInfo {
  display_name?: string;
  skill_name?: string;
}

export type Skill = SkillInfo;
export type MessageFile = FileItem;
export type SpecifiedFile = FileItem;

export interface SendMessageOptions {
  question: string;
  agent_id: string | number;
  conversation_id: string | number;
  modelId?: string;
  completion_params?: Record<string, any>;
  messageList?: Message[];
  links?: SpecifiedFile[];
  networkSearch?: boolean;
  knowledgeGraph?: boolean;
  library?: { value?: Array<string | number> };
  agentInfo?: any;
  files?: any[];
  fileInfo?: any;
  options?: {
    prompt?: string;
    text?: string;
  };
  minimalParams?: boolean;
  openclaw?: boolean;
  openclawStartSeq?: number;
  openclawConversationTitle?: string;
  skill?: Skill;
  type?: string;
  onMessageListChange?: (updater: (list: Message[]) => Message[], newMessage?: Message) => void;
  onOpenClawConversationResolved?: (conversationId: string) => void;
  onOpenClawEventSeqChange?: (conversationId: string, seq: number) => void;
}

/** 输出文件 */
export interface OutputFile {
  id: string | number;
  file_name?: string;
  url?: string;
  download_url?: string;
  signed_download_url?: string;
  mime_type?: string;
  size?: number;
  kind?: string;
  message_id?: string | number;
  source_kind?: string;
  base64?: string;
  content?: string;
  file_path?: string;
  is_favorite?: boolean;
}

export interface OpenClawTimelineItem {
  key: string;
  mergeKey?: string;
  sessionId?: string;
  seq?: number;
  createdAt?: string;
  type: OpenClawTimelineItemType;
  title?: string;
  content?: string;
  detail?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'error';
  kind?: string;
  replace?: boolean;
  tool?: OpenClawActivityItem['tool'];
  requiresUserInput?: boolean;
  interaction?: OpenClawInteractionInfo;
  questions?: OpenClawInteractionInfo[];
  resolved?: boolean;
  files?: OutputFile[];
  activity?: OpenClawActivityItem;
}

export interface OpenClawTurnEvent {
  eventId: string;
  sessionId?: string;
  seq?: number;
  kind: string;
  createdAt?: string;
  payload?: Record<string, unknown>;
  source?: 'stream' | 'events' | 'history';
  provisional?: boolean;
  replace?: boolean;
  messageId?: string | number;
  messageSeq?: number;
  segmentId?: string;
  turnId?: string;
  segmentType?: 'answer' | 'thinking' | 'tool_call' | 'tool_result' | 'run' | 'output_files';
  segmentIndex?: number;
  deltaIndex?: number;
  operation?: 'append' | 'replace' | 'close';
  visibility?: 'hidden' | 'stream' | 'final';
  final?: boolean;
}

export interface OpenClawTurnState {
  turnKey: string;
  sessionId?: string;
  status?: 'streaming' | 'completed' | 'failed' | 'interrupted';
  maxSeq: number;
  events: OpenClawTurnEvent[];
  resolvedMessageId?: string | number;
}

export interface OpenClawTurnProjection {
  timelineItems: OpenClawTimelineItem[];
  visibleAnswer: string;
  outputFiles: OutputFile[];
  activities: OpenClawActivityItem[];
  interrupted?: boolean;
  failed?: boolean;
  isStreaming?: boolean;
}

/** 消息类型 */
export interface Message {
  id: string | number;
  conversation_id?: string | number;
  question?: string;
  original_question?: string;
  answer?: string;
  content?: string;
  reasoning_content?: string;
  reasoning_expanded?: boolean;
  loading?: boolean;
  error?: boolean;
  showErrorDetails?: boolean;
  feedback_type?: 'satisfied' | 'unsatisfied' | '';
  feedbackVisible?: boolean;
  feedbackTypeOptions?: Map<string, boolean>;
  submitBtnDisabled?: boolean;
  feedbackSuccessful?: boolean;
  description?: string;
  feedbackId?: number | null;
  user_files?: FileItem[];
  specified_files?: FileItem[];
  uploaded_files?: FileItem[];
  skill?: SkillInfo;
  outputFiles?: OutputFile[];
  rag_stats?: RagStats;
  process_records?: ProcessRecord[];
  skillRunItems?: SkillRunItem[];
  openclawActivities?: OpenClawActivityItem[];
  openclawTimelineItems?: OpenClawTimelineItem[];
  openclawTurn?: OpenClawTurnState;
  openclawProjection?: OpenClawTurnProjection;
  raw_user_message?: any;
  raw_assistant_message?: any;
  time?: string;
  _openclawTurnStartSeq?: number;
  _openclawClientMessageId?: string | number;
  _openclawActiveRequestId?: string | number;
}

/** ChatMessages 功能配置 */
export interface ChatMessagesFeatures {
  menu?: {
    copy?: boolean;
    regenerate?: boolean;
    share?: boolean;
    addAsMd?: boolean;
    feedback?: boolean;
  };
  outputFiles?: boolean;
  /** 输出文件收藏功能开关 */
  fileFavorite?: boolean;
  sourceRef?: boolean;
  processFlow?: boolean;
  specifiedFiles?: boolean;
  /** 指定文件显示类型：no_jump 不跳转，jump 支持跳转 */
  specifiedFilesType?: 'no_jump' | 'jump';
  skillTag?: boolean;
}

/** Source 引用数据 */
export interface SourceReferenceData {
  element?: HTMLDivElement;
  sourceType: string;
  sourceNumber: number;
}

/** ChatMessages Props */
export interface ChatMessagesProps {
  messageList: Message[];
  agentInfo?: {
    agent_id?: string | number;
    name?: string;
    logo?: string;
    settings?: {
      opening_statement?: string;
      answer_remarks_config?: { enable: boolean; content: string };
    };
  };
  isStreaming?: boolean;
  features?: ChatMessagesFeatures;
  onRegenerate?: (msg: Message) => void;
  onFeedback?: (msg: Message, type: 'satisfied' | 'unsatisfied', description?: string) => void;
  onShare?: () => void;
  onAddAsMd?: (msg: Message) => void;
  onFileClick?: (file: FileItem) => void;
  onSourceClick?: (source: ChunkItem, msg: Message) => void;
  /** 打开知识库侧边栏回调 */
  onOpenKnow?: (msg: Message) => void;
  /** Source 引用悬停回调（用于显示 Chunk/Graph 弹窗） */
  /** 自定义 Source 渲染函数 */
  renderSource?: (type: string, number: number, msg: Message) => string;
  /** 输出文件收藏回调 */
  onOutputFileFavorite?: (file: OutputFile, msg: Message) => void;
  /** 输出文件收藏状态检查回调 */
  onOutputFileCheckFavorite?: (fileIds: string[]) => void;
  /** 反馈面板关闭回调（用于更新 message 状态） */
  onFeedbackClose?: (msg: Message) => void;
  /** 反馈选项切换回调 */
  onFeedbackToggle?: (msg: Message, key: string) => void;
  /** 反馈描述变化回调 */
  onFeedbackDescriptionChange?: (msg: Message, value: string) => void;
  /** 显示错误详情回调 */
  onShowErrorDetails?: (msg: Message) => void;
  onLoadMore?: (done: () => void) => void;
  isShareMode?: boolean;
  selectedMessageIds?: (string | number)[];
  onMessageSelect?: (msg: Message) => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}
