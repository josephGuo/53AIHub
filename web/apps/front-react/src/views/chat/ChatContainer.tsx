import { useMemo, forwardRef, useImperativeHandle, useRef, useState, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChatProvider,
  ChatConfigProvider,
  ChatView,
  UsageGuide,
  ChatHistory,
  type ChatViewRef,
  type ChatViewFeatures,
  type Message,
  type OutputFile,
  getOutputFileDownloadStrategy,
  shouldUseOpenClawChatAdapter,
  useConversationStore as useSharedChatConversationStore,
} from "@km/shared-business/chat";
import { useAgentStore, useCurrentAgent } from "@/stores/modules/agent";
import { useConversationStore } from "@/stores/modules/conversation";
import { useUserStore } from "@/stores/modules/user";
import { useEnterpriseStore, useIsSoftStyle } from "@/stores/modules/enterprise";
import { useShortcutsStore } from "@/stores/modules/shortcuts";
import {
  conversationApiAdapter,
  createOpenClawConversationApiAdapter,
  agentApiAdapter,
  buildOpenClawConversation,
} from "@/adapters/chat";
import openclawApi, { type OpenClawSession } from "@/api/modules/openclaw";
import { sharesApi } from "@/api/modules/share";
import chatApi from "@/api/modules/chat";
import { t } from "@/locales";
import { buildUrl } from "@/utils/router";
import { Button, Popover, Tooltip, message } from "antd";
import { LeftOutlined, CloseOutlined, DownOutlined, UpOutlined } from "@ant-design/icons";
import { SvgIcon } from "@km/shared-components-react";
import AuthTagGroup from "@/components/AuthTagGroup";
import AddAnswerAsMd, { type AddAnswerAsMdRef } from "@/components/Chat/AddAnswerAsMd";
import MoreDropdown from "@/components/MoreDropdown";
import AgentTooltip from "./chat/components/agent-tooltip";
import { ExpandSidebarButton } from "@/components/Layout/ExpandSidebarButton";
import { checkPermission as checkUserPermission } from "@/utils/permission";
import { getPublicPath } from "@/utils/config";
import uploadApi from "@/api/modules/upload";
import { API_HOST } from "@/api/host";
import FileViewer from "@/components/FileViewer";
import OpenClawPanel from "./components/OpenClawPanel";
import { isOpenClawCompatibleChannelType } from "@km/shared-business/agent-create";
import { eventBus } from "@km/shared-utils";
import { EVENT_NAMES } from "@/constants/events";
import "./openclaw-embedded.css";
import {
  DISCONNECTED_OPENCLAW_STATUS,
  OPENCLAW_STATUS_CONNECTED_POLL_INTERVAL,
  OPENCLAW_STATUS_RETRY_POLL_INTERVAL,
  type OpenClawConnectionState,
  getOpenClawConnectionState,
  getOpenClawGatewayDisplayName,
  getOpenClawInputDisabledReason,
  readOpenClawResponsePayload,
} from "./openclaw-status";
import {
  OPENCLAW_HISTORY_FETCH_LIMIT,
  OPENCLAW_HISTORY_VISIBLE_STEP,
  getOpenClawHistoryVisibleCountForSelected,
  getNextOpenClawHistoryVisibleCount,
  getOpenClawHistoryScrollAction,
  getVisibleOpenClawHistoryItems,
  shouldFetchOpenClawHistoryAfterShowMore,
} from "./openclaw-history";

interface ChatContainerProps {
  agentId: string | number;  // 支持 string 类型（如 "U5KLWZ"）
  conversationId?: string | number;
  useCaseFixed?: boolean;
  showRecommend?: boolean;
  hideMenuHeader?: boolean;
  className?: string;
  currentAgentOverride?: any;
  embeddedOpenClawPreview?: boolean;
  disableOpenClawUrlSync?: boolean;
  skipOpenClawFrontStoreMirror?: boolean;
  isIndexRoute?: boolean;  // 工作台入口路径判断
}

export interface ChatContainerRef {
  showUseCase: () => void;
  hideUseCase: () => void;
  showShare: () => void;
}

const DEFAULT_IMG = "/images/default_agent.png";
const OPENCLAW_LOGO = "/images/vibe/openclaw.svg";
const TOPIC_ICON = "/images/vibe/topic.svg";
const OPENCLAW_CHANNEL_TYPE = 1014;
const openClawStatusRequests = new Map<string, Promise<unknown>>();
const OPENCLAW_ADD_TO_KNOWLEDGE_FALLBACK_TITLE = "OpenClaw 回答";

interface OpenClawOutputFilePreviewState {
  visible: boolean;
  currentFile: {
    id?: string | number;
    name?: string;
    file_url?: string;
    file_ext?: string;
    content?: string;
  };
}

function isOpenClawAgent(agent?: any): boolean {
  return isOpenClawCompatibleChannelType(agent?.channel_type);
}

function loadOpenClawStatus(agentId: string | number) {
  const key = String(agentId);
  const existing = openClawStatusRequests.get(key);
  if (existing) return existing;

  const request = openclawApi
    .status(agentId, { ignoreMessage: true })
    .finally(() => {
      if (openClawStatusRequests.get(key) === request) {
        openClawStatusRequests.delete(key);
      }
    });
  openClawStatusRequests.set(key, request);
  return request;
}

function OpenClawToolbarIcon() {
  return (
    <img
      className="size-[18px] object-contain"
      src={getPublicPath(OPENCLAW_LOGO)}
      alt="OpenClaw"
      style={{ filter: "brightness(0)" }}
    />
  );
}

function TopicIcon({ className = "" }: { className?: string }) {
  return (
    <img
      className={`size-4 object-contain ${className}`}
      src={getPublicPath(TOPIC_ICON)}
      alt=""
      aria-hidden="true"
    />
  );
}

function syncOpenClawConversationUrl(agentId: string | number, conversationId: string | number) {
  const url = new URL(window.location.href);
  url.searchParams.set("agent_id", String(agentId));
  url.searchParams.set("conversation_id", String(conversationId));
  url.searchParams.set("type", "openclaw");
  window.history.replaceState(null, "", url.toString());
}

function getConversationKey(conversation: any) {
  return String(conversation?.conversation_id || "");
}

function mergeOpenClawConversations(current: any[], incoming: any[]) {
  const next: any[] = [];
  const indexById = new Map<string, number>();

  for (const item of current) {
    const key = getConversationKey(item);
    if (!key) continue;
    if (indexById.has(key)) continue;
    indexById.set(key, next.length);
    next.push(item);
  }

  for (const item of incoming) {
    const key = getConversationKey(item);
    if (!key) continue;
    const existingIndex = indexById.get(key);
    if (existingIndex === undefined) {
      indexById.set(key, next.length);
      next.push(item);
    } else {
      next[existingIndex] = { ...next[existingIndex], ...item };
    }
  }

  return next;
}

function readOpenClawPayload(response: any) {
  return response?.data || response || {};
}

function readOpenClawCurrentSession(response: any): OpenClawSession | null {
  const payload = readOpenClawPayload(response);
  const candidate = payload?.session || payload?.conversation || payload;
  if (!candidate || typeof candidate !== "object") return null;

  const id = candidate.id || candidate.session_id || candidate.sessionId || candidate.conversation_id || candidate.conversationId;
  if (typeof id !== "string" || !id.trim()) return null;

  return {
    ...(candidate as OpenClawSession),
    id,
  };
}

function isHubManagedOpenClawSession(session: OpenClawSession) {
  const title = String(session.title || "").trim();
  if (!title) return true;
  return title.startsWith("53AI Hub-") || title.startsWith("53AIHub ") || title.startsWith("53AIHub:") || title.startsWith("53AIHub-");
}

function hasUsableConversationId(conversationId?: string | number | null) {
  return Boolean(conversationId) && conversationId !== 0 && conversationId !== "0";
}

