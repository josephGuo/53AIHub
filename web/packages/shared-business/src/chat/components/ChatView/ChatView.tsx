import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { CloseOutlined } from "@ant-design/icons";
import { Modal, message, Spin } from "antd";
import { usePluginAdapters, usePluginConfig } from "../../context";
import { useConversationStore } from "../../stores";
import {
  getOpenClawMessageListMaxActivitySeq,
  getOpenClawTimelineMaxSeq,
  mergeOpenClawActiveMessageIntoList,
  mergeOpenClawTimelineEventsIntoMessage,
  useChatMessages,
  useChatSend,
  useChatTimeout,
  useEmbedMode,
} from "../../hooks";
import { useTranslation, type Lang } from "../../i18n";
import { ChatHistory, type ChatHistoryRef, UsageGuide, LoadingState, CompletionView, MessageMenu, ShareHeader, SourceReferenceManager, type SourceReferenceManagerRef } from "../index";
import ChatHeader from "./ChatHeader";
import { ChatMessages } from "../ChatMessages";
import ChatInput, { type SendData } from "./ChatInput";
import type { IAgentInfo } from "../../adapters/types";
import type {
  Message,
  ChunkItem,
  SourceReferenceData,
  OutputFile,
  OpenClawActivityItem,
  OpenClawInteractionOption,
} from "../../types";
import { setConversationApi } from "../../stores/conversation";
import { copyToClip } from "@km/shared-utils";
import {
  isOpenClawConversationId,
  shouldStartOpenClawBlankConversation,
  shouldUseOpenClawRouteType,
} from "../../utils/openclaw";
import { getOpenClawTimelineEventsFromLedgerPayload } from "../../utils/openclaw-ledger";
import { rebaseOpenClawMessageConversation } from "../../utils/openclaw-timeline";
import {
  appendOpenClawEvents,
  createOpenClawTurnState,
  projectOpenClawTurn,
  syncOpenClawProjectionToMessage,
} from "../../utils/openclaw-turn";

export interface ChatViewFeatures {
  history?: boolean;
  newConversation?: boolean;
  languageSwitcher?: boolean;
  fileUpload?: boolean;
  timeout?: number;
  guide?: boolean;
  /** 分享功能 - ShareHeader、消息选择、创建分享链接 */
  share?: boolean;
  /** 智能体切换下拉菜单 */
  agentTooltip?: boolean;
  /** Openclaw 模式 - 隐藏底部操作、使用 FORMAL 会话类型 */
  openclaw?: boolean;
  /** 消息操作菜单 - 复制、重新生成、分享 */
  messageMenu?: boolean;
  /** 跳过初始会话加载 - 进入时显示欢迎页而非自动加载最后一条 */
  skipInitialLoad?: boolean;
  /** 右侧推荐面板 */
  showRecommend?: boolean;
  /** 拖拽上传 */
  enableDragUpload?: boolean;
  /** 多文件选择 */
  allowMultiple?: boolean;
  /** 仅文件发送 */
  allowSendWithFiles?: boolean;
  /** 粘贴上传 */
  enablePasteUpload?: boolean;
  /** 显示相关场景 */
  showRelatedScene?: boolean;
  /** OpenClaw 插件离线时禁用输入 */
  openclawInputDisabled?: boolean;
  /** OpenClaw 插件离线时的输入禁用原因 */
  openclawInputDisabledReason?: string;
  /** OpenClaw 初始绑定会话解析中 */
  initialConversationResolving?: boolean;
  /** 显示欢迎页（开场白、推荐问题） */
  showWelcome?: boolean;
  /** 工作台入口欢迎布局 - 居中显示标题描述和 suggestions */
  indexWelcomeLayout?: boolean;
}

export interface ChatViewProps {
  agentId: string;
  initialConversationId?: string | number;
  features?: ChatViewFeatures;
  syncToUrl?: boolean; // 是否同步 agent_id/conversation_id 到 URL
  agentInfo?: IAgentInfo; // 直接传入 agent 信息，跳过 API 加载
  /** 分享 API 回调 */
  onShare?: (messageIds: (string | number)[], conversationId: string | number, selectAll: boolean) => Promise<string>;
  /** 自定义 Header - 替换默认 ChatHeader */
  renderHeader?: (props: { agentInfo: IAgentInfo; lang: Lang; setLang: (lang: Lang) => void; showGuide?: boolean; onGuideChange?: (show: boolean) => void }) => React.ReactNode;
  /** 输入框前的智能体选择器 */
  renderAgentSelector?: (props: { agentInfo: IAgentInfo; onSelect: (agent: IAgentInfo) => void }) => React.ReactNode;
  /** 欢迎页 AuthTags 渲染函数 */
  renderAuthTags?: (userGroupIds: number[]) => React.ReactNode;

  /** 权限检查回调 - 返回 true 表示有权限，false 表示无权限 */
  checkPermission?: (userGroupIds?: number[]) => boolean | Promise<boolean>;
  /** 版权信息 slot */
  renderCopyright?: () => React.ReactNode;
  /** 推荐智能体列表 */
  recommendAgents?: IAgentInfo[];
  /** 推荐智能体选择回调 */
  onRecommendAgentSelect?: (agent: IAgentInfo) => void;
  /** 下一个智能体回调 - 用于 RelatedScene */
  onNextAgent?: (item: any, parameters: Record<string, string>) => void;
  /** 重新初始化当前智能体回调 - 当跳转到同一智能体时触发 */
  onInitAgent?: () => void;
  /** 自定义上传函数 */
  uploadRequest?: (file: File) => Promise<any>;
  /** 接受的文件类型 */
  acceptTypes?: string;
  /** 最大文件大小（字节） */
  maxFileSize?: number;
  /** 输出文件预览回调 */
  onOutputFilePreview?: (file: OutputFile, message: Message) => void;
  /** 添加回答到知识库回调 */
  onAddAsMd?: (message: Message) => void;
  /** 消息发送完成回调 */
  onMessageSent?: () => void;

  boxClassName?: string
}

export interface ChatViewRef {
  reload: () => void;
  newConversation: () => void;
  openHistory: () => void;
  showShare: () => void;
  sendMessage: (content: string) => void;
  setPrompt: (content: string) => void;
}

const DEFAULT_FEATURES: ChatViewFeatures = {
  history: true,
  newConversation: true,
  languageSwitcher: true,
  fileUpload: false,
  timeout: 0,
  guide: true,
  share: false,
  agentTooltip: false,
  openclaw: false,
  messageMenu: true,
  skipInitialLoad: false,
  showRecommend: false,
  enableDragUpload: false,
  allowMultiple: true,
  allowSendWithFiles: false,
  enablePasteUpload: false,
  showRelatedScene: false,
  showWelcome: true,
  indexWelcomeLayout: false,
};

const OPENCLAW_EVENT_INITIAL_POLL_INTERVAL = 800;
const OPENCLAW_EVENT_FAST_POLL_INTERVAL = 2000;
const OPENCLAW_EVENT_EMPTY_BACKOFF_INTERVALS = [3000, 5000, 10000];
const OPENCLAW_MESSAGE_HISTORY_FETCH_LIMIT = 30;
const OPENCLAW_OPTIMISTIC_RESOLVED_VIRTUAL_ID = "__openclaw_optimistic_resolved__";
const openClawOptimisticResolvedConversationIds = new Set<string>();

function isOpenClawChatViewDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get("openclaw_debug") === "1" ||
      params.get("OPENCLAW_LEDGER_DEBUG") === "1" ||
      window.localStorage?.getItem("OPENCLAW_LEDGER_DEBUG") === "1"
    );
  } catch {
    return false;
  }
}

function traceOpenClawChatView(label: string, payload: Record<string, unknown>) {
  if (!isOpenClawChatViewDebugEnabled()) return;
  console.info(`[openclaw-ui:${label}] ${JSON.stringify(payload)}`);
}

function syncConversationIdToUrl(agentId: string | number, conversationId: string | number, isOpenClawMode = false) {
  const url = new URL(window.location.href);
  url.searchParams.set("agent_id", String(agentId));
  if (hasConversationId(conversationId)) {
    url.searchParams.set("conversation_id", String(conversationId));
  } else {
    url.searchParams.delete("conversation_id");
  }
  if (shouldUseOpenClawRouteType(isOpenClawMode, conversationId)) {
    url.searchParams.set("type", "openclaw");
  } else if (url.searchParams.get("type") === "openclaw") {
    url.searchParams.delete("type");
  }
  window.history.replaceState(null, "", url.toString());
}

function hasConversationId(conversationId?: string | number | null) {
  return Boolean(conversationId) && conversationId !== 0 && conversationId !== "0";
}

function isOptimisticResolvedOpenClawConversation(conversationId?: string | number | null) {
  if (!hasConversationId(conversationId)) return false;
  if (openClawOptimisticResolvedConversationIds.has(String(conversationId))) return true;
  return useConversationStore
    .getState()
    .conversations
    .some((item: any) =>
      String(item?.conversation_id || "") === String(conversationId) &&
      item?.virtual_id === OPENCLAW_OPTIMISTIC_RESOLVED_VIRTUAL_ID
    );
}

function buildOpenClawOptimisticConversationTitle(question: string): string {
  const normalized = question.replace(/\s+/g, " ").trim();
  if (!normalized) return "新对话";
  return normalized.length > 40 ? `${normalized.slice(0, 40)}...` : normalized;
}

function getOpenClawTimelineEvents(payload: any): any[] {
  const events = payload?.events ?? payload?.data?.events;
  if (Array.isArray(events) && events.length) return events;
  return getOpenClawTimelineEventsFromLedgerPayload(payload);
}

function withOpenClawEventsAfterSeq(payload: any, afterSeq: number): any {
  if (!afterSeq) return payload;

  const events = getOpenClawTimelineEvents(payload);
  if (!events.length) return payload;

  const nextEvents = events.filter((event) => {
    const seq = typeof event?.seq === "number" ? event.seq : Number(event?.seq);
    return Number.isFinite(seq) && seq > afterSeq;
  });

  if (payload?.data && Array.isArray(payload.data.events)) {
    return {
      ...payload,
      data: {
        ...payload.data,
        events: nextEvents,
      },
    };
  }

  return {
    ...payload,
    events: nextEvents,
  };
}