function getOutputFileName(file: OutputFile) {
  return file.file_name?.split("/").pop() || file.file_name || `文件 ${file.id || ""}`.trim() || "download";
}

function appendOpenClawOutputFileToken(rawUrl: string, accessToken?: string) {
  if (!rawUrl || rawUrl.startsWith("data:") || rawUrl.startsWith("blob:")) return rawUrl;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, window.location.origin);
  } catch {
    return rawUrl;
  }

  const isUploadDownload = parsed.pathname.startsWith("/api/upload-files/") && parsed.pathname.includes("/download");
  if (isUploadDownload && accessToken && !parsed.searchParams.has("token")) {
    parsed.searchParams.set("token", accessToken);
  }

  return parsed.toString();
}

function resolveOpenClawOutputFilePreviewUrl(file: OutputFile, accessToken?: string) {
  const strategy = getOutputFileDownloadStrategy(file);
  const rawUrl =
    strategy.kind === "direct_url" || strategy.kind === "data_url"
      ? strategy.url
      : file.signed_download_url || file.download_url || "";
  if (!rawUrl) return "";
  const url = appendOpenClawOutputFileToken(rawUrl, accessToken);
  if (url.startsWith("/api/") && API_HOST) {
    return `${API_HOST}${url}`;
  }
  return url;
}

function createOpenClawInlineOutputFilePreview(file: OutputFile) {
  if (typeof file.content !== "string") return null;
  const mimeType = file.mime_type || "text/plain;charset=utf-8";
  if (typeof URL.createObjectURL !== "function") {
    return {
      url: `data:${mimeType},${encodeURIComponent(file.content)}`,
      content: file.content,
    };
  }
  const blob = new Blob([file.content], { type: mimeType });
  return {
    url: URL.createObjectURL(blob),
    content: file.content,
  };
}

function getOpenClawAnswerForKnowledge(message: Message) {
  const projectedAnswer = message.openclawProjection?.visibleAnswer?.trim();
  if (projectedAnswer) return projectedAnswer;
  return "";
}

function getOpenClawQuestionForKnowledge(message: Message) {
  return (
    message.original_question?.trim() ||
    message.question?.trim() ||
    OPENCLAW_ADD_TO_KNOWLEDGE_FALLBACK_TITLE
  );
}

const ChatContainer = forwardRef<ChatContainerRef, ChatContainerProps>(
  (
    {
      agentId,
      conversationId,
      useCaseFixed = false,
      showRecommend = false,
      hideMenuHeader = false,
      className,
      currentAgentOverride,
      embeddedOpenClawPreview = false,
      disableOpenClawUrlSync = false,
      skipOpenClawFrontStoreMirror = false,
      isIndexRoute = false,
    },
    ref
  ) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const chatViewRef = useRef<ChatViewRef>(null);
    const addAnswerAsMdRef = useRef<AddAnswerAsMdRef>(null);
    // 用于追踪 CompletionView 传入的 onGuideChange 回调，使 useImperativeHandle 能正确触发面板
    const externalOnGuideChangeRef = useRef<((show: boolean) => void) | null>(null);
    const [showHistory, setShowHistory] = useState(false);  // 工作台入口历史侧边栏
    const agentStore = useAgentStore();
    const storeCurrentAgent = useCurrentAgent();
    const currentAgent = currentAgentOverride || storeCurrentAgent;
    const convStore = useConversationStore();
    const sharedConvStore = useSharedChatConversationStore();
    const addFrontConversation = useConversationStore((state) => state.addConversation);
    const setFrontCurrentState = useConversationStore((state) => state.setCurrentState);
    const addSharedConversation = useSharedChatConversationStore((state: any) => state.addConversation);
    const setSharedCurrentState = useSharedChatConversationStore((state: any) => state.setCurrentState);
    const shortcutsStore = useShortcutsStore();
    const enterpriseStore = useEnterpriseStore();
    const isSoftStyle = useIsSoftStyle();
    const accessToken = useUserStore((state) => state.info.access_token);

    // 获取当前语言
    const locale = useEnterpriseStore((state) => state.language);

    const [showGuide, setShowGuide] = useState(false);
    const [openClawPanelOpen, setOpenClawPanelOpen] = useState(false);
    const [outputFilePreview, setOutputFilePreview] = useState<OpenClawOutputFilePreviewState>({
      visible: false,
      currentFile: {},
    });
    const [openClawHistoryOpen, setOpenClawHistoryOpen] = useState(false);
    const [openClawConversationCache, setOpenClawConversationCache] = useState<any[]>([]);
    const [openClawConversationPagination, setOpenClawConversationPagination] = useState<any>(null);
    const [openClawHistoryVisibleCount, setOpenClawHistoryVisibleCount] = useState(OPENCLAW_HISTORY_VISIBLE_STEP);
    const [openClawHistoryLoading, setOpenClawHistoryLoading] = useState(false);
    const [openClawConnectionState, setOpenClawConnectionState] = useState<OpenClawConnectionState>("checking");
    const [openClawStatusLoading, setOpenClawStatusLoading] = useState(false);
    const [openClawStatusPayload, setOpenClawStatusPayload] = useState<any>(null);
    const [openClawInitialConversationId, setOpenClawInitialConversationId] = useState<string | number | undefined>();
    const [openClawCurrentConversationResolving, setOpenClawCurrentConversationResolving] = useState(false);
    const openClawHistoryLoadingRef = useRef(false);
    const openClawHistoryListRef = useRef<HTMLDivElement | null>(null);
    const openClawDefaultResolveKeyRef = useRef<string | null>(null);
    const openClawExplicitSelectionRef = useRef(false);
    const openClawStatusAgentKeyRef = useRef<string | null>(null);
    const openClawStatusRequestSeqRef = useRef(0);
    const openClawConnectionStateRef = useRef<OpenClawConnectionState>("checking");

    // 当前会话：统一使用 shared-business store，因为 ChatView 是主组件
    // 所有会话数据（包括新建会话）都由 shared-business store 管理
    const currentConversationId = useSharedChatConversationStore((state: any) => state.current_conversationid);
    const conversations = useSharedChatConversationStore((state: any) => state.conversations);

    // 是否为快捷方式
    const isShortcut = useMemo(() => {
      if (!currentAgent?.agent_id) return false;
      return shortcutsStore.isShortcut("agent", currentAgent.agent_id);
    }, [currentAgent?.agent_id, shortcutsStore]);

    // 判断是否为 Openclaw 智能体
    const isOpenclaw = useMemo(() => {
      return shouldUseOpenClawChatAdapter({
        currentAgent,
        agentId,
        openClawChannelType: isOpenClawCompatibleChannelType(currentAgent?.channel_type)
          ? currentAgent.channel_type
          : OPENCLAW_CHANNEL_TYPE,
        routeType: searchParams.get("type"),
        conversationId,
      });
    }, [currentAgent, agentId, searchParams, conversationId]);
    const openClawHealthy = isOpenclaw
      ? openClawConnectionState === "connected"
        ? true
        : openClawConnectionState === "disconnected"
          ? false
          : null
      : null;
    const openClawGatewayName = useMemo(
      () => getOpenClawGatewayDisplayName(openClawStatusPayload, currentAgent),
      [currentAgent, openClawStatusPayload],
    );

    useEffect(() => {
      openClawConnectionStateRef.current = openClawConnectionState;
    }, [openClawConnectionState]);

    const selectedConversationId = isOpenclaw && openClawHealthy !== true
      ? undefined
      : currentConversationId || conversationId || openClawInitialConversationId;
    const hasSelectedConversationId = Boolean(
      selectedConversationId && selectedConversationId !== 0 && selectedConversationId !== "0"
    );
    const visibleConversations = isOpenclaw
      ? openClawConversationCache.length > 0
        ? openClawConversationCache
        : conversations
      : conversations;

    useEffect(() => {
      if (isOpenclaw && conversations.length > 0) {
        setOpenClawConversationCache((current) => mergeOpenClawConversations(current, conversations));
      }
    }, [conversations, isOpenclaw]);

    const currentConv = useMemo(() => {
      const targetId = String(selectedConversationId);
      return (
        visibleConversations.find((item: any) => String(item.conversation_id) === targetId) ||
        (isOpenclaw ? conversations.find((item: any) => String(item.conversation_id) === targetId) : undefined)
      );
    }, [conversations, isOpenclaw, selectedConversationId, visibleConversations]);

    const openClawHistoryVisibleConversations = useMemo(
      () => getVisibleOpenClawHistoryItems(visibleConversations, openClawHistoryVisibleCount),
      [openClawHistoryVisibleCount, visibleConversations],
    );

    const openClawConversationOptions = useMemo(() => {
      const historyConversations = isOpenclaw ? openClawHistoryVisibleConversations : visibleConversations;
      if (!isOpenclaw) return historyConversations;
      return historyConversations;
    }, [isOpenclaw, openClawHistoryVisibleConversations, visibleConversations]);

    const currentAgentLogo = currentAgent?.logo || DEFAULT_IMG;
    const chatAgentInfo = useMemo(() => currentAgent ? {
      agent_id: currentAgent.agent_id,
      name: currentAgent.name,
      logo: currentAgent.logo,
      description: currentAgent.description,
      custom_config_obj: currentAgent.custom_config_obj,
      settings_obj: currentAgent.settings_obj,
      use_cases: currentAgent.use_cases,
      user_group_ids: currentAgent.user_group_ids,
    } : undefined, [currentAgent]);
    const chatViewKey = isOpenclaw ? `openclaw:${agentId}` : `normal:${agentId}`;
    const chatViewInitialConversationId = isOpenclaw
      ? openClawHealthy === true
        ? (hasUsableConversationId(conversationId) ? conversationId : openClawInitialConversationId)
        : undefined
      : conversationId;

    const loadOpenClawConversationPage = useCallback(async (offset = 0) => {
      if (!isOpenclaw || openClawHealthy !== true || openClawHistoryLoadingRef.current) return;
      openClawHistoryLoadingRef.current = true;
      setOpenClawHistoryLoading(true);
      try {
        const response = await openclawApi.conversations(agentId, {
          limit: OPENCLAW_HISTORY_FETCH_LIMIT,
          offset,
        });
        const payload = readOpenClawPayload(response);
        const page = ((payload.sessions || []) as OpenClawSession[]).map((session) =>
          buildOpenClawConversation(session, agentId)
        );
        setOpenClawConversationPagination(payload.pagination || null);
        setOpenClawConversationCache((current) =>
          offset === 0 ? mergeOpenClawConversations([], page) : mergeOpenClawConversations(current, page)
        );
        if (offset === 0) {
          setOpenClawHistoryVisibleCount(OPENCLAW_HISTORY_VISIBLE_STEP);
        }
      } catch (error) {
        console.error("Failed to load OpenClaw conversations:", error);
      } finally {
        openClawHistoryLoadingRef.current = false;
        setOpenClawHistoryLoading(false);
      }
    }, [agentId, isOpenclaw, openClawHealthy]);

    useEffect(() => {
      if (!isOpenclaw) {
        openClawDefaultResolveKeyRef.current = null;
        openClawExplicitSelectionRef.current = false;
        setOpenClawInitialConversationId(undefined);
        setOpenClawCurrentConversationResolving(false);
        return;
      }

      if (openClawHealthy !== true) {
        openClawDefaultResolveKeyRef.current = null;
        openClawExplicitSelectionRef.current = false;
        setOpenClawInitialConversationId(undefined);
        setOpenClawCurrentConversationResolving(false);
        if (openClawHealthy === false) {
          setOpenClawConversationCache([]);
          setOpenClawConversationPagination(null);
          setOpenClawHistoryVisibleCount(OPENCLAW_HISTORY_VISIBLE_STEP);
          setSharedCurrentState(agentId, 0);
          if (!skipOpenClawFrontStoreMirror) {
            setFrontCurrentState(String(agentId), 0, false);
          }
        }
        return;
      }

      const routeConversationId =
        isOpenclaw && hasUsableConversationId(conversationId) ? String(conversationId) : "";
      const resolveKey = `${String(agentId)}:${routeConversationId || "default"}`;
      if (openClawDefaultResolveKeyRef.current === resolveKey) {
        return;
      }
      openClawDefaultResolveKeyRef.current = resolveKey;

      let cancelled = false;
      openClawExplicitSelectionRef.current = Boolean(routeConversationId);
      setOpenClawInitialConversationId(undefined);
      setOpenClawCurrentConversationResolving(true);

      if (routeConversationId) {
        const routeConversation = {
          conversation_id: routeConversationId,
          agent_id: Number.isFinite(Number(agentId)) ? Number(agentId) : agentId,
          title: "当前会话",
          created_time: Date.now(),
          updated_time: Date.now(),
          top: 0,
          is_valid: 1,
        };
        addSharedConversation(routeConversation);
        setSharedCurrentState(agentId, routeConversationId);
        if (!skipOpenClawFrontStoreMirror) {
          addFrontConversation(routeConversation);
          setFrontCurrentState(String(agentId), routeConversationId, false);
        }
        setOpenClawInitialConversationId(routeConversationId);
        setOpenClawCurrentConversationResolving(false);
        return;
      }

      const resolveCurrentConversation = async () => {
        try {
          const response = await openclawApi.currentConversation(agentId, { ignoreMessage: true });
          if (cancelled) return;

          const session = readOpenClawCurrentSession(response);
          if (openClawExplicitSelectionRef.current) return;
          if (!session || !isHubManagedOpenClawSession(session)) {
            setSharedCurrentState(agentId, 0);
            if (!skipOpenClawFrontStoreMirror) {
              setFrontCurrentState(String(agentId), 0, false);
            }
            return;
          }

          const conversation = buildOpenClawConversation(session, agentId);
          addSharedConversation(conversation);
          setSharedCurrentState(agentId, conversation.conversation_id);
          if (!skipOpenClawFrontStoreMirror) {
            addFrontConversation(conversation);
            setFrontCurrentState(String(agentId), conversation.conversation_id, false);
          }
          setOpenClawInitialConversationId(conversation.conversation_id);
          if (!disableOpenClawUrlSync) {
            syncOpenClawConversationUrl(agentId, conversation.conversation_id);
          }
        } catch (error) {
          if (!cancelled) {
            console.error("Failed to resolve current OpenClaw conversation:", error);
            setSharedCurrentState(agentId, 0);
            if (!skipOpenClawFrontStoreMirror) {
              setFrontCurrentState(String(agentId), 0, false);
            }
          }
        } finally {
          if (!cancelled) {
            setOpenClawCurrentConversationResolving(false);
          }
        }
      };

      void resolveCurrentConversation();

      return () => {
        cancelled = true;
      };
    }, [
      addFrontConversation,
      addSharedConversation,
      agentId,
      conversationId,
      isOpenclaw,
      openClawHealthy,
      setFrontCurrentState,
      disableOpenClawUrlSync,
      skipOpenClawFrontStoreMirror,
      setSharedCurrentState,
    ]);

    useEffect(() => {
      if (openClawHistoryOpen && isOpenclaw && openClawHealthy === true) {
        void loadOpenClawConversationPage(0);
      }
    }, [isOpenclaw, loadOpenClawConversationPage, openClawHealthy, openClawHistoryOpen]);

    useEffect(() => {
      if (!openClawHistoryOpen || !isOpenclaw || !hasSelectedConversationId) return;

      const nextVisibleCount = getOpenClawHistoryVisibleCountForSelected(
        visibleConversations,
        selectedConversationId,
        (item: any) => item.conversation_id,
        openClawHistoryVisibleCount
      );
      if (nextVisibleCount > openClawHistoryVisibleCount) {
        setOpenClawHistoryVisibleCount(nextVisibleCount);
        return;
      }

      const frame = window.requestAnimationFrame(() => {
        const container = openClawHistoryListRef.current;
        if (!container) return;

        const selectedKey = String(selectedConversationId);
        const target = Array.from(container.querySelectorAll<HTMLElement>("[data-conversation-id]"))
          .find((item) => item.dataset.conversationId === selectedKey);
        target?.scrollIntoView?.({ block: "center" });
      });

      return () => {
        window.cancelAnimationFrame(frame);
      };
    }, [
      hasSelectedConversationId,
      isOpenclaw,
      openClawHistoryOpen,
      openClawHistoryVisibleCount,
      selectedConversationId,
      visibleConversations,
    ]);

    const refreshOpenClawStatus = useCallback(async ({ showLoading = false } = {}) => {
      if (!isOpenclaw) return null;
      const agentKey = String(agentId);
      const requestSeq = openClawStatusRequestSeqRef.current + 1;
      openClawStatusRequestSeqRef.current = requestSeq;
      openClawStatusAgentKeyRef.current = agentKey;
      if (showLoading) {
        setOpenClawStatusLoading(true);
      }

      try {
        const response = await loadOpenClawStatus(agentId);
        if (
          openClawStatusAgentKeyRef.current !== agentKey ||
          openClawStatusRequestSeqRef.current !== requestSeq
        ) {
          return null;
        }

        const payload = readOpenClawResponsePayload(response);
        const connectionState = getOpenClawConnectionState(payload);
        openClawConnectionStateRef.current = connectionState;
        setOpenClawStatusPayload(payload);
        setOpenClawConnectionState(connectionState);
        setOpenClawStatusLoading(false);
        return { payload, connectionState };
      } catch {
        if (
          openClawStatusAgentKeyRef.current !== agentKey ||
          openClawStatusRequestSeqRef.current !== requestSeq
        ) {
          return null;
        }

        openClawConnectionStateRef.current = "disconnected";
        setOpenClawStatusPayload(DISCONNECTED_OPENCLAW_STATUS);
        setOpenClawConnectionState("disconnected");
        setOpenClawStatusLoading(false);
        return { payload: DISCONNECTED_OPENCLAW_STATUS, connectionState: "disconnected" as const };
      }
    }, [agentId, isOpenclaw]);

    useEffect(() => {
      if (!isOpenclaw) {
        openClawStatusRequestSeqRef.current += 1;
        openClawStatusAgentKeyRef.current = null;
        openClawConnectionStateRef.current = "checking";
        setOpenClawConnectionState("checking");
        setOpenClawStatusPayload(null);
        setOpenClawStatusLoading(false);
        return;
      }

      const agentKey = String(agentId);
      let stopped = false;
      let timer: number | null = null;
      openClawStatusRequestSeqRef.current += 1;
      openClawStatusAgentKeyRef.current = agentKey;
      openClawConnectionStateRef.current = "checking";
      setOpenClawConnectionState("checking");
      setOpenClawStatusPayload(null);
      setOpenClawStatusLoading(true);

      const schedule = (connectionState: OpenClawConnectionState) => {
        if (stopped || openClawStatusAgentKeyRef.current !== agentKey) return;
        const delay = connectionState === "connected"
          ? OPENCLAW_STATUS_CONNECTED_POLL_INTERVAL
          : OPENCLAW_STATUS_RETRY_POLL_INTERVAL;
        timer = window.setTimeout(() => {
          void run(false);
        }, delay);
      };

      const run = async (showLoading = false) => {
        const result = await refreshOpenClawStatus({ showLoading });
        if (stopped || openClawStatusAgentKeyRef.current !== agentKey) return;
        schedule(result?.connectionState || openClawConnectionStateRef.current);
      };

      void run(true);
      return () => {
        stopped = true;
        openClawStatusRequestSeqRef.current += 1;
        if (timer) {
          window.clearTimeout(timer);
        }
      };
    }, [agentId, isOpenclaw, refreshOpenClawStatus]);

    const handleOpenClawHistoryScroll = useCallback((event: any) => {
      const target = event.currentTarget;
      const pagination = openClawConversationPagination;
      const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight <= 24;
      const action = getOpenClawHistoryScrollAction({
        isNearBottom,
        loading: openClawHistoryLoading,
        visibleCount: openClawHistoryVisibleCount,
        cachedCount: openClawConversationCache.length,
        hasMoreRemote: Boolean(pagination?.hasMore),
      });

      if (action === "show-more") {
        setOpenClawHistoryVisibleCount((current) =>
          getNextOpenClawHistoryVisibleCount(current, openClawConversationCache.length)
        );
        if (
          shouldFetchOpenClawHistoryAfterShowMore({
            visibleCount: openClawHistoryVisibleCount,
            cachedCount: openClawConversationCache.length,
            hasMoreRemote: Boolean(pagination?.hasMore),
          })
        ) {
          const nextOffset = typeof pagination.nextOffset === "number"
            ? pagination.nextOffset
            : openClawConversationCache.length;
          void loadOpenClawConversationPage(nextOffset);
        }
        return;
      }

      if (action !== "fetch-more") return;

      const nextOffset = typeof pagination.nextOffset === "number"
        ? pagination.nextOffset
        : openClawConversationCache.length;
      void loadOpenClawConversationPage(nextOffset);
    }, [loadOpenClawConversationPage, openClawConversationCache.length, openClawConversationPagination, openClawHistoryLoading, openClawHistoryVisibleCount]);

    // 判断是否为 Completion 模式
    const isCompletion = useMemo(() => {
      return currentAgent?.custom_config_obj?.agent_mode === "completion";
    }, [currentAgent]);

    // 返回处理
    const handleBack = useCallback(() => {
      const from = searchParams.get("from");
      if (from === "my") {
        navigate({ pathname: "/agent", search: "?from=my" });
      } else {
        navigate("/agent");
      }
    }, [navigate, searchParams]);

    // 处理下一个智能体准备参数 - 用于 RelatedScene 的 field_mapping
    const handleNextAgent = useCallback(async (item: any, parameters: Record<string, string>) => {
      // 先检查智能体是否存在于 store 中
      const targetAgent = agentStore.findAgentByAgentId(item.agent_id);
      if (!targetAgent) {
        message.warning(t("agent.not_found"));
        return;
      } 

      chatViewRef.current?.newConversation();

      // 设置下一个智能体的准备参数
      convStore.setNextAgentPrepare({
        agent_id: item.agent_id,
        execution_rule: item.execution_rule,
        is_workflow: typeof item.is_workflow === 'boolean' ? item.is_workflow : true,
        parameters,
      });
      // 切换到新智能体（isReplace=false 阻止 setRouter 触发页面刷新，由后续 navigate 处理跳转）
      convStore.setCurrentState(item.agent_id, '', false);

      const isAgentOpenclaw = isOpenClawAgent(item);
      const search = isAgentOpenclaw
        ? `?agent_id=${item.agent_id}&hide_bottom_actions=true&type=openclaw`
        : `?agent_id=${item.agent_id}`;

      // 软件模式下，先添加到快捷方式列表
      if (isSoftStyle) {
        try {
          await agentStore.addShortcut(item.agent_id);
        } catch (err) {
          console.error("添加快捷方式失败:", err);
        }
      }

      navigate({
        pathname: isSoftStyle ? "/index/agent" : "/chat",
        search,
      });
    }, [agentStore, convStore, navigate, isSoftStyle]);

    // 当跳转到同一个智能体时，重新初始化
    const handleInitAgent = useCallback(() => {
      // 重新加载当前智能体，清空消息列表
      chatViewRef.current?.reload();
    }, []);

    const handleOpenOutputFilePreview = useCallback((file: OutputFile, _message: Message) => {
      const fileUrl = resolveOpenClawOutputFilePreviewUrl(file, accessToken);
      const inlinePreview = fileUrl ? null : createOpenClawInlineOutputFilePreview(file);
      const previewUrl = fileUrl || inlinePreview?.url;
      if (!previewUrl) return;

      const fileName = getOutputFileName(file);
      setShowGuide(false);
      setOpenClawPanelOpen(false);
      setOutputFilePreview({
        visible: true,
        currentFile: {
          id: file.id,
          name: fileName,
          file_url: previewUrl,
          file_ext: fileName.split(".").pop() || "",
          content: inlinePreview?.content,
        },
      });
    }, [accessToken]);

    const handleAddOpenClawAnswerAsMd = useCallback((message: Message) => {
      const answer = getOpenClawAnswerForKnowledge(message);
      if (!answer) return;
      addAnswerAsMdRef.current?.open({
        answer,
        question: getOpenClawQuestionForKnowledge(message),
      });
    }, []);

    const handleCloseOutputFilePreview = useCallback(() => {
      setOutputFilePreview((previous) => {
        if (previous.currentFile.file_url?.startsWith("blob:")) {
          URL.revokeObjectURL(previous.currentFile.file_url);
        }
        return {
          visible: false,
          currentFile: {},
        };
      });
    }, []);

    const handleDownloadOutputFile = useCallback(() => {
      const fileUrl = outputFilePreview.currentFile.file_url;
      if (!fileUrl) return;
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = outputFilePreview.currentFile.name || "download";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, [outputFilePreview.currentFile.file_url, outputFilePreview.currentFile.name]);

    useEffect(() => () => {
      const fileUrl = outputFilePreview.currentFile.file_url;
      if (fileUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(fileUrl);
      }
    }, [outputFilePreview.currentFile.file_url]);

    // 处理 next_agent_prepare - 自动填充输入或自动发送
    const nextAgentPrepare = useConversationStore((state) => state.next_agent_prepare);
    useEffect(() => {
      const prepare = nextAgentPrepare;

      // 只有当 prepare.agent_id 与当前 agentId 匹配时才处理
      // 确保导航完成、新组件挂载后才执行，而不是在旧组件上执行
      if (prepare.agent_id && String(prepare.agent_id) === String(agentId)) {
        const inputText = prepare.parameters?.input || "";
        if (inputText) {
          // 填充输入框
          chatViewRef.current?.setPrompt(inputText);
        }
        // execution_rule 是 auto，自动发送消息
        if (prepare.execution_rule === "auto" && inputText) {
          chatViewRef.current?.sendMessage(inputText);
        }
        // 清空准备参数
        convStore.setNextAgentPrepare({});
      }
    }, [nextAgentPrepare, convStore, agentId]);

    // 更多操作
    const handleMore = useCallback(
      async (command: string) => {
        if (command === "add-shortcut") {
          await shortcutsStore.addShortcut("agent", String(currentAgent?.agent_id));
        } else if (command === "remove-shortcut") {
          await shortcutsStore.removeShortcut("agent", String(currentAgent?.agent_id));
        }
      },
      [shortcutsStore, currentAgent]
    );

    // 图片错误处理
    const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
      const target = e.target as HTMLImageElement;
      const fallback = getPublicPath(DEFAULT_IMG);
      if (target.src.endsWith(fallback)) return;
      target.src = fallback;
    }, []);

    const lockOpenClawEmbeddedPreviewToCurrentAgent = embeddedOpenClawPreview && isOpenclaw;

    // 配置 features
    const features: ChatViewFeatures = useMemo(
      () => ({
        menu: {
          copy: true,
          regenerate: true,
          share: true
        },
        history: !isOpenclaw && !isIndexRoute,
        newConversation: !isOpenclaw && !isIndexRoute,
        languageSwitcher: false,
        fileUpload: currentAgent?.settings_obj?.file_parse?.enable || currentAgent?.settings_obj?.image_parse?.enable,
        guide: true, // 工作台入口也需要显示使用指引面板
        share: !isOpenclaw,
        agentTooltip: !isIndexRoute && !lockOpenClawEmbeddedPreviewToCurrentAgent,
        messageMenu: true,
        skipInitialLoad: isIndexRoute ? false : !isOpenclaw,
        showRecommend: lockOpenClawEmbeddedPreviewToCurrentAgent ? false : showRecommend,
        enableDragUpload: true,
        allowMultiple: true,
        openclaw: isOpenclaw,
        showRelatedScene: !isOpenclaw,
        allowSendWithFiles: ["53ai_agent", "fastgpt_agent"].includes(currentAgent?.custom_config_obj?.agent_type),
        enablePasteUpload: true,
        openclawInputDisabled: isOpenclaw && openClawHealthy !== true,
        openclawInputDisabledReason: isOpenclaw && openClawHealthy !== true
          ? getOpenClawInputDisabledReason(openClawConnectionState, openClawGatewayName)
          : undefined,
        initialConversationResolving:
          isOpenclaw && (openClawHealthy === null || openClawCurrentConversationResolving),
        showWelcome: !isIndexRoute,
        indexWelcomeLayout: isIndexRoute,
      }),
      [currentAgent, isOpenclaw, lockOpenClawEmbeddedPreviewToCurrentAgent, openClawHealthy, openClawConnectionState, openClawCurrentConversationResolving, openClawGatewayName, showRecommend, isIndexRoute]
    );

    // 推荐智能体列表（用于 Recommend Panel）
    const recommendAgents = useMemo(() => {
      return agentStore.agentList
        .filter((item) => item.agent_id !== currentAgent?.agent_id)
        .slice(0, 4);
    }, [agentStore.agentList, currentAgent]);

    // 推荐智能体选择回调
    const handleRecommendAgentSelect = useCallback((agent: any) => {
      const isAgentOpenclaw = isOpenClawAgent(agent);
      if (isAgentOpenclaw) {
        navigate({
          pathname: "/chat",
          search: `?agent_id=${agent.agent_id}&hide_bottom_actions=true&type=openclaw`,
        });
      } else {
        navigate({
          pathname: "/chat",
          search: `?agent_id=${agent.agent_id}`,
        });
      }
    }, [navigate]);

    // 文件上传函数
    const uploadRequest = useCallback(async (file: File) => {
      const res = await uploadApi.upload(file, "my_uploads");
      return {
        id: res.data.id,
        url: `${API_HOST}/api/preview/${res.data.preview_key || ""}`,
        name: res.data.file_name,
        size: res.data.size,
        mime_type: res.data.mime_type,
        preview_key: res.data.preview_key,
      };
    }, []);

    // 文件类型过滤
    const acceptTypes = useMemo(() => {
      let accept = "";
      const settingsObj = currentAgent?.settings_obj || {};
      if (settingsObj.file_parse?.enable) {
        accept += ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.html,.json,.xml,.md";
      }
      if (settingsObj.image_parse?.enable) {
        accept += ",image/*";
      }
      return accept || "*/*";
    }, [currentAgent]);

    // 分享回调
    const handleShare = async (
      messageIds: (string | number)[],
      convId: string | number,
      selectAll: boolean
    ): Promise<string> => {
      const res = await sharesApi.create({
        message_ids: messageIds,
        conversation_id: convId,
        select_all: selectAll,
      });
      const link = buildUrl(`/share/chat?share_id=${res.share_id}&from=agent`);
      return link;
    };

    // 智能体选择回调
    const handleAgentSelect = (agent: any) => {
      const isAgentOpenclaw = isOpenClawAgent(agent);
      if (isAgentOpenclaw) {
        navigate({
          pathname: "/chat",
          search: `?agent_id=${agent.agent_id}&hide_bottom_actions=true&type=openclaw`,
        });
      } else {
        navigate({
          pathname: "/chat",
          search: `?agent_id=${agent.agent_id}`,
        });
      }
    };

    const handleOpenClawConversationSelect = useCallback((conv: any) => {
      const targetAgentId = conv.agent_id || agentId;
      openClawExplicitSelectionRef.current = true;
      sharedConvStore.setCurrentState(targetAgentId, conv.conversation_id);
      if (!skipOpenClawFrontStoreMirror) {
        convStore.setCurrentState(targetAgentId, conv.conversation_id, false);
      }
      if (!disableOpenClawUrlSync) {
        syncOpenClawConversationUrl(targetAgentId, conv.conversation_id);
      }
      setOpenClawHistoryOpen(false);
    }, [agentId, convStore, disableOpenClawUrlSync, sharedConvStore, skipOpenClawFrontStoreMirror]);

    // 权限检查回调
    const handleCheckPermission = (userGroupIds?: number[]): boolean => {
      const isPersonalAgent = searchParams.get("from") === "my" || Number(currentAgent?.owner_id || 0) > 0;
      return checkUserPermission({
        groupIds: isPersonalAgent ? [] : (userGroupIds || []),
      });
    };

    useImperativeHandle(ref, () => ({
      showUseCase: () => {
        setShowGuide(true);
        // completion 模式需要同步触发 CompletionView 的状态
        if (isCompletion && externalOnGuideChangeRef.current) {
          externalOnGuideChangeRef.current(true);
        }
      },
      hideUseCase: () => {
        setShowGuide(false);
        if (isCompletion && externalOnGuideChangeRef.current) {
          externalOnGuideChangeRef.current(false);
        }
      },
      showShare: () => chatViewRef.current?.showShare(),
    }), [isCompletion]);

    // Plugin 配置
    const pluginConfig = useMemo(
      () => ({
        type: "agent" as const,
        title: currentAgent?.name || "Chat",
        logo: currentAgent?.logo || DEFAULT_IMG,
        features: {
          showRagStats: true,
          showFileUpload: features.fileUpload,
          showConversationList: features.history,
        },
      }),
      [currentAgent, features]
    );

    // Adapters 配置
    const adapters = useMemo(() => {
      const currentConversationApi = isOpenclaw
        ? createOpenClawConversationApiAdapter(agentId)
        : conversationApiAdapter;

      return {
        conversationApi: currentConversationApi,
        agentApi: agentApiAdapter,
        uploadApi: {
          upload: async (file: File) => {
            const res = await uploadApi.upload(file);
            return {
              id: res.data.id,
              url: `${API_HOST}/api/preview/${res.data.preview_key || ""}`,
              name: res.data.file_name,
              size: res.data.size,
              mime_type: res.data.mime_type,
              preview_key: res.data.preview_key,
            };
          },
        },
        workflowApi: {
          run: async (data: any, options?: { signal?: AbortSignal }) => {
            return chatApi.workflow.run(data, {
              signal: options?.signal,
            });
          },
        },
      };
    }, [agentId, isOpenclaw]);

    // 自定义 Header - 使用原来的样式
    const renderHeader = useCallback(
      ({ agentInfo, showGuide: externalShowGuide, onGuideChange: externalOnGuideChange }: {
        agentInfo: any;
        lang: string;
        setLang: (lang: string) => void;
        showGuide?: boolean;
        onGuideChange?: (show: boolean) => void;
      }) => {
        if (embeddedOpenClawPreview && isOpenclaw) {
          const gatewayName = openClawGatewayName;
          const statusText = openClawHealthy === true
            ? `${gatewayName} 已连接`
            : openClawHealthy === false
              ? `${gatewayName} 未连接`
              : `${gatewayName} 检测中`;

          return (
            <header className="flex-none h-[60px] border-b bg-white">
              <div className="openclaw-embedded-header grid h-full items-center gap-3 px-4">
                <div className="openclaw-embedded-header-title flex min-w-0 items-center text-base font-medium text-[#1F2123]">
                  预览与调试
                </div>
                <div
                  data-testid="openclaw-history-selector"
                  className="openclaw-embedded-history-selector min-w-0 justify-self-center w-full max-w-[240px]"
                >
                  <Popover
                    rootClassName="openclaw-history-popover-root"
                    trigger="click"
                    placement="bottom"
                    open={openClawHistoryOpen}
                    onOpenChange={setOpenClawHistoryOpen}
                    arrow={false}
                    styles={{ body: { padding: 0 } }}
                    content={
                      <div className="openclaw-history-popover w-full rounded-[14px] bg-white p-3 shadow-[0_12px_30px_rgba(31,33,35,0.10)]">
                        {openClawHealthy !== true ? (
                          <div className="px-3 py-5 text-center text-sm text-[#A0A7B5]">
                            {getOpenClawInputDisabledReason(openClawConnectionState, gatewayName)}
                          </div>
                        ) : openClawConversationOptions.length > 0 ? (
                          <div
                            ref={openClawHistoryListRef}
                            className="max-h-[440px] overflow-y-auto pr-1"
                            onScroll={handleOpenClawHistoryScroll}
                          >
                            {openClawConversationOptions.map((item, index) => {
                              const selected = String(item.conversation_id) === String(selectedConversationId);
                              return (
                                <button
                                  key={item.conversation_id || `openclaw-embedded-conv-${index}`}
                                  type="button"
                                  data-conversation-id={String(item.conversation_id || "")}
                                  className={`openclaw-history-row flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[15px] leading-5 transition ${
                                    selected ? "bg-[#F4F5F7] text-[#2F3136]" : "text-[#2F3136] hover:bg-[#F7F8FA]"
                                  }`}
                                  onClick={() => handleOpenClawConversationSelect(item)}
                                >
                                  <TopicIcon className={selected ? "opacity-70" : "opacity-45"} />
                                  <span className="truncate">{item.title || "无标题会话"}</span>
                                </button>
                              );
                            })}
                            {(openClawHistoryVisibleCount < visibleConversations.length || openClawConversationPagination?.hasMore) && (
                              <div className="px-3 py-2 text-center text-xs text-[#A0A7B5]">
                                {openClawHistoryLoading ? "正在加载..." : "向下滚动加载更多"}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="px-3 py-5 text-center text-sm text-[#A0A7B5]">暂无历史会话</div>
                        )}
                      </div>
                    }
                  >
                    <button
                      type="button"
                      className="openclaw-history-trigger flex h-10 w-full min-w-0 items-center gap-3 rounded-[12px] border border-[#E6EBF2] bg-[#F5F7FA] px-4 text-left text-[15px] leading-5 text-[#2F3136] shadow-[0_2px_8px_rgba(31,33,35,0.04)] transition hover:bg-[#EEF1F5]"
                    >
                      <TopicIcon className="opacity-85" />
                      <span className="min-w-0 flex-1 truncate">
                        {hasSelectedConversationId && currentConv ? currentConv.title || "当前会话" : "新对话"}
                      </span>
                      {openClawHistoryOpen ? (
                        <UpOutlined className="shrink-0 text-xs text-[#333333]" />
                      ) : (
                        <DownOutlined className="shrink-0 text-xs text-[#333333]" />
                      )}
                    </button>
                  </Popover>
                </div>
                <div className="flex min-w-0 justify-end">
                  <span
                    className={`openclaw-embedded-status-badge inline-flex max-w-full items-center rounded-md px-2.5 py-1 text-xs font-medium ${
                      openClawHealthy === true
                        ? "bg-[#EAFBF1] text-[#24A860]"
                        : openClawHealthy === false
                          ? "bg-[#FFF1F0] text-[#D9363E]"
                          : "bg-[#F4F6FA] text-[#7A8494]"
                    }`}
                    title={statusText}
                  >
                    <span className="openclaw-embedded-status-dot mr-1 text-sm leading-none">•</span>
                    <span className="openclaw-embedded-status-text min-w-0 truncate">{statusText}</span>
                  </span>
                </div>
              </div>
            </header>
          );
        }

        if (hideMenuHeader) return null;

        // 追踪 CompletionView 的 onGuideChange 回调
        externalOnGuideChangeRef.current = externalOnGuideChange ?? null;

        // completion 模式由 CompletionView 内部处理面板，使用外部的 onGuideChange
        // 非 completion 模式由 ChatContainer 自己渲染面板，使用内部的 setShowGuide
        const setGuideVisible = isCompletion && externalOnGuideChange
          ? externalOnGuideChange
          : setShowGuide;

        return (
          <header className={`flex-none h-[60px] ${ isIndexRoute ? '' : 'border-b' } sticky top-0 z-10 bg-white ${isIndexRoute && showHistory ? "" : ""}`}>
            <div className="relative mx-auto flex h-full items-center justify-between px-4">
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                {/* 工作台入口 + 普通智能体：显示历史/新建按钮 */}
                {isIndexRoute && !showHistory && !isOpenclaw ? (
                  <>
                  <div className="flex-none flex items-center gap-3">
                    <div
                      className="size-7 cursor-pointer rounded flex items-center justify-center hover:bg-[#F5F5F7]"
                      onClick={() => setShowHistory(true)}
                    >
                      <SvgIcon name="history" size={16} />
                    </div>
                    <div
                      className="size-7 cursor-pointer rounded flex items-center justify-center hover:bg-[#F5F5F7]"
                      onClick={() => {
                        chatViewRef.current?.newConversation();
                        setShowHistory(false);
                      }}
                    >
                      <SvgIcon name="add-chat" size={16} />
                    </div>
                  </div>
                  <div className="h-4 border-l" />
                  </>
                ) : isIndexRoute ? null : (
                  <>
                    <ExpandSidebarButton />
                    <div className="h-4 border-l" />
                  </>
                ) }
                {isSoftStyle && !isIndexRoute && (
                  <div
                    className="flex-none size-7 rounded-md flex-center cursor-pointer max-md:hidden hover:bg-[#ECEDEE]"
                    onClick={handleBack}
                  >
                    <LeftOutlined className="text-regular cursor-pointer" />
                  </div>
                )}
                {isOpenclaw ? (
                  <div className="flex min-w-0 items-center gap-2">
                    <img
                      className="size-5 shrink-0 rounded-full"
                      src={currentAgentLogo}
                      alt={agentInfo?.name || "Agent"}
                      onError={handleImageError}
                    />
                    <span
                      className="truncate text-base font-medium text-[#2F3136]"
                      title={agentInfo?.name || ""}
                    >
                      {agentInfo?.name || ""}
                    </span>
                    <span
                      className={`size-2 shrink-0 rounded-full ${
                        openClawHealthy === false
                          ? "bg-[#FF4D4F]"
                          : openClawHealthy === true
                            ? "bg-[#28C76F]"
                            : "bg-[#C5CBD5]"
                      }`}
                      title={openClawHealthy === false ? `${openClawGatewayName} 当前不可用` : openClawHealthy === true ? `${openClawGatewayName} 已连接` : `${openClawGatewayName} 状态检测中`}
                    />
                  </div>
                ) : (
                  <>
                    
                    <div
                      className="text-base text-primary line-clamp-1 max-md:flex-1 max-md:text-center"
                      title={currentConv?.title || agentInfo?.name || ""}
                    >
                      {currentConv?.title || agentInfo?.name || ""}
                    </div>
                  </>
                )}
                {isOpenclaw && (
                <div
                  data-testid="openclaw-history-selector"
                  className="ml-4 mr-4 hidden min-w-0 flex-1 max-w-[520px] md:block"
                >
                  <Popover
                    rootClassName="openclaw-history-popover-root"
                    trigger="click"
                    placement="bottom"
                    open={openClawHistoryOpen}
                    onOpenChange={setOpenClawHistoryOpen}
                    arrow={false}
                    styles={{ body: { padding: 0 } }}
                    content={
                      <div className="openclaw-history-popover w-full rounded-[14px] bg-white p-3 shadow-[0_12px_30px_rgba(31,33,35,0.10)]">
                        {isOpenclaw && openClawHealthy !== true ? (
                          <div className="px-3 py-5 text-center text-sm text-[#A0A7B5]">
                            {getOpenClawInputDisabledReason(openClawConnectionState, openClawGatewayName)}
                          </div>
                        ) : openClawConversationOptions.length > 0 ? (
                          <div
                            ref={openClawHistoryListRef}
                            className="max-h-[440px] overflow-y-auto pr-1"
                            onScroll={handleOpenClawHistoryScroll}
                          >
                            {openClawConversationOptions.map((item, index) => {
                              const selected = String(item.conversation_id) === String(selectedConversationId);
                              return (
                                <button
                                  key={item.conversation_id || `openclaw-conv-${index}`}
                                  type="button"
                                  data-conversation-id={String(item.conversation_id || "")}
                                  className={`openclaw-history-row flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[15px] leading-5 transition ${
                                    selected ? "bg-[#F4F5F7] text-[#2F3136]" : "text-[#2F3136] hover:bg-[#F7F8FA]"
                                  }`}
                                  onClick={() => handleOpenClawConversationSelect(item)}
                                >
                                  <TopicIcon className={selected ? "opacity-70" : "opacity-45"} />
                                  <span className="truncate">{item.title || "无标题会话"}</span>
                                </button>
                              );
                            })}
                            {(openClawHistoryVisibleCount < visibleConversations.length || openClawConversationPagination?.hasMore) && (
                              <div className="px-3 py-2 text-center text-xs text-[#A0A7B5]">
                                {openClawHistoryLoading ? "正在加载..." : "向下滚动加载更多"}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="px-3 py-5 text-center text-sm text-[#A0A7B5]">暂无历史会话</div>
                        )}
                      </div>
                    }
                  >
                    <button
                      type="button"
                      className="openclaw-history-trigger flex h-10 w-full min-w-0 items-center gap-3 rounded-[12px] border border-[#E6EBF2] bg-[#F5F7FA] px-4 text-left text-[15px] leading-5 text-[#2F3136] shadow-[0_2px_8px_rgba(31,33,35,0.04)] transition hover:bg-[#EEF1F5]"
                    >
                      <TopicIcon className="opacity-85" />
                      <span className="min-w-0 flex-1 truncate">
                        {hasSelectedConversationId && currentConv ? currentConv.title || "当前会话" : "新对话"}
                      </span>
                      {openClawHistoryOpen ? (
                        <UpOutlined className="shrink-0 text-xs text-[#333333]" />
                      ) : (
                        <DownOutlined className="shrink-0 text-xs text-[#333333]" />
                      )}
                    </button>
                  </Popover>
                </div>
              )}
              </div>
              <div className="flex flex-none items-center justify-end gap-2">
                {/* Mobile back button */}
                <span
                  className="flex items-center gap-1 text-sm cursor-pointer md:hidden"
                  onClick={() => navigate(-1)}
                >
                  <SvgIcon name="return" size={18} stroke />
                </span>
                <Tooltip title={t("chat.usage_guide")}>
                  <div
                    role="button"
                    aria-label={t("chat.usage_guide")}
                    className="h-6 px-1 rounded flex-center gap-1 cursor-pointer hover:bg-[#E1E2E3]"
                    onClick={() => {
                      handleCloseOutputFilePreview();
                      setOpenClawPanelOpen(false);
                      setGuideVisible(true);
                    }}
                  >
                    <SvgIcon name="layout-split" size={18} />
                  </div>
                </Tooltip>
                {isOpenclaw && (
                  <Tooltip title="Gateway 设置">
                    <button
                      type="button"
                      aria-label="Gateway 设置"
                      className="size-7 rounded flex-center cursor-pointer border-0 bg-transparent p-0 hover:bg-[#E1E2E3]"
                      onClick={() => {
                        handleCloseOutputFilePreview();
                        setShowGuide(false);
                        setOpenClawPanelOpen(true);
                      }}
                    >
                      <OpenClawToolbarIcon />
                    </button>
                  </Tooltip>
                )}
                <MoreDropdown
                  items={[
                    !isShortcut
                      ? {
                          key: "add-shortcut",
                          icon: "add-mode",
                          label: t("shortcut.add"),
                        }
                      : {
                          key: "remove-shortcut",
                          icon: "delete-mode",
                          label: t("shortcut.remove"),
                        },
                  ].filter(Boolean)}
                  onCommand={handleMore}
                />
              </div>
            </div>
          </header>
        );
      },
      [
        hideMenuHeader,
        isIndexRoute,
        showHistory,
        embeddedOpenClawPreview,
        isSoftStyle,
        handleBack,
        currentConv,
        hasSelectedConversationId,
        currentAgentLogo,
        handleImageError,
        navigate,
        isOpenclaw,
        openClawHealthy,
        openClawGatewayName,
        openClawHistoryOpen,
        openClawConversationOptions,
        openClawConversationPagination,
        openClawHistoryLoading,
        openClawHistoryVisibleCount,
        visibleConversations.length,
        handleOpenClawHistoryScroll,
        selectedConversationId,
        handleOpenClawConversationSelect,
        handleCloseOutputFilePreview,
        isShortcut,
        handleMore,
        agentId,
        convStore,
        setShowGuide,
        isCompletion,
      ]
    );

    const hasRightPane = Boolean(
      (showGuide && currentAgent && !isCompletion) ||
      openClawPanelOpen ||
      outputFilePreview.visible
    );

    return (
      <ChatConfigProvider lang={locale}>
        <ChatProvider config={pluginConfig} adapters={adapters}>
          <div className={`flex h-full min-w-0 ${embeddedOpenClawPreview ? "openclaw-embedded-workspace overflow-x-hidden" : ""} ${hasRightPane ? "gap-0" : ""} ${className || ""}`}>
            {/* 工作台入口历史侧边栏 - 放在最左边 */}
            {isIndexRoute && showHistory && (
              <div className="w-60 flex-shrink-0">
                <ChatHistory
                  sidebarMode
                  open={showHistory}
                  onClose={() => setShowHistory(false)}
                  onNew={() => {
                    chatViewRef.current?.newConversation();
                    setShowHistory(false);
                  }}
                />
              </div>
            )}
            {/* 聊天区域 */}
            <div className={`min-w-0 flex-1 flex flex-col overflow-hidden ${hasRightPane ? "border-r" : ""}`}>
              <ChatView
                key={chatViewKey}
                ref={chatViewRef}
                agentId={agentId}
                initialConversationId={chatViewInitialConversationId}
                syncToUrl={!disableOpenClawUrlSync}
                features={features}
                agentInfo={chatAgentInfo}
                onShare={handleShare}
                renderHeader={renderHeader}
                renderAgentSelector={features.agentTooltip ? ({ agentInfo }) => (
                  <AgentTooltip onSelect={handleAgentSelect}>
                    <div className="h-8 px-2 rounded-full flex items-center gap-1.5 bg-[#F1F2F3] cursor-pointer hover:bg-[#E1E2E3]">
                      {!isOpenclaw && (
                        <img
                          className="w-4 h-4 rounded-full"
                          src={agentInfo.logo || DEFAULT_IMG}
                          alt={agentInfo.name}
                          onError={handleImageError}
                        />
                      )}
                      <span className="text-sm text-[#1F2123] line-clamp-1 max-w-[120px]">
                        {agentInfo.name}
                      </span>
                      <DownOutlined style={{ color: "#333333", fontSize: "12px" }} />
                    </div>
                  </AgentTooltip>
                ) : undefined}
                renderAuthTags={lockOpenClawEmbeddedPreviewToCurrentAgent ? undefined : (userGroupIds?: number[]) => (
                  <AuthTagGroup value={userGroupIds} />
                )}
                checkPermission={handleCheckPermission}
                recommendAgents={recommendAgents}
                onRecommendAgentSelect={handleRecommendAgentSelect}
                onNextAgent={handleNextAgent}
                onInitAgent={handleInitAgent}
                onOutputFilePreview={isOpenclaw ? handleOpenOutputFilePreview : undefined}
                onAddAsMd={isOpenclaw ? handleAddOpenClawAnswerAsMd : undefined}
                uploadRequest={uploadRequest}
                acceptTypes={acceptTypes}

                onMessageSent={() => {
                  // 通知侧边栏刷新快捷方式列表（更新 last_message_time）
                  eventBus.emit(EVENT_NAMES.SHORTCUT_UPDATED);
                }}

                />
            </div>
            {/* 使用指引右侧面板 - completion 模式由 CompletionView 内部处理 */}
            {showGuide && currentAgent && !isCompletion && (
              <div className="flex-none w-[450px] flex flex-col bg-white overflow-hidden">
                <div className="h-15 flex items-center justify-between px-5 border-b">
                  <h4 className="text-lg text-primary">{t("chat.usage_guide")}</h4>
                  <div
                    className="flex-center size-6 rounded cursor-pointer hover:bg-[#ECEDEE]"
                    onClick={() => setShowGuide(false)}
                  >
                    <CloseOutlined />
                  </div>
                </div>
                <UsageGuide useCases={currentAgent.use_cases} showChannel={isOpenclaw} />
              </div>
            )}
            {isOpenclaw && openClawPanelOpen && !embeddedOpenClawPreview && (
              <div
                data-testid="openclaw-side-panel"
                className="flex-none w-[450px] flex flex-col bg-white overflow-hidden border-l"
              >
                <OpenClawPanel
                  agentId={agentId}
                  open={openClawPanelOpen}
                  status={openClawStatusPayload}
                  connectionState={openClawConnectionState}
                  statusLoading={openClawStatusLoading}
                  onRefreshStatus={refreshOpenClawStatus}
                  onClose={() => setOpenClawPanelOpen(false)}
                />
              </div>
            )}
            {isOpenclaw && outputFilePreview.visible && (
              <div
                data-testid="openclaw-output-file-preview-pane"
                className="w-1/2 h-full border-l flex flex-col bg-white"
              >
                <div className="flex items-center gap-2 px-4 py-3 border-b">
                  <div className="flex-1 text-base text-[#1D1E1F] truncate">
                    {outputFilePreview.currentFile.name || "--"}
                  </div>
                  {outputFilePreview.currentFile.file_url && (
                    <Button
                      color="primary"
                      variant="link"
                      onClick={handleDownloadOutputFile}
                    >
                      {t("action.download")}
                      <SvgIcon name="download" size={14} />
                    </Button>
                  )}
                  <button
                    type="button"
                    aria-label="关闭文件预览"
                    className="size-7 cursor-pointer rounded flex items-center justify-center border-0 bg-transparent p-0 hover:bg-[#F5F5F7]"
                    onClick={handleCloseOutputFilePreview}
                  >
                    <SvgIcon name="close" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <FileViewer
                    url={outputFilePreview.currentFile.file_url}
                    content={outputFilePreview.currentFile.content}
                    extension={outputFilePreview.currentFile.file_ext}
                  />
                </div>
              </div>
            )}
            {isOpenclaw && <AddAnswerAsMd ref={addAnswerAsMdRef} />}
          </div>
        </ChatProvider>
      </ChatConfigProvider>
    );
  }
);

ChatContainer.displayName = "ChatContainer";

export default ChatContainer;