function isOpenClawTerminalTimelineEvent(event: any): boolean {
  const kind = String(event?.kind || "");
  if (kind === "run.completed" || kind === "run.failed" || kind === "run.interrupted") {
    return true;
  }
  const ledger = event?.payload?.openclaw_ledger;
  const eventType = ledger && typeof ledger === "object"
    ? String((ledger as Record<string, unknown>).event_type || "")
    : "";
  return eventType === "turn.completed" || eventType === "turn.failed" || eventType === "turn.interrupted";
}

function getOpenClawTerminalEvents(payload: any): any[] {
  return getOpenClawTimelineEvents(payload).filter(isOpenClawTerminalTimelineEvent);
}

function hasOpenClawTerminalEvent(payload: any): boolean {
  return getOpenClawTerminalEvents(payload).length > 0;
}

function getOpenClawTimelineEventsAfterSeq(payload: any, afterSeq: number): any[] {
  return getOpenClawTimelineEvents(payload).filter((event) => {
    const seq = typeof event?.seq === "number" ? event.seq : Number(event?.seq);
    return Number.isFinite(seq) && seq > afterSeq;
  });
}

function readOpenClawTimelineEventSeq(event: any): number {
  const seq = typeof event?.seq === "number" ? event.seq : Number(event?.seq);
  return Number.isFinite(seq) ? seq : 0;
}

function getOpenClawSnapshotActiveTurns(payload: any): any[] {
  const candidates = [
    payload?.active_turns,
    payload?.activeTurns,
    payload?.data?.active_turns,
    payload?.data?.activeTurns,
  ];
  const activeTurns = candidates.find(Array.isArray);
  return Array.isArray(activeTurns) ? activeTurns : [];
}

function getOpenClawLedgerTurnIdFromTimelineEvent(event: any): string {
  const ledger = event?.payload?.openclaw_ledger;
  if (!ledger || typeof ledger !== "object") return "";
  return String((ledger as Record<string, unknown>).turn_id || "");
}

function isOpenClawRunningActiveTurn(turn: any): boolean {
  const status = String(turn?.status || turn?.terminal_status || turn?.terminalStatus || "").toLowerCase();
  return status === "running" || status === "streaming";
}

function getOpenClawSnapshotTurnId(turn: any): string {
  return String(turn?.turn_id || turn?.turnId || "");
}

function getOpenClawSnapshotRunningTurnIds(activeTurns: any[]): Set<string> {
  return new Set(activeTurns.filter(isOpenClawRunningActiveTurn).map(getOpenClawSnapshotTurnId).filter(Boolean));
}

function getOpenClawAuthBlockedReason(err: any): string {
  const status = err?.response?.status ?? err?.status;
  const errorMessage =
    err?.response?.data?.message ||
    err?.response?.data?.error?.message ||
    err?.message ||
    "";
  if (status === 401 || /authentication required|unauthorized|401/i.test(String(errorMessage))) {
    return "登录状态已失效，请刷新页面后重新登录";
  }
  return "";
}

function readOpenClawString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }
  return "";
}

function getOpenClawOptionValue(option: OpenClawInteractionOption) {
  if (option.value !== undefined) return option.value;
  if (option.id !== undefined) return option.id;
  return readOpenClawString(option.label, option.title, option.name);
}

function getOpenClawOptionKey(option: OpenClawInteractionOption, index: number) {
  return readOpenClawString(option.id, option.value, option.label, option.title, option.name, index);
}

function buildOpenClawInteractionControlPayload(
  activity: OpenClawActivityItem,
  option: OpenClawInteractionOption
) {
  const interaction = activity.interaction || {};
  const firstQuestion = activity.questions?.[0] || {};
  const optionValue = getOpenClawOptionValue(option);
  const optionText = readOpenClawString(option.label, option.title, option.name, option.value, option.id);
  const interactionId = readOpenClawString(interaction.id, firstQuestion.id, activity.key);
  const requestId = readOpenClawString(interaction.requestId, firstQuestion.requestId);
  const toolCallId = readOpenClawString(interaction.toolCallId, firstQuestion.toolCallId, activity.tool?.toolCallId);
  const questionId = readOpenClawString(firstQuestion.id, interaction.id);
  const decision = readOpenClawString(option.decision, option.value, option.id, option.label, option.title, option.name);
  const answers = questionId ? { [questionId]: optionValue } : undefined;

  return {
    action: "respond_interruption" as const,
    interaction_id: interactionId,
    request_id: requestId,
    tool_call_id: toolCallId,
    question_id: questionId,
    method: readOpenClawString(interaction.method, firstQuestion.method),
    type: readOpenClawString(interaction.type, firstQuestion.type),
    option_id: readOpenClawString(option.id, option.value),
    option_key: getOpenClawOptionKey(option, 0),
    decision,
    answer: optionValue,
    answer_text: optionText,
    answers,
    interaction,
    question: firstQuestion,
    option,
  };
}

function markOpenClawInteractionResolved(message: Message, activityKey: string): Message {
  const markActivity = (activity: OpenClawActivityItem): OpenClawActivityItem =>
    activity.key === activityKey ? { ...activity, resolved: true, requiresUserInput: false } : activity;
  const markTimelineItem = (item: any) =>
    item.key === activityKey
      ? {
          ...item,
          resolved: true,
          requiresUserInput: false,
          activity: item.activity ? markActivity(item.activity) : item.activity,
        }
      : item;

  return {
    ...message,
    openclawActivities: message.openclawActivities?.map(markActivity),
    openclawTimelineItems: message.openclawTimelineItems?.map(markTimelineItem),
    openclawProjection: message.openclawProjection
      ? {
          ...message.openclawProjection,
          activities: message.openclawProjection.activities.map(markActivity),
          timelineItems: message.openclawProjection.timelineItems.map(markTimelineItem),
        }
      : message.openclawProjection,
  };
}

export const ChatView = forwardRef<ChatViewRef, ChatViewProps>(
  ({
    agentId,
    initialConversationId,
    features: userFeatures,
    syncToUrl = true,
    agentInfo: agentInfoProp,
    onShare,
    renderHeader,
    renderAgentSelector,
    renderAuthTags,
    checkPermission,
    renderCopyright,
    recommendAgents,
    onRecommendAgentSelect,
    onNextAgent,
    onInitAgent,
    uploadRequest,
    acceptTypes,
    maxFileSize,
    onOutputFilePreview,
    onAddAsMd,
    onMessageSent,
    boxClassName = ''
  }, ref) => {
    const features = { ...DEFAULT_FEATURES, ...userFeatures };
    const adapters = usePluginAdapters();
    const pluginConfig = usePluginConfig();
    const { t, lang, setLang } = useTranslation();
    const embedMode = useEmbedMode();

    const [agentInfo, setAgentInfo] = useState<IAgentInfo | null>(agentInfoProp || null);
    // 如果 agentInfoProp 存在但 agent_id 未就绪，也需要等待加载完成。
    const [agentLoading, setAgentLoading] = useState(!agentInfoProp || agentInfoProp?.agent_id === "");
    const [isResolvingConversation, setIsResolvingConversation] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [openClawStreamingConversationId, setOpenClawStreamingConversationId] = useState<string | null>(null);
    const agentMode = agentInfo?.custom_config_obj?.agent_mode;

    const currentConversationId = useConversationStore((state) => state.current_conversationid);
    const loadConversations = useConversationStore((state) => state.loadConversations);
    const createConversation = useConversationStore((state) => state.createConversation);
    const addConversation = useConversationStore((state) => state.addConversation);
    const setCurrentState = useConversationStore((state) => state.setCurrentState);

    const {
      state: { messageList, hasMore, isLoadingMore, isLoadingMessages },
      loadMessageList,
      handleLoadListMore,
      updateMessageList,
      clearMessageList,
    } = useChatMessages({ limit: features.openclaw ? OPENCLAW_MESSAGE_HISTORY_FETCH_LIMIT : 20 });

    const { sendMessage, handleStop, isStreaming, isStopping } = useChatSend(adapters.conversationApi);

    const [inputValue, setInputValue] = useState("");
    const [showGuide, setShowGuide] = useState(false);
    const [openClawInitialMessageLoading, setOpenClawInitialMessageLoading] = useState(false);
    const [openClawStopReconcilePending, setOpenClawStopReconcilePending] = useState(false);
    const [openClawAuthBlockedReason, setOpenClawAuthBlockedReason] = useState("");
    const historyRef = useRef<ChatHistoryRef>(null);
    const sourceRefManagerRef = useRef<SourceReferenceManagerRef>(null);
    const loadedConversationRef = useRef<string | number | null>(null);
    const skipNextLoadRef = useRef(false);
    // 标记是否是初始加载（刷新进入），用于 timeout 计算
    const isInitialLoadRef = useRef(true);
  const hasInitialLoadedRef = useRef(false);
    const messageListRef = useRef<Message[]>([]);
    const skipInitialConversationReloadRef = useRef<string | null>(null);
    const sendBlockedRef = useRef(false);
    const sendTurnRef = useRef(0);
    const openClawEventSeqRef = useRef<Record<string, number>>({});
    const openClawMessagesLoadingRef = useRef<Record<string, boolean>>({});
    const openClawActiveMessageRef = useRef<Record<string, Message>>({});
    const openClawSnapshotRecoveryMergedRef = useRef<Record<string, boolean>>({});
    const openClawStopReconcileConversationIdRef = useRef<string | null>(null);
    const loadMessageListRef = useRef(loadMessageList);
    const mergeOpenClawActiveMessageForConversationRef = useRef<(conversationId: string | number) => void>(() => {});
    const mergeOpenClawPayloadIntoLatestMessageRef = useRef<(conversationId: string | number, payload: any) => boolean>(() => false);
    const updateOpenClawEventSeqFromMessagesRef = useRef<(conversationId: string | number, messages: Message[]) => void>(() => {});
    const openClawStopPending = Boolean(features.openclaw && (isStopping || openClawStopReconcilePending));
    const openClawAuthBlocked = Boolean(features.openclaw && openClawAuthBlockedReason);
    const translatedLoadingMessages = t("chat.loading_messages");
    const conversationLoadingReason =
      translatedLoadingMessages && translatedLoadingMessages !== "chat.loading_messages"
        ? translatedLoadingMessages
        : "加载消息...";
    const isInitialConversationResolving = Boolean(features.openclaw && features.initialConversationResolving);
    const isOpenClawRuntimeUnavailable = Boolean(features.openclaw && features.openclawInputDisabled);
    const isOpenClawConversationPendingLoad = Boolean(
      features.openclaw &&
      !isInitialConversationResolving &&
      !isOpenClawRuntimeUnavailable &&
      hasConversationId(currentConversationId) &&
      loadedConversationRef.current !== currentConversationId &&
      !isOptimisticResolvedOpenClawConversation(currentConversationId)
    );
    const isConversationLoading =
      isInitialConversationResolving ||
      isResolvingConversation ||
      isLoadingMessages ||
      openClawInitialMessageLoading ||
      isOpenClawConversationPendingLoad;
    const visibleIsStreaming = features.openclaw
      ? openClawStopPending || (isStreaming && String(currentConversationId || "") === String(openClawStreamingConversationId || ""))
      : isStreaming;

    // Share mode state
    const [shareMode, setShareMode] = useState(false);
    const [selectMessageIds, setSelectMessageIds] = useState<(string | number)[]>([]);
    const [selectAll, setSelectAll] = useState(false);
    const [shareLoading, setShareLoading] = useState(false);

    // Handle new conversation - define before useChatTimeout
    const handleNewConversation = useCallback(() => {
      setCurrentState(agentId, 0);
      clearMessageList();
      loadedConversationRef.current = null;
      if (syncToUrl) syncConversationIdToUrl(agentId, 0, features.openclaw);
    }, [setCurrentState, agentId, clearMessageList, syncToUrl, features.openclaw]);

    // Openclaw 模式禁用 timeout（没有新建会话和历史功能）
    const timeoutEnabled = features.timeout ? features.timeout > 0 && !features.openclaw : false;

    const { setLastMessageTime, resetTimer } = useChatTimeout({
      timeout: features.timeout || 0,
      enabled: timeoutEnabled,
      onTimeout: () => {
        Modal.warning({
          title: t("chat.timeout_title"),
          content: t("chat.timeout_message"),
          okText: t("chat.timeout_ok"),
          onOk: handleNewConversation,
        });
      },
    });

    // Initialize conversation API
    useEffect(() => {
      setConversationApi(adapters.conversationApi);
    }, [adapters.conversationApi]);

    // Cleanup store on unmount
    useEffect(() => {
      return () => {
        // 清空会话状态
        useConversationStore.setState({
          conversations: [],
          current_agentid: 0,
          current_conversationid: 0,
          currentVirtualId: "",
        });
      };
    }, []);

    useEffect(() => {
      loadedConversationRef.current = null;
    }, [adapters.conversationApi, features.openclaw]);

    // 切换智能体时重置初始加载状态
    useEffect(() => {
      setIsInitialLoading(true);
      hasInitialLoadedRef.current = false;
    }, [agentId]);

    useEffect(() => {
      messageListRef.current = messageList as Message[];
    }, [messageList]);

    useEffect(() => {
      sendBlockedRef.current = isStreaming || openClawStopPending || isConversationLoading || openClawAuthBlocked;
    }, [isStreaming, openClawStopPending, isConversationLoading, openClawAuthBlocked]);

    const canMergeOpenClawActiveSnapshots = useCallback((previous: Message, next: Message) => {
      const previousClientId = String(previous._openclawClientMessageId || "");
      const nextClientId = String(next._openclawClientMessageId || "");
      if (previousClientId && nextClientId) return previousClientId === nextClientId;

      const previousTurnKey = String(previous.openclawTurn?.turnKey || "");
      const nextTurnKey = String(next.openclawTurn?.turnKey || "");
      if (previousTurnKey && nextTurnKey) return previousTurnKey === nextTurnKey;

      if (previousClientId || nextClientId || previousTurnKey || nextTurnKey) return false;

      const previousId = String(previous.id || "");
      const nextId = String(next.id || "");
      if (previousId && nextId) return previousId === nextId;

      return false;
    }, []);

    const cacheOpenClawActiveMessage = useCallback(
      (message?: Message | null, fallbackConversationId?: string | number) => {
        if (!features.openclaw || !message) return undefined;
        const conversationId = String(message.conversation_id || fallbackConversationId || "");
        if (!hasConversationId(conversationId)) return undefined;
        if (message.interrupted && !message.loading) {
          delete openClawActiveMessageRef.current[conversationId];
          return undefined;
        }

        const snapshot: Message = {
          ...message,
          conversation_id: conversationId,
          openclawActivities: message.openclawActivities ? [...message.openclawActivities] : undefined,
          openclawTimelineItems: message.openclawTimelineItems ? [...message.openclawTimelineItems] : undefined,
          process_records: message.process_records ? [...message.process_records] : undefined,
          skillRunItems: message.skillRunItems ? [...message.skillRunItems] : undefined,
        };

        const previous = openClawActiveMessageRef.current[conversationId];
        const nextSnapshot = previous && canMergeOpenClawActiveSnapshots(previous, snapshot)
          ? {
              ...previous,
              ...snapshot,
              openclawTurn:
                previous.openclawTurn && snapshot.openclawTurn
                  ? appendOpenClawEvents(previous.openclawTurn, snapshot.openclawTurn.events || [])
                  : snapshot.openclawTurn || previous.openclawTurn,
            }
          : snapshot;

        if (nextSnapshot.openclawTurn) {
          syncOpenClawProjectionToMessage(
            nextSnapshot,
            projectOpenClawTurn(nextSnapshot.openclawTurn, {
              isStreaming: Boolean(nextSnapshot.loading),
              canonicalOnly: true,
            })
          );
        }

        openClawActiveMessageRef.current[conversationId] = nextSnapshot;
        return nextSnapshot;
      },
      [canMergeOpenClawActiveSnapshots, features.openclaw]
    );

    const mergeOpenClawActiveMessageForConversation = useCallback(
      (conversationId: string | number) => {
        if (!features.openclaw || !hasConversationId(conversationId)) return;
        const activeMessage = openClawActiveMessageRef.current[String(conversationId)];
        if (!activeMessage) return;

        updateMessageList((list) => {
          const next = mergeOpenClawActiveMessageIntoList(list, activeMessage, conversationId);
          messageListRef.current = next as Message[];
          return next;
        });
      },
      [features.openclaw, updateMessageList]
    );

    const updateOpenClawEventSeqFromMessages = useCallback(
      (conversationId: string | number, messages: Message[]) => {
        if (!features.openclaw || !hasConversationId(conversationId) || !Array.isArray(messages)) return;
        const targetConversationId = String(conversationId);
        const messageSeq = getOpenClawMessageListMaxActivitySeq(messages, targetConversationId);
        openClawEventSeqRef.current[targetConversationId] = Math.max(
          openClawEventSeqRef.current[targetConversationId] || 0,
          messageSeq
        );
      },
      [features.openclaw]
    );

    const mergeOpenClawPayloadIntoLatestMessage = useCallback(
      (conversationId: string | number, payload: any) => {
        if (!features.openclaw || !hasConversationId(conversationId)) return false;
        const targetConversationId = String(conversationId);
        const events = getOpenClawTimelineEvents(payload);
        if (!events.length) return false;

        let merged = false;
        updateMessageList((list) => {
          if (String(useConversationStore.getState().current_conversationid || "") !== targetConversationId) {
            return list;
          }
          const targetIndex = [...list]
            .reverse()
            .findIndex((item) => String(item.conversation_id || "") === targetConversationId);
          if (targetIndex < 0) return list;

          const index = list.length - 1 - targetIndex;
          const next = [...list];
          const target = { ...next[index] } as Message;
          const changed = mergeOpenClawTimelineEventsIntoMessage(target, payload, { canonicalOnly: true });
          if (!changed) return list;

          next[index] = target;
          cacheOpenClawActiveMessage(target, targetConversationId);
          messageListRef.current = next as Message[];
          merged = true;
          return next;
        });
        return merged;
      },
      [cacheOpenClawActiveMessage, features.openclaw, updateMessageList]
    );

    const mergeOpenClawActiveTurnsFromSnapshot = useCallback(
      (conversationId: string | number, payload: any) => {
        if (!features.openclaw || !hasConversationId(conversationId)) return false;
        const targetConversationId = String(conversationId);
        const snapshotActiveTurns = getOpenClawSnapshotActiveTurns(payload);
        const runningActiveTurns = snapshotActiveTurns.filter(isOpenClawRunningActiveTurn);
        const activeTurn = runningActiveTurns
          .sort((left, right) => Number(right?.last_seq || 0) - Number(left?.last_seq || 0))[0];
        const activeTurnId = String(activeTurn?.turn_id || activeTurn?.turnId || "");
        traceOpenClawChatView("snapshot.active-turn.inspect", {
          conversationId: targetConversationId,
          activeTurnCount: snapshotActiveTurns.length,
          runningActiveTurnCount: runningActiveTurns.length,
          activeTurnId,
          activeTurnStatus: activeTurn ? String(activeTurn?.status || activeTurn?.terminal_status || activeTurn?.terminalStatus || "") : "",
          lastSeq: Number(activeTurn?.last_seq || 0) || 0,
        });
        if (!activeTurn || !activeTurnId) return false;

        const activeRequestId = String(activeTurn.active_request_id || activeTurn.activeRequestId || activeTurnId);
        const turnEvents = getOpenClawTimelineEvents(payload).filter((event) => {
          const eventTurnId = getOpenClawLedgerTurnIdFromTimelineEvent(event);
          return eventTurnId === activeTurnId;
        });

        let merged = false;
        updateMessageList((list) => {
          if (String(useConversationStore.getState().current_conversationid || "") !== targetConversationId) {
            traceOpenClawChatView("snapshot.active-turn.skip-current", {
              conversationId: targetConversationId,
              currentConversationId: String(useConversationStore.getState().current_conversationid || ""),
              activeTurnId,
            });
            return list;
          }
          const targetIndex = [...list]
            .reverse()
            .findIndex((item) => String(item.conversation_id || "") === targetConversationId);
          if (targetIndex < 0) {
            traceOpenClawChatView("snapshot.active-turn.no-target", {
              conversationId: targetConversationId,
              activeTurnId,
              messageCount: list.length,
            });
            return list;
          }

          const index = list.length - 1 - targetIndex;
          const next = [...list];
          const target = { ...next[index] } as Message;
          const targetIdentity = String(
            target._openclawActiveRequestId ||
              target._openclawClientMessageId ||
              ""
          );
          if (targetIdentity && activeRequestId && targetIdentity !== activeRequestId && !activeTurnId.includes(targetIdentity)) {
            traceOpenClawChatView("snapshot.active-turn.identity-mismatch", {
              conversationId: targetConversationId,
              activeTurnId,
              activeRequestId,
              targetIdentity,
            });
            return list;
          }
          target.loading = true;
          target.error = false;
          target.interrupted = false;
          target._openclawActiveRequestId = activeRequestId;
          target._openclawClientMessageId = target._openclawClientMessageId || activeRequestId;
          const targetTurnKey = String(target.openclawTurn?.turnKey || "");
          const shouldBindSnapshotTurn =
            !target.openclawTurn ||
            (targetTurnKey && targetTurnKey !== activeTurnId && !activeTurnId.includes(targetTurnKey));
          target.openclawTurn = shouldBindSnapshotTurn
            ? createOpenClawTurnState({
                sessionId: targetConversationId,
                turnKey: activeTurnId,
                status: "streaming",
              })
            : target.openclawTurn;
          target.openclawTurn = {
            ...target.openclawTurn,
            status: "streaming",
          };

          if (turnEvents.length) {
            mergeOpenClawTimelineEventsIntoMessage(target, { events: turnEvents }, { canonicalOnly: true });
          } else {
            syncOpenClawProjectionToMessage(
              target,
              projectOpenClawTurn(target.openclawTurn, { isStreaming: true, canonicalOnly: true })
            );
          }
          target.loading = true;

          next[index] = target;
          cacheOpenClawActiveMessage(target, targetConversationId);
          messageListRef.current = next as Message[];
          merged = true;
          traceOpenClawChatView("snapshot.active-turn.merged", {
            conversationId: targetConversationId,
            activeTurnId,
            activeRequestId,
            turnEventCount: turnEvents.length,
            targetMessageId: String(target.id || ""),
            previousTurnKey: targetTurnKey,
            reboundTurn: shouldBindSnapshotTurn,
            targetLoading: Boolean(target.loading),
          });
          return next;
        });
        return merged;
      },
      [cacheOpenClawActiveMessage, features.openclaw, updateMessageList]
    );

    useEffect(() => {
      loadMessageListRef.current = loadMessageList;
      mergeOpenClawActiveMessageForConversationRef.current = mergeOpenClawActiveMessageForConversation;
      mergeOpenClawPayloadIntoLatestMessageRef.current = mergeOpenClawPayloadIntoLatestMessage;
      updateOpenClawEventSeqFromMessagesRef.current = updateOpenClawEventSeqFromMessages;
    }, [
      loadMessageList,
      mergeOpenClawActiveMessageForConversation,
      mergeOpenClawPayloadIntoLatestMessage,
      updateOpenClawEventSeqFromMessages,
    ]);

    // Notify parent when ready (embed mode) - use embedMode.notifyReady()
    useEffect(() => {
      embedMode.notifyReady();
    }, [embedMode]);

    // Load agent info
    useEffect(() => {
      // If agentInfo is provided via prop, use it directly
      if (agentInfoProp) {
        setAgentInfo(agentInfoProp);
        if (agentInfoProp.agent_id !== undefined) {
          setAgentLoading(false);
        }
        return;
      }

      if (!agentId) {
        setAgentLoading(false);
        return;
      }

      setAgentLoading(true);
      adapters.agentApi
        .detail(agentId)
        .then((agent: IAgentInfo) => {
          if (features.openclaw) {
            setOpenClawAuthBlockedReason("");
          }
          setAgentInfo(agent);
        })
        .catch((err) => {
          console.error("Failed to load agent:", err);
          if (features.openclaw) {
            const reason = getOpenClawAuthBlockedReason(err);
            if (reason) setOpenClawAuthBlockedReason(reason);
          }
          setAgentInfo(null);
        })
        .finally(() => {
          setAgentLoading(false);
        });
    }, [agentId, agentInfoProp, adapters.agentApi, features.openclaw]);

    // Initialize conversation when agent loaded
    useEffect(() => {
      if (isInitialConversationResolving) return;
      if (!agentId || agentLoading) return;
      if (isOpenClawRuntimeUnavailable) {
        clearMessageList();
        loadedConversationRef.current = null;
        setOpenClawInitialMessageLoading(false);
        setCurrentState(agentId, 0);
        if (syncToUrl) syncConversationIdToUrl(agentId, 0, true);
        return;
      }
      if (
        features.openclaw &&
        hasConversationId(initialConversationId) &&
        (
          skipInitialConversationReloadRef.current === String(initialConversationId) ||
          isOptimisticResolvedOpenClawConversation(initialConversationId)
        )
      ) {
        skipInitialConversationReloadRef.current = null;
        return;
      }
      let cancelled = false;

      // Completion 模式不需要加载会话和消息
      if (agentMode === "completion") {
        if (!hasInitialLoadedRef.current) {
          hasInitialLoadedRef.current = true;
          setIsInitialLoading(false);
        }
        return;
      }

      const initConversation = async () => {
        setIsResolvingConversation(true);
        try {
          // 先清空旧状态（包括 current_conversationid，防止触发旧会话的消息加载）
          if (!features.openclaw) {
            useConversationStore.setState({ conversations: [], current_conversationid: 0 });
          }
          if (!features.openclaw || hasConversationId(initialConversationId)) {
            clearMessageList();
          }
          loadedConversationRef.current = null;

          if (initialConversationId) {
            setCurrentState(agentId, initialConversationId);
            await loadConversations(agentId);
          } else if (shouldStartOpenClawBlankConversation({ openclaw: features.openclaw, initialConversationId })) {
            setCurrentState(agentId, 0);
            if (syncToUrl) syncConversationIdToUrl(agentId, 0, true);
            await loadConversations(agentId);
          } else if (features.skipInitialLoad) {
            // skipInitialLoad: 直接设置为空会话，显示欢迎页
            setCurrentState(agentId, 0);
            if (syncToUrl) syncConversationIdToUrl(agentId, 0, features.openclaw);
            // 但仍然加载会话列表，用于历史面板
            await loadConversations(agentId);
          } else {
            const conversations = await loadConversations(agentId);
            if (cancelled) return;
            if (conversations.length > 0) {
              const latestConversationId = conversations[0].conversation_id;
              setCurrentState(agentId, latestConversationId);
              if (syncToUrl) syncConversationIdToUrl(agentId, latestConversationId, features.openclaw);
            } else {
              setCurrentState(agentId, 0);
            }
          }
          if (features.openclaw) {
            setOpenClawAuthBlockedReason("");
          }
        } catch (err) {
          if (!cancelled) {
            console.error("Failed to load conversations:", err);
            if (features.openclaw) {
              const reason = getOpenClawAuthBlockedReason(err);
              if (reason) setOpenClawAuthBlockedReason(reason);
              setCurrentState(agentId, hasConversationId(initialConversationId) ? initialConversationId! : 0);
            } else {
              setCurrentState(agentId, 0);
            }
          }
        } finally {
          if (!cancelled) {
            setIsResolvingConversation(false);
            // 如果没有会话需要加载消息，结束初始加载状态
            const finalConversationId = useConversationStore.getState().current_conversationid;
            if (!hasConversationId(finalConversationId) && !hasInitialLoadedRef.current) {
              hasInitialLoadedRef.current = true;
              setIsInitialLoading(false);
            }
          }
        }
      };

      initConversation();
      return () => {
        cancelled = true;
      };
    }, [agentId, agentLoading, agentMode, initialConversationId, setCurrentState, loadConversations, clearMessageList, features.skipInitialLoad, features.openclaw, isInitialConversationResolving, isOpenClawRuntimeUnavailable, syncToUrl]);

    // Load messages when conversation changes
    useEffect(() => {
      if (isInitialConversationResolving) return;
      if (isOpenClawRuntimeUnavailable) {
        if (!hasInitialLoadedRef.current) {
          hasInitialLoadedRef.current = true;
          setIsInitialLoading(false);
        }
        return;
      }
      // Completion 模式不需要加载消息
      if (agentMode === "completion") return;

      // 直接从 store 获取最新值，避免闭包问题
      const latestConversationId = useConversationStore.getState().current_conversationid;

      if (!hasConversationId(latestConversationId)) {
        loadedConversationRef.current = null;
        if (features.openclaw) {
          setOpenClawInitialMessageLoading(false);
        }
        // 注意：此处不设置 isInitialLoading = false
        // 因为会话初始化可能还没完成，由会话初始化 effect 的 finally 处理
        if (syncToUrl) syncConversationIdToUrl(agentId, 0, features.openclaw);
        return;
      }

      if (skipNextLoadRef.current) {
        skipNextLoadRef.current = false;
        return;
      }

      if (isStreaming && !features.openclaw) return;

      if (isOpenClawConversationId(latestConversationId) && !features.openclaw) {
        return;
      }

      if (features.openclaw && isOptimisticResolvedOpenClawConversation(latestConversationId)) {
        loadedConversationRef.current = latestConversationId;
        setOpenClawInitialMessageLoading(false);
        if (String(initialConversationId || "") === String(latestConversationId)) {
          openClawOptimisticResolvedConversationIds.delete(String(latestConversationId));
          useConversationStore.setState((state) => ({
            conversations: state.conversations.map((item: any) =>
              String(item?.conversation_id || "") === String(latestConversationId)
                ? { ...item, virtual_id: "" }
                : item
            ),
          }));
        }
        return;
      }

      if (loadedConversationRef.current === latestConversationId) return;
      loadedConversationRef.current = latestConversationId;

      if (syncToUrl) syncConversationIdToUrl(agentId, latestConversationId, features.openclaw);

      const conversationId = String(latestConversationId);
      openClawMessagesLoadingRef.current[conversationId] = true;
      if (features.openclaw) {
        setOpenClawInitialMessageLoading(true);
      }

      loadMessageList(conversationId, (id, params) =>
        adapters.conversationApi.messages(id, params)
      ).then((list: any[]) => {
        if (features.openclaw) {
          setOpenClawAuthBlockedReason("");
        }
        updateOpenClawEventSeqFromMessages(conversationId, list as Message[]);
        mergeOpenClawActiveMessageForConversation(latestConversationId);
        // 初始加载（刷新进入）：用历史消息最后一条时间检查是否超时
        // 切换历史会话：不计时
        if (isInitialLoadRef.current && list && list.length > 0) {
          const lastMessage = list[list.length - 1];
          setLastMessageTime(lastMessage.updated_time);
        }
        // 标记已完成初始加载
        isInitialLoadRef.current = false;
      }).catch((err: any) => {
        if (features.openclaw) {
          const reason = getOpenClawAuthBlockedReason(err);
          if (reason) setOpenClawAuthBlockedReason(reason);
        }
        console.error("Failed to load messages:", err);
      }).finally(() => {
        delete openClawMessagesLoadingRef.current[conversationId];
        if (features.openclaw) {
          setOpenClawInitialMessageLoading(false);
        }
        if (!hasInitialLoadedRef.current) {
          hasInitialLoadedRef.current = true;
          setIsInitialLoading(false);
        }
      });
    }, [currentConversationId, loadMessageList, adapters.conversationApi, agentId, agentMode, setLastMessageTime, isStreaming, syncToUrl, features.openclaw, isInitialConversationResolving, isOpenClawRuntimeUnavailable, mergeOpenClawActiveMessageForConversation, updateOpenClawEventSeqFromMessages]);

    useEffect(() => {
      if (
        isInitialConversationResolving ||
        isOpenClawRuntimeUnavailable ||
        !features.openclaw ||
        (!adapters.conversationApi.events && !adapters.conversationApi.snapshot) ||
        !hasConversationId(currentConversationId)
      ) {
        return;
      }

      const conversationId = String(currentConversationId);
      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let inFlight = false;
      let emptyPollCount = 0;

      const nextBackoffDelay = () => {
        const index = Math.min(emptyPollCount, OPENCLAW_EVENT_EMPTY_BACKOFF_INTERVALS.length - 1);
        emptyPollCount += 1;
        return OPENCLAW_EVENT_EMPTY_BACKOFF_INTERVALS[index];
      };

      const resetFastDelay = () => {
        emptyPollCount = 0;
        return OPENCLAW_EVENT_FAST_POLL_INTERVAL;
      };

      updateOpenClawEventSeqFromMessagesRef.current(conversationId, messageListRef.current);
      traceOpenClawChatView("snapshot.poll.start", {
        conversationId,
        afterSeq: openClawEventSeqRef.current[conversationId] || 0,
        messageCount: messageListRef.current.length,
      });

      const poll = async () => {
        if (stopped || inFlight) return;
        inFlight = true;
        let nextDelay = OPENCLAW_EVENT_FAST_POLL_INTERVAL;
        let shouldContinue = true;
        let afterSeqForTrace = openClawEventSeqRef.current[conversationId] || 0;
        try {
          if (openClawMessagesLoadingRef.current[conversationId]) {
            traceOpenClawChatView("snapshot.poll.defer-message-load", {
              conversationId,
              nextDelay,
            });
            return;
          }
          const afterSeq = openClawEventSeqRef.current[conversationId] || 0;
          afterSeqForTrace = afterSeq;
          const response = adapters.conversationApi.snapshot
            ? await adapters.conversationApi.snapshot(conversationId, {
                ...(afterSeq > 0 ? { after_seq: afterSeq } : {}),
              })
            : await adapters.conversationApi.events?.(conversationId, {
                limit: 100,
                ...(afterSeq > 0 ? { after_seq: afterSeq } : {}),
              });
          if (stopped || !response) return;

          const rawPayload = response?.data ?? response;
          const payload = adapters.conversationApi.snapshot
            ? rawPayload
            : withOpenClawEventsAfterSeq(rawPayload, afterSeq);
          const events = getOpenClawTimelineEvents(payload);
          const newEvents = getOpenClawTimelineEventsAfterSeq(payload, afterSeq);
          const nextSeq = getOpenClawTimelineMaxSeq(payload);
          const hasEvents = events.length > 0;
          const hasNewEvents = newEvents.length > 0 && nextSeq > afterSeq;
          const snapshotActiveTurns = getOpenClawSnapshotActiveTurns(rawPayload);
          const runningActiveTurns = snapshotActiveTurns.filter(isOpenClawRunningActiveTurn);
          const runningActiveTurnCount = runningActiveTurns.length;
          const runningActiveTurnIds = getOpenClawSnapshotRunningTurnIds(snapshotActiveTurns);
          const runningActiveLastSeqMax = runningActiveTurns.reduce(
            (max, turn) => Math.max(max, Number(turn?.last_seq || turn?.lastSeq || 0) || 0),
            0
          );
          const terminalEvents = getOpenClawTerminalEvents({ events: newEvents });
          const terminalEventTurnIds = terminalEvents
            .map(getOpenClawLedgerTurnIdFromTimelineEvent)
            .filter(Boolean);
          const hasTerminalEvent = terminalEvents.length > 0;
          const hasTerminalForRunningActiveTurn =
            runningActiveTurnIds.size > 0 &&
            terminalEventTurnIds.some((turnId) => runningActiveTurnIds.has(turnId));
          const hasUnscopedTerminalAtOrAfterRunningTurn =
            runningActiveTurnCount > 0 &&
            terminalEvents.some((event) => {
              if (getOpenClawLedgerTurnIdFromTimelineEvent(event)) return false;
              return readOpenClawTimelineEventSeq(event) >= runningActiveLastSeqMax;
            });
          const shouldStopForTerminal =
            hasTerminalEvent &&
            (runningActiveTurnCount === 0 || hasTerminalForRunningActiveTurn || hasUnscopedTerminalAtOrAfterRunningTurn);
          const restoredActiveTurn = adapters.conversationApi.snapshot && runningActiveTurnCount > 0 && !shouldStopForTerminal
            ? mergeOpenClawActiveTurnsFromSnapshot(conversationId, rawPayload)
            : false;
          if (hasEvents) {
            nextDelay = hasNewEvents ? resetFastDelay() : nextBackoffDelay();
            openClawEventSeqRef.current[conversationId] = Math.max(
              openClawEventSeqRef.current[conversationId] || 0,
              nextSeq
            );
            const shouldMergeRecoveryWindow =
              hasNewEvents || !openClawSnapshotRecoveryMergedRef.current[conversationId];
            if (shouldMergeRecoveryWindow) {
              const merged = mergeOpenClawPayloadIntoLatestMessageRef.current(conversationId, payload);
              if (merged || !hasNewEvents) {
                openClawSnapshotRecoveryMergedRef.current[conversationId] = true;
              }
            }
          } else {
            nextDelay = nextBackoffDelay();
          }
          if (restoredActiveTurn) {
            nextDelay = resetFastDelay();
          }

          traceOpenClawChatView("snapshot.poll.result", {
            conversationId,
            afterSeq,
            eventCount: events.length,
            newEventCount: newEvents.length,
            nextSeq,
            activeTurnCount: snapshotActiveTurns.length,
            runningActiveTurnCount,
            runningActiveTurnIds: [...runningActiveTurnIds],
            runningActiveLastSeqMax,
            terminalEventCount: terminalEvents.length,
            terminalEventTurnIds,
            hasTerminalForRunningActiveTurn,
            hasUnscopedTerminalAtOrAfterRunningTurn,
            shouldStopForTerminal,
            restoredActiveTurn,
            hasTerminalEvent,
            hasEvents,
            hasNewEvents,
            nextDelay,
          });

          if (
            shouldStopForTerminal &&
            String(useConversationStore.getState().current_conversationid || "") === conversationId
          ) {
            traceOpenClawChatView("snapshot.poll.terminal-refresh", {
              conversationId,
              newEventCount: newEvents.length,
              nextSeq,
            });
            const loaded = await loadMessageListRef.current(String(conversationId), (id, params) =>
              adapters.conversationApi.messages(id, params)
            );
            if (Array.isArray(loaded)) {
              updateOpenClawEventSeqFromMessagesRef.current(conversationId, loaded as Message[]);
              if (loaded.length > 0) {
                delete openClawActiveMessageRef.current[conversationId];
              } else {
                mergeOpenClawPayloadIntoLatestMessageRef.current(conversationId, payload);
                mergeOpenClawActiveMessageForConversationRef.current(conversationId);
              }
            } else {
              mergeOpenClawPayloadIntoLatestMessageRef.current(conversationId, payload);
              mergeOpenClawActiveMessageForConversationRef.current(conversationId);
            }
            shouldContinue = false;
          }
        } catch (err: any) {
          // OpenClaw 运行态同步是展示增强；失败时不影响主聊天流程。
          traceOpenClawChatView("snapshot.poll.error", {
            conversationId,
            afterSeq: afterSeqForTrace,
            message: String(err?.message || err || ""),
          });
          nextDelay = nextBackoffDelay();
        } finally {
          inFlight = false;
          if (!stopped && shouldContinue) {
            traceOpenClawChatView("snapshot.poll.schedule", {
              conversationId,
              nextDelay,
              stopped,
              shouldContinue,
            });
            timer = setTimeout(poll, nextDelay);
          } else {
            traceOpenClawChatView("snapshot.poll.stop", {
              conversationId,
              stopped,
              shouldContinue,
            });
          }
        }
      };

      traceOpenClawChatView("snapshot.poll.schedule", {
        conversationId,
        nextDelay: OPENCLAW_EVENT_INITIAL_POLL_INTERVAL,
        stopped,
        shouldContinue: true,
      });
      timer = setTimeout(poll, OPENCLAW_EVENT_INITIAL_POLL_INTERVAL);

      return () => {
        stopped = true;
        if (timer) {
          clearTimeout(timer);
        }
        traceOpenClawChatView("snapshot.poll.cleanup", {
          conversationId,
        });
      };
    }, [adapters.conversationApi, currentConversationId, features.openclaw, isInitialConversationResolving, isOpenClawRuntimeUnavailable, mergeOpenClawActiveTurnsFromSnapshot]);

    // Reset timer on new conversation
    useEffect(() => {
      resetTimer();
    }, [currentConversationId, resetTimer]);

    // Format files for API
    const formatFiles = useCallback(
      (files: any[]) =>
        files?.map((item) => ({
          id: item.id,
          type: "image" as const,
          content: `file_id:${item.id}`,
          filename: item.name,
          size: item.size,
          mime_type: item.mime_type,
          url: item.url,
        })) || [],
      []
    );

    // Handle send message
    const handleSend = useCallback(
      async (data: SendData | string, userFiles: any[] = []) => {
        const question = typeof data === "string" ? data : data.textContent || data.pureTextContent || "";
        const files = typeof data === "string" ? userFiles : data.files || userFiles;

        if (features.openclaw && features.openclawInputDisabled) return;
        if (!question.trim() || sendBlockedRef.current || openClawStopPending || isConversationLoading || openClawAuthBlocked || !agentId) return;

        // 权限检查
        if (checkPermission) {
          const hasPermission = await checkPermission(agentInfo?.user_group_ids);
          if (!hasPermission) {
            return;
          }
        }

        const sendTurn = ++sendTurnRef.current;
        sendBlockedRef.current = true;
        setInputValue("");

        let conversationId = features.openclaw
          ? useConversationStore.getState().current_conversationid
          : currentConversationId;
        // 安全解析 configs
        let configs: Record<string, any> = {};
        try {
          const configsRaw = agentInfo?.configs || "{}";
          configs = typeof configsRaw === "string" ? JSON.parse(configsRaw) : configsRaw;
        } catch {
          console.warn("Failed to parse agent configs");
        }
        const completionParams = configs.completion_params || {};

        if (!hasConversationId(conversationId)) {
          if (features.openclaw) {
            conversationId = "";
          } else {
            try {
              const conversation = await createConversation(agentId, question);
              addConversation({
                ...conversation,
                virtual_id: Date.now().toString(),
              } as any);
              skipNextLoadRef.current = true;
              setCurrentState(agentId, conversation.conversation_id);
              conversationId = conversation.conversation_id;
            } catch (err) {
              console.error("Failed to create conversation:", err);
              return;
            }
          }
        } else if (features.openclaw && syncToUrl) {
          syncConversationIdToUrl(agentId, conversationId, true);
        }

        const baselineMessageList = messageListRef.current;
        const requestConversationId = String(conversationId || "");
        const turnStartSeq = features.openclaw
          ? Math.max(
              openClawEventSeqRef.current[requestConversationId] || 0,
              getOpenClawMessageListMaxActivitySeq(baselineMessageList, requestConversationId)
            )
          : 0;
        let activeOpenClawConversationId = requestConversationId;
        if (features.openclaw && hasConversationId(requestConversationId)) {
          delete openClawActiveMessageRef.current[requestConversationId];
        }
        const getVisibleConversationId = () =>
          String(useConversationStore.getState().current_conversationid || "");
        const shouldUpdateVisibleConversation = () => {
          if (!features.openclaw) return true;
          const visibleConversationId = getVisibleConversationId();
          if (!activeOpenClawConversationId && !visibleConversationId) return true;
          return visibleConversationId === activeOpenClawConversationId;
        };
        let resolvedOpenClawConversationId = "";
        const openclawConversationTitle = features.openclaw
          ? useConversationStore
              .getState()
              .conversations.find((item) => String(item.conversation_id) === requestConversationId)
              ?.title
          : undefined;
        if (features.openclaw) {
          setOpenClawStreamingConversationId(requestConversationId);
        }

        try {
          await sendMessage({
            question,
            agent_id: agentId,
            conversation_id: features.openclaw ? conversationId || "" : conversationId || 0,
            messageList: baselineMessageList,
            openclawStartSeq: turnStartSeq,
            openclawConversationTitle,
            completion_params: completionParams,
            files: formatFiles(files),
            agentInfo,
            minimalParams: true,
            openclaw: features.openclaw,
            type: "agent",
            onMessageListChange: (updater, updatedMessage) => {
              const cachedOpenClawMessage = cacheOpenClawActiveMessage(
                updatedMessage,
                activeOpenClawConversationId || requestConversationId
              );
              if (!shouldUpdateVisibleConversation()) return;
              updateMessageList((list) => {
                const updated = updater(list);
                const next = features.openclaw
                  ? mergeOpenClawActiveMessageIntoList(
                      updated,
                      cachedOpenClawMessage || openClawActiveMessageRef.current[activeOpenClawConversationId],
                      activeOpenClawConversationId || requestConversationId
                    )
                  : updated;
                messageListRef.current = next as Message[];
                return next;
              });
            },
            onOpenClawConversationResolved: (resolvedConversationId) => {
              if (!features.openclaw || !hasConversationId(resolvedConversationId)) return;
              resolvedOpenClawConversationId = resolvedConversationId;
              activeOpenClawConversationId = resolvedConversationId;
              openClawOptimisticResolvedConversationIds.add(String(resolvedConversationId));
              setOpenClawStreamingConversationId(resolvedConversationId);
              const pendingSnapshot = openClawActiveMessageRef.current[requestConversationId];
              if (pendingSnapshot && requestConversationId !== resolvedConversationId) {
                delete openClawActiveMessageRef.current[requestConversationId];
                cacheOpenClawActiveMessage(
                  rebaseOpenClawMessageConversation(
                    pendingSnapshot as Message & { _openclawLastAnswerItemKey?: string },
                    resolvedConversationId,
                    requestConversationId
                  ),
                  resolvedConversationId
                );
              }
              openClawEventSeqRef.current[resolvedConversationId] = Math.max(
                openClawEventSeqRef.current[resolvedConversationId] || 0,
                turnStartSeq
              );
              const numericAgentId = Number(agentId);
              addConversation({
                conversation_id: resolvedConversationId,
                ...(Number.isFinite(numericAgentId) ? { agent_id: numericAgentId } : {}),
                virtual_id: OPENCLAW_OPTIMISTIC_RESOLVED_VIRTUAL_ID,
                title: buildOpenClawOptimisticConversationTitle(question),
                created_time: Date.now(),
                updated_time: Date.now(),
                top: 0,
                is_valid: 1,
              } as any);
              const visibleConversationId = getVisibleConversationId();
              const stillShowingStartedConversation =
                (!visibleConversationId && !requestConversationId) ||
                visibleConversationId === requestConversationId;
              if (!stillShowingStartedConversation) return;

              if (!hasConversationId(requestConversationId)) {
                skipInitialConversationReloadRef.current = resolvedConversationId;
              }
              skipNextLoadRef.current = true;
              loadedConversationRef.current = resolvedConversationId;
              setCurrentState(agentId, resolvedConversationId);
              if (syncToUrl) syncConversationIdToUrl(agentId, resolvedConversationId, true);
              updateMessageList((list) => {
                const next = list.map((item) =>
                  String(item.conversation_id || "") === requestConversationId
                    ? rebaseOpenClawMessageConversation(
                        item as Message & { _openclawLastAnswerItemKey?: string },
                        resolvedConversationId,
                        requestConversationId
                      )
                    : item
                );
                messageListRef.current = next as Message[];
                return next;
              });
            },
            onOpenClawEventSeqChange: (conversationId, seq) => {
              if (!features.openclaw || !hasConversationId(conversationId)) return;
              openClawEventSeqRef.current[conversationId] = Math.max(
                openClawEventSeqRef.current[conversationId] || 0,
                seq
              );
            },
          });
        } finally {
          if (sendTurnRef.current === sendTurn) {
            sendBlockedRef.current = false;
          }
          if (features.openclaw && sendTurnRef.current === sendTurn) {
            setOpenClawStreamingConversationId(null);
          }
        }

        if (features.openclaw && resolvedOpenClawConversationId) {
          loadConversations(agentId);
        }

        setLastMessageTime(Date.now());
        onMessageSent?.();
      },
      [
        sendMessage,
        agentId,
        currentConversationId,
        agentInfo,
        updateMessageList,
        createConversation,
        addConversation,
        setCurrentState,
        formatFiles,
        setLastMessageTime,
        checkPermission,
        features.openclaw,
        openClawAuthBlocked,
        openClawStopPending,
        isConversationLoading,
        syncToUrl,
        loadConversations,
        cacheOpenClawActiveMessage,
        onMessageSent,
      ]
    );

    const reconcileOpenClawStopBoundary = useCallback(
      async (conversationId: string) => {
        if (!features.openclaw || !hasConversationId(conversationId)) return;
        updateOpenClawEventSeqFromMessages(conversationId, messageListRef.current);
        if (!adapters.conversationApi.events && !adapters.conversationApi.snapshot) return;

        const afterSeq = openClawEventSeqRef.current[conversationId] || 0;
        try {
          const response = adapters.conversationApi.snapshot
            ? await adapters.conversationApi.snapshot(conversationId, {
                ...(afterSeq > 0 ? { after_seq: afterSeq } : {}),
              })
            : await adapters.conversationApi.events!(conversationId, {
                limit: 100,
                ...(afterSeq > 0 ? { after_seq: afterSeq } : {}),
              });
          const rawPayload = response?.data ?? response;
          const payload = adapters.conversationApi.snapshot
            ? rawPayload
            : withOpenClawEventsAfterSeq(rawPayload, afterSeq);
          const events = getOpenClawTimelineEvents(payload);
          const nextSeq = getOpenClawTimelineMaxSeq(payload);
          if (nextSeq > afterSeq) {
            openClawEventSeqRef.current[conversationId] = nextSeq;
          }
          if (!events.length) return;

          const terminalEvents = events.filter(isOpenClawTerminalTimelineEvent);
          if (terminalEvents.length) {
            traceOpenClawChatView("stop.reconcile.terminal-refresh", {
              conversationId,
              afterSeq,
              eventCount: events.length,
              terminalEventCount: terminalEvents.length,
              nextSeq,
            });

            if (String(useConversationStore.getState().current_conversationid || "") !== conversationId) {
              delete openClawActiveMessageRef.current[conversationId];
              return;
            }

            const loaded = await loadMessageListRef.current(String(conversationId), (id, params) =>
              adapters.conversationApi.messages(id, params)
            );
            if (Array.isArray(loaded)) {
              updateOpenClawEventSeqFromMessagesRef.current(conversationId, loaded as Message[]);
              if (loaded.length > 0) {
                delete openClawActiveMessageRef.current[conversationId];
              } else {
                mergeOpenClawPayloadIntoLatestMessageRef.current(conversationId, payload);
                mergeOpenClawActiveMessageForConversationRef.current(conversationId);
              }
            } else {
              mergeOpenClawPayloadIntoLatestMessageRef.current(conversationId, payload);
              mergeOpenClawActiveMessageForConversationRef.current(conversationId);
            }
            return;
          }

          mergeOpenClawPayloadIntoLatestMessageRef.current(conversationId, payload);
          mergeOpenClawActiveMessageForConversationRef.current(conversationId);
        } catch (err: any) {
          const reason = getOpenClawAuthBlockedReason(err);
          if (reason) setOpenClawAuthBlockedReason(reason);
        }
      },
      [adapters.conversationApi, features.openclaw, updateOpenClawEventSeqFromMessages]
    );

    useEffect(() => {
      if (!features.openclaw || !openClawStopReconcilePending || isStopping) return;

      const conversationId = openClawStopReconcileConversationIdRef.current;
      let cancelled = false;

      void (async () => {
        try {
          if (conversationId) {
            await reconcileOpenClawStopBoundary(conversationId);
          }
        } finally {
          if (!cancelled) {
            openClawStopReconcileConversationIdRef.current = null;
            setOpenClawStopReconcilePending(false);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [features.openclaw, isStopping, openClawStopReconcilePending, reconcileOpenClawStopBoundary]);

    const handleStopStreaming = useCallback(() => {
      if (openClawStopPending) return;
      const stopConversationId = String(openClawStreamingConversationId || currentConversationId || "");
      if (features.openclaw && hasConversationId(stopConversationId)) {
        openClawStopReconcileConversationIdRef.current = stopConversationId;
        delete openClawActiveMessageRef.current[stopConversationId];
        updateOpenClawEventSeqFromMessages(stopConversationId, messageListRef.current);
        setOpenClawStopReconcilePending(true);
      }
      sendTurnRef.current += 1;
      sendBlockedRef.current = true;
      handleStop();
    }, [
      currentConversationId,
      features.openclaw,
      handleStop,
      openClawStopPending,
      openClawStreamingConversationId,
      updateOpenClawEventSeqFromMessages,
    ]);

    const refreshOpenClawEventsOnce = useCallback(
      async (conversationId: string) => {
        if (
          !features.openclaw ||
          (!adapters.conversationApi.events && !adapters.conversationApi.snapshot) ||
          !hasConversationId(conversationId)
        ) {
          return;
        }

        updateOpenClawEventSeqFromMessages(conversationId, messageListRef.current);
        const afterSeq = openClawEventSeqRef.current[conversationId] || 0;
        const response = adapters.conversationApi.snapshot
          ? await adapters.conversationApi.snapshot(conversationId, {
              ...(afterSeq > 0 ? { after_seq: afterSeq } : {}),
            })
          : await adapters.conversationApi.events!(conversationId, {
              limit: 100,
              ...(afterSeq > 0 ? { after_seq: afterSeq } : {}),
            });
        const rawPayload = response?.data ?? response;
        const payload = adapters.conversationApi.snapshot
          ? rawPayload
          : withOpenClawEventsAfterSeq(rawPayload, afterSeq);
        const events = getOpenClawTimelineEvents(payload);
        const nextSeq = getOpenClawTimelineMaxSeq(payload);
        openClawEventSeqRef.current[conversationId] = Math.max(
          openClawEventSeqRef.current[conversationId] || 0,
          nextSeq
        );
        if (!events.length) return;
        mergeOpenClawPayloadIntoLatestMessage(conversationId, payload);
      },
      [
        adapters.conversationApi,
        features.openclaw,
        mergeOpenClawPayloadIntoLatestMessage,
        updateOpenClawEventSeqFromMessages,
      ]
    );

    const handleOpenClawInteractionSubmit = useCallback(
      async (activity: OpenClawActivityItem, option: OpenClawInteractionOption, msg: Message) => {
        if (!features.openclaw || !adapters.conversationApi.control) return;
        const conversationId = String(activity.sessionId || msg.conversation_id || currentConversationId || "");
        if (!hasConversationId(conversationId)) {
          message.error("无法定位 WorkBuddy 会话");
          return;
        }

        const payload = buildOpenClawInteractionControlPayload(activity, option);
        try {
          await adapters.conversationApi.control(conversationId, payload);
          updateMessageList((list) => {
            const next = list.map((item) =>
              item.id === msg.id ? markOpenClawInteractionResolved(item as Message, activity.key) : item
            );
            messageListRef.current = next as Message[];
            return next;
          });
          try {
            await refreshOpenClawEventsOnce(conversationId);
          } catch (err: any) {
            const reason = getOpenClawAuthBlockedReason(err);
            if (reason) setOpenClawAuthBlockedReason(reason);
          }
          message.success("已提交选择");
        } catch (err: any) {
          const reason = getOpenClawAuthBlockedReason(err);
          if (reason) setOpenClawAuthBlockedReason(reason);
          message.error(reason || "提交选择失败");
          throw err;
        }
      },
      [
        adapters.conversationApi,
        currentConversationId,
        features.openclaw,
        refreshOpenClawEventsOnce,
        updateMessageList,
      ]
    );

    // Handle suggestion click
    const handleSuggestion = useCallback(
      (content: string) => {
        handleSend(content);
      },
      [handleSend]
    );

    // Handle regenerate message
    const handleRegenerate = useCallback(
      (msg: Message) => {
        const question = msg.original_question || msg.question || "";
        if (!question.trim()) return;
        handleSend(question, msg.uploaded_files || []);
      },
      [handleSend]
    );

    // Handle history open
    const handleHistoryOpen = useCallback(() => {
      historyRef.current?.open();
    }, []);

    const handleLoadMoreMessages = useCallback(
      (done: () => void) => {
        if (!hasConversationId(currentConversationId)) {
          done();
          return;
        }
        handleLoadListMore(
          done,
          String(currentConversationId),
          (id, params) => adapters.conversationApi.messages(id, params)
        );
      },
      [currentConversationId, handleLoadListMore, adapters.conversationApi]
    );

    // Handle embed close - use embedMode.requestClose()
    const handleEmbedClose = useCallback(() => {
      embedMode.requestClose();
    }, [embedMode]);

    // Share mode handlers
    const handleOpenShare = useCallback(() => {
      setShareMode(true);
      setSelectAll(false);
      setSelectMessageIds([]);
    }, []);

    const handleCancelShare = useCallback(() => {
      setShareMode(false);
      setSelectAll(false);
      setSelectMessageIds([]);
    }, []);

    const handleSelectAll = useCallback(() => {
      if (selectAll) {
        setSelectMessageIds([]);
        setSelectAll(false);
      } else {
        setSelectMessageIds(messageList.map((item: Message) => item.id));
        setSelectAll(true);
      }
    }, [selectAll, messageList]);

    const handleSelectMessage = useCallback(
      (msgId: string | number) => {
        if (selectMessageIds.includes(msgId)) {
          setSelectMessageIds((prev) => prev.filter((id) => id !== msgId));
          setSelectAll(false);
        } else {
          setSelectMessageIds((prev) => [...prev, msgId]);
        }
      },
      [selectMessageIds]
    );

    const handleCreateShare = useCallback(async () => {
      if (!onShare || !currentConversationId) return;
      setShareLoading(true);
      try {
        const link = await onShare(selectMessageIds, currentConversationId, selectAll);
        await copyToClip(link);
        message.success(t("share.create_success") || "分享链接已复制");
        setShareMode(false);
        setSelectAll(false);
        setSelectMessageIds([]);
      } catch (err) {
        console.error("Failed to create share:", err);
      } finally {
        setShareLoading(false);
      }
    }, [onShare, selectMessageIds, currentConversationId, selectAll, t]);

    // 源引用相关回调 - 需要在顶层声明
    const handleSourceClick = useCallback((source: ChunkItem, msg: Message) => {
      sourceRefManagerRef.current?.handleSourceClick(source, msg);
    }, []);

    const handleOpenKnow = useCallback((_msg: Message) => {
      // TODO: 打开知识库侧边栏
      message.info('查看知识库详情');
    }, []);

    const handleSourceReferenceClick = useCallback((data: SourceReferenceData, msg: Message) => {
      sourceRefManagerRef.current?.handleSourceReferenceClick(data, msg);
    }, []);

    const renderSource = useCallback((type: string, number: number) => {
      if (type === 'web') return `${number}`;
      return `${type}-${number}`;
    }, []);

    useImperativeHandle(ref, () => ({
      reload: () => {
        if (agentInfoProp) {
          setAgentInfo(agentInfoProp);
          setAgentLoading(false);
          return;
        }
        setAgentLoading(true);
        adapters.agentApi.detail(agentId).then(setAgentInfo).finally(() => setAgentLoading(false));
      },
      newConversation: handleNewConversation,
      openHistory: handleHistoryOpen,
      showShare: handleOpenShare,
      sendMessage: (content: string) => {
        if (content?.trim()) {
          handleSend(content);
        }
      },
      setPrompt: (content: string) => {
        setInputValue(content);
      },
    }));

    if (agentLoading) {
      return <LoadingState message={t("agent.loading")} />;
    }

    if (!agentId) {
      return <LoadingState message={t("agent.missing_id")} />;
    }

    if (!agentInfo) {
      return <LoadingState message={t("agent.not_found")} />;
    }

    // If agent is completion mode, render CompletionView instead
    if (agentMode === "completion") {
      return (
        <CompletionView
          agentInfo={agentInfo}
          checkPermission={checkPermission}
          features={features}
          renderHeader={renderHeader ? (props) => renderHeader({
            agentInfo: props.agentInfo,
            lang: props.lang,
            setLang: props.setLang,
            showGuide: props.showGuide,
            onGuideChange: props.onGuideChange,
          }) : undefined}
          onNextAgent={onNextAgent}
          onInitAgent={onInitAgent}
        />
      );
    }

    return (
      <div className="flex flex-col h-full bg-white">
        {/* Share Header */}
        {shareMode && features.share && (
          <ShareHeader
            selectedCount={selectMessageIds.length}
            selectAll={selectAll}
            onSelectAll={handleSelectAll}
            onCreateShare={handleCreateShare}
            onCancel={handleCancelShare}
          />
        )}

        {/* Header - 支持 slot 或默认，分享模式下隐藏 */}
        {!shareMode && (renderHeader ? (
          renderHeader({ agentInfo, lang, setLang, showGuide, onGuideChange: setShowGuide })
        ) : (
          <ChatHeader
            agentInfo={agentInfo}
            lang={lang}
            setLang={setLang}
            showGuide={showGuide}
            onGuideChange={setShowGuide}
            isEmbedMode={embedMode.isEmbedMode}
            onClose={handleEmbedClose}
            messageCount={messageList.length}
            onShare={handleOpenShare}
            features={{
              languageSwitcher: features.languageSwitcher,
              guide: features.guide,
              share: features.share,
            }}
          />
        ))}

        {/* 消息区域容器 - 工作台入口布局无消息时居中 */}
        <div className={`flex-1 flex flex-col overflow-hidden ${features.indexWelcomeLayout && messageList.length === 0 && !visibleIsStreaming ? "items-center justify-center" : ""}`}>
          {/* 初始加载中 - 显示加载动画，隐藏消息列表和输入框 */}
          {isInitialLoading && (
            <div className="flex-1 flex items-center justify-center">
              <Spin size="large" />
            </div>
          )}
          {/* ChatMessages - 工作台入口布局无消息时隐藏，初始加载时隐藏 */}
          {!isInitialLoading && !(features.indexWelcomeLayout && messageList.length === 0 && !visibleIsStreaming) && (
            <ChatMessages
              messageList={messageList as Message[]}
              agentInfo={agentInfo}
              isStreaming={visibleIsStreaming}
              features={{
                menu: {
                  copy: true,
                  regenerate: features.messageMenu,
                  share: features.share && !features.openclaw,
                  feedback: false,
                  addAsMd: features.messageMenu && features.openclaw && Boolean(onAddAsMd),
                },
                outputFiles: true,
                sourceRef: true,
                processFlow: true,
              }}
              onSuggestionClick={handleSuggestion}
              renderAuthTags={renderAuthTags}
              isShareMode={shareMode}
              selectedMessageIds={selectMessageIds}
              selectAll={selectAll}
              onMessageSelect={(msg) => handleSelectMessage(msg.id)}
              onSelectAll={handleSelectAll}
              showRecommend={features.showRecommend}
              showWelcome={features.showWelcome}
              recommendAgents={recommendAgents}
              onRecommendAgentSelect={onRecommendAgentSelect}
              onNextAgent={onNextAgent}
              onInitAgent={onInitAgent}
              openclaw={features.openclaw}
              showRelatedScene={features.showRelatedScene}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              isConversationLoading={isConversationLoading}
              onLoadMore={handleLoadMoreMessages}
              onRegenerate={handleRegenerate}
              onShare={features.share && !features.openclaw ? handleOpenShare : undefined}
              onAddAsMd={features.openclaw ? onAddAsMd : undefined}
              onSourceClick={handleSourceClick}
              onOpenKnow={handleOpenKnow}
              onSourceReferenceClick={handleSourceReferenceClick}
              renderSource={renderSource}
              onOutputFilePreview={onOutputFilePreview}
              onOpenClawInteractionSubmit={handleOpenClawInteractionSubmit}
              t={t}
              boxClassName={boxClassName}
              renderMessageMenu={
                !shareMode && features.messageMenu
                  ? (type, msg) => (
                      <MessageMenu
                        type={type}
                        content={type === "user" ? (msg.question || "") : (msg.answer || "")}
                        features={
                          features.openclaw
                            ? {
                                copy: true,
                                regenerate: type === "assistant",
                                share: false,
                                feedback: false,
                                addAsFile: false,
                              }
                            : { share: features.share }
                        }
                        onRegenerate={type === "assistant" ? () => handleRegenerate(msg) : undefined}
                        onShare={!features.openclaw && features.share ? handleOpenShare : undefined}
                      />
                    )
                  : undefined
              }
            />
          )}
        {/* 源引用管理器 */}
        <SourceReferenceManager ref={sourceRefManagerRef} />

        {/* 工作台入口欢迎布局 - 输入框上方标题描述 */}
        {!shareMode && !isInitialLoading && features.indexWelcomeLayout && messageList.length === 0 && !visibleIsStreaming && (
          <div className={`flex-none ${boxClassName || 'w-11/12 lg:w-4/5 max-w-[1200px] mx-auto'} mb-9`}>
            <h2 className="text-2xl text-center">
              {agentInfo?.name || ""}
            </h2>
            {agentInfo?.settings_obj?.opening_statement && (
              <p className="text-base text-[#666666] text-center mt-3 whitespace-pre-wrap max-h-52 overflow-y-auto">
                {agentInfo.settings_obj.opening_statement}
              </p>
            )}
          </div>
        )}

        {/* 输入区域 - 分享模式下隐藏，初始加载时隐藏 */}
        {!shareMode && !isInitialLoading && (
          <ChatInput
            inputValue={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            onStop={handleStopStreaming}
            isStreaming={visibleIsStreaming}
            disabled={isConversationLoading || openClawStopPending || openClawAuthBlocked || Boolean(features.openclaw && features.openclawInputDisabled)}
            stopDisabled={isConversationLoading || openClawStopPending}
            disabledReason={
              openClawAuthBlocked
                ? openClawAuthBlockedReason
                : isConversationLoading
                  ? conversationLoadingReason
                  : features.openclawInputDisabledReason
            }
            enableUpload={features.fileUpload && pluginConfig.features?.showFileUpload}
            placeholder={
              openClawAuthBlocked
                ? openClawAuthBlockedReason
                : isConversationLoading
                  ? conversationLoadingReason
                  : features.openclaw && features.openclawInputDisabled && features.openclawInputDisabledReason
                    ? features.openclawInputDisabledReason
                    : features.openclaw ? "请输入你的需求，按「Enter」发送" : t("chat.input_placeholder")
            }
            features={{
              history: features.history,
              newConversation: features.newConversation,
            }}
            onNewConversation={handleNewConversation}
            onHistoryOpen={handleHistoryOpen}
            renderLeftButtons={() =>
              renderAgentSelector && features.agentTooltip
                ? renderAgentSelector({
                    agentInfo,
                    onSelect: (agent) => {
                      if (syncToUrl) {
                        const url = new URL(window.location.href);
                        url.searchParams.set("agent_id", String(agent.agent_id));
                        url.searchParams.delete("conversation_id");
                        window.location.href = url.toString();
                      }
                    },
                  })
                : null
            }
            enableDragUpload={features.enableDragUpload}
            allowMultiple={features.allowMultiple}
            allowSendWithFiles={features.allowSendWithFiles}
            enablePasteUpload={features.enablePasteUpload}
            acceptTypes={acceptTypes}
            maxFileSize={maxFileSize}
            httpRequest={uploadRequest}
            showRecommend={features.showRecommend}
            boxClassName={boxClassName}
          />
        )}

        {/* 工作台入口欢迎布局 - 输入框下方 suggestions */}
        {!shareMode && !isInitialLoading && features.indexWelcomeLayout && messageList.length === 0 && !visibleIsStreaming && agentInfo?.settings_obj?.suggested_questions?.some((item: any) => item?.content?.trim()) && (
          <div className={`flex-none ${boxClassName || 'w-11/12 lg:w-4/5 max-w-[1200px] mx-auto'}`}>
            <div className="text-sm text-[#1D1E1F] mt-10 mb-3">
              {t("chat.suggested_questions")}
            </div>
            <div className="grid grid-cols-4 gap-3">
              {agentInfo.settings_obj.suggested_questions.map((item, index) => (
                <div
                  key={item.id || index}
                  className="py-3 px-5 rounded-xl border border-[#E6E8EB] cursor-pointer hover:bg-[#F2F3F5] transition-all"
                  onClick={() => handleSuggestion(item.content || "")}
                >
                  <span className="text-sm text-[#6B7280] line-clamp-2">
                    {item.content}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
        {/* Copyright */}
        {!shareMode && renderCopyright?.()}

        <ChatHistory
          ref={historyRef}
          onNew={handleNewConversation}
          title={features.openclaw ? "OpenClaw 历史会话" : undefined}
          showCreate={features.newConversation}
          showItemActions={!features.openclaw}
        />

        {showGuide && features.guide && (
          <div className="fixed inset-0 z-20 bg-white overflow-hidden">
            <div className="h-[70px] flex items-center justify-center border-b relative">
              <h4 className="text-lg text-[#1F2123]">{t("chat.usage_guide")}</h4>
              <div
                className="flex items-center justify-center size-6 absolute right-2 top-1/2 -translate-y-1/2 rounded cursor-pointer hover:bg-[#ECEDEE]"
                onClick={() => setShowGuide(false)}
              >
                <CloseOutlined />
              </div>
            </div>
            <UsageGuide useCases={agentInfo?.use_cases} />
          </div>
        )}
      </div>
    );
  }
);

ChatView.displayName = "ChatView";

export default ChatView;
