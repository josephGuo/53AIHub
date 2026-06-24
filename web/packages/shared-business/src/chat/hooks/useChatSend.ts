import { useRef, useCallback, useState } from "react";
import type { IConversationApi, ChatCompletionParams } from "../adapters/types";
import type { Message, SendMessageOptions, Skill, MessageFile, SpecifiedFile } from "../types";
import {
  getOpenClawMessageListMaxActivitySeq,
  getOpenClawTimelineMaxSeq,
  mergeOpenClawActiveMessageIntoList,
  mergeOpenClawTimelineEventsIntoMessage,
  replaceOpenClawTurnWithTimelineEvents,
  useChatStream,
} from "./useChatStream";
import { useRagStats } from "./useRagStats";
import { isOpenClawPendingConversationId } from "../utils/openclaw";
import { getOpenClawTimelineEventsFromLedgerPayload } from "../utils/openclaw-ledger";
import { buildOpenClawTurnKey, createOpenClawTurnState } from "../utils/openclaw-turn";

/**
 * 格式化问题：添加技能前缀
 */
function formatQuestionWithSkill(question: string, skill?: Skill): string {
  return skill?.skill_name && skill?.display_name
    ? `/${skill.skill_name} ${question}`
    : question;
}

/**
 * 构建文件内容项（用于 user 消息中的文件）
 */
function buildFileContent(file: any, useUploadId: boolean = false): any | null {
  const fileId = useUploadId ? file.upload_file_id : file.id;
  if (!fileId) return null;
  return {
    type: "file",
    content: `file_id:${fileId}`,
    filename: file.name,
    size: file.file_size ?? file.size,
    mime_type: file.file_mime ?? file.mime_type,
    preview_key: file.preview_key,
  };
}

/**
 * 构建 specified_files（用于 info 消息）
 */
function buildSpecifiedFilesInfo(links: SpecifiedFile[]): { content: string; role: string } {
  return {
    content: JSON.stringify({
      type: "specified_files",
      list: links.map((item) => ({
        id: item.id,
        name: item.name,
        library_id: item.library_id,
        ...(item.isfolder !== undefined && { isfolder: item.isfolder }),
      })),
    }),
    role: "info",
  };
}

/**
 * 构建 specified_content（用于 info 消息）
 */
function buildSpecifiedContentInfo(text: string): { content: string; role: string } {
  return {
    content: JSON.stringify({ type: "specified_content", content: text }),
    role: "info",
  };
}

function hasUsableConversationId(conversationId?: string | number) {
  return Boolean(conversationId) && conversationId !== 0 && conversationId !== "0";
}

type OpenClawTurnPhase = "idle" | "queued" | "dispatching" | "stopping";

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

function hasOpenClawEventsAfterSeq(payload: any, afterSeq: number): boolean {
  return getOpenClawTimelineEvents(payload).some((event) => {
    const seq = typeof event?.seq === "number" ? event.seq : Number(event?.seq);
    return Number.isFinite(seq) && seq > afterSeq;
  });
}

function isCanceledError(err: any) {
  return err?.message === "canceled" || err?.code === "ERR_CANCELED" || err?.name === "CanceledError";
}

function getOpenClawErrorMessage(err: any): string {
  const message =
    err?.response?.data?.message ||
    err?.response?.data?.error?.message ||
    err?.message ||
    "";
  if (/插件未连接|plugin.*connect|not connected/i.test(message)) {
    return "OpenClaw 插件未连接";
  }
  if (/timeout|超时/i.test(message)) {
    return "OpenClaw 响应超时";
  }
  if (/gateway/i.test(message)) {
    return "Gateway 当前不可用";
  }
  return message || "OpenClaw 请求失败";
}

function hasOpenClawTerminalState(message: Message): boolean {
  const status = message.openclawTurn?.status;
  return Boolean(
    message.interrupted ||
      message.error ||
      status === "completed" ||
      status === "failed" ||
      status === "interrupted"
  );
}

/**
 * Chat Message Sending Hook
 * Uses injected conversation API adapter for actual API calls
 *
 * 支持请求锁机制：防止并发请求覆盖 currentMessageRef
 */
export function useChatSend(conversationApi: IConversationApi) {
  const { processStreamData, clearBuffer } = useChatStream();
  const { formatRagStats } = useRagStats();

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentMessageRef = useRef<Message | null>(null);
  const messageListChangeRef = useRef<SendMessageOptions["onMessageListChange"] | null>(null);
  const openClawRequestRef = useRef(false);
  const openClawStopPromiseRef = useRef<Promise<void> | null>(null);
  const openClawTurnPhaseRef = useRef<OpenClawTurnPhase>("idle");
  /** 请求锁：防止并发请求覆盖 currentMessageRef */
  const requestIdRef = useRef(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const sendMessage = useCallback(
    async (options: SendMessageOptions) => {
      const {
        question,
        agent_id,
        conversation_id,
        modelId = "",
        completion_params = {},
        messageList = [],
        links = [],
        networkSearch = false,
        knowledgeGraph = false,
        library,
        agentInfo,
        files = [],
        fileInfo,
        options: sendOptions = {},
        minimalParams = false,
        openclaw = false,
        openclawStartSeq = 0,
        openclawConversationTitle,
        skill,
        type = "",
        onMessageListChange,
        onOpenClawConversationResolved,
        onOpenClawEventSeqChange,
      } = options;

      if (openclaw && openClawStopPromiseRef.current) {
        return;
      }

      // ========== 清理上一次请求状态 ==========
      clearBuffer();
      const requestId = ++requestIdRef.current;
      openClawRequestRef.current = openclaw;
      messageListChangeRef.current = onMessageListChange || null;

      // ========== 场景标识 ==========
      const isFromWorkAI = type === "work-ai";
      const isAgentType = type === "agent";
      const hasFiles = files.length > 0;
      const hasLinks = links.length > 0;

      // ========== 1. 构建用户消息内容 ==========
      const formattedQuestion = formatQuestionWithSkill(question, skill);
      const userMessageContent: any[] = [{ type: "text", content: formattedQuestion }];
      const uploadedFiles: MessageFile[] = [];
      const specifiedFiles: SpecifiedFile[] = [];

      if (isAgentType && hasFiles) {
        // agent 场景：文件直接序列化
        userMessageContent.push(...files);
        uploadedFiles.push(...(files as MessageFile[]));
      } else if (hasFiles || hasLinks) {
        // 其他场景：文件转为 file_id 格式
        files.forEach((file) => {
          const item = buildFileContent(file);
          if (item) userMessageContent.push(item);
        });
        uploadedFiles.push(...(files as MessageFile[]));

        // work-ai 场景：links 也用 upload_file_id 加入 user 消息
        links.forEach((file) => {
          const item = buildFileContent(file, isFromWorkAI);
          if (item) userMessageContent.push(item);
        });
      }

      // UI 展示用的 specified_files
      if (hasLinks) {
        specifiedFiles.push(
          ...links.map((item) => ({
            id: item.id,
            name: item.name,
            icon: item.icon,
            library_id: item.library_id,
            ...(item.file_size && { file_size: item.file_size }),
            ...(item.file_mime && { file_mime: item.file_mime }),
          }))
        );
      }

      // ========== 2. 构建 API messages ==========
      const messages: any[] = [];

      // system prompt
      if (sendOptions.prompt) {
        messages.push({ content: sendOptions.prompt, role: "system" });
      }

      // specified_content
      if (sendOptions.text) {
        messages.push(buildSpecifiedContentInfo(sendOptions.text));
      }

      // specified_files（非 work-ai 场景）
      if (!isFromWorkAI && hasLinks) {
        messages.push(buildSpecifiedFilesInfo(links as SpecifiedFile[]));
      }

      // user 消息
      const userContent = hasFiles || hasLinks ? JSON.stringify(userMessageContent) : formattedQuestion;
      messages.push({ role: "user", content: userContent });

      // ========== 3. 创建 UI 消息对象 ==========
      const optimisticMessageId = Date.now().toString();
      const openClawRequestMetadata = openclaw
        ? {
            ...(openclawConversationTitle
              ? { openclaw_conversation_title: openclawConversationTitle }
              : {}),
            openclaw_client_message_id: optimisticMessageId,
          }
        : undefined;
      const effectiveOpenClawStartSeq = openclaw
        ? Math.max(
            Number.isFinite(Number(openclawStartSeq)) ? Number(openclawStartSeq) : 0,
            getOpenClawMessageListMaxActivitySeq(messageList || [], conversation_id)
          )
        : 0;
      const newMessage: Message = {
        id: optimisticMessageId,
        _openclawClientMessageId: openclaw ? optimisticMessageId : undefined,
        _openclawActiveRequestId: openclaw ? optimisticMessageId : undefined,
        question,
        answer: "",
        loading: true,
        agent_id: String(agent_id),
        conversation_id: String(conversation_id ?? ""),
        reasoning_content: "",
        reasoning_expanded: true,
        specified_files: specifiedFiles,
        uploaded_files: uploadedFiles,
        specified_content: sendOptions.text || "",
        skill: skill || { skill_name: "", display_name: "" },
        process_records: [],
        rag_stats: null,
        rag_search_text: "",
        rag_temp: { type: "rag_search" },
        knowledge_graph: knowledgeGraph,
        ...(openclaw ? { _openclawTurnStartSeq: effectiveOpenClawStartSeq } : {}),
        ...(openclaw
          ? {
              openclawTurn: createOpenClawTurnState({
                sessionId: String(conversation_id ?? ""),
                turnKey: buildOpenClawTurnKey({
                  sessionId: String(conversation_id ?? ""),
                  clientMessageId: optimisticMessageId,
                  messageId: optimisticMessageId,
                  turnStartSeq: effectiveOpenClawStartSeq,
                }),
                status: "streaming",
              }),
            }
          : {}),
      };

      currentMessageRef.current = newMessage;

      // 添加消息到列表
      onMessageListChange?.((list) => [...list, newMessage], newMessage);

      if (openclaw) {
        openClawTurnPhaseRef.current = "dispatching";
      }

      // ========== 4. 构建请求参数 ==========
      const model = `agent-${agent_id}${modelId ? `-${modelId}` : ""}`;
      const rerankConfig = agentInfo?.settings?.rerank_config || {};
      const webSearchConfig = agentInfo?.settings?.web_search_setting || {};

      const completionsPayload: ChatCompletionParams = minimalParams
        ? {
            conversation_id,
            model,
            messages,
            ...(openClawRequestMetadata ? { metadata: openClawRequestMetadata } : {}),
            frequency_penalty: 0,
            presence_penalty: 0,
            stream: true,
            temperature: 0,
            top_p: 0,
            ...completion_params,
          }
        : {
            conversation_id,
            model,
            messages,
            ...(openClawRequestMetadata ? { metadata: openClawRequestMetadata } : {}),
            enable_process_steps: true,
            frequency_penalty: 0,
            temperature: 0.5,
            top_p: 1,
            presence_penalty: 0,
            stream: true,
            knowledge_base_ids:
              networkSearch || hasLinks ? [] : library?.value || (fileInfo ? [] : [-1]),
            file_ids: hasLinks ? links.map((item) => item.id) : [],
            message_file_id: fileInfo?.id,
            solo_file_mode: !!fileInfo,
            search_config: {
              ...rerankConfig,
              top_k: networkSearch ? webSearchConfig.top_k || rerankConfig.top_k : rerankConfig.top_k,
            },
            web_search_config: networkSearch ? webSearchConfig : {},
            enable_graph_search: knowledgeGraph,
            ...completion_params,
          };

      // ========== 5. 发送请求 ==========
      abortControllerRef.current = new AbortController();
      let processedLength = 0;
      let lastUpdateTime = 0;
      let openClawConversationResolved = false;
      let openClawEventConversationId = "";
      let openClawEventTimer: ReturnType<typeof setTimeout> | null = null;
      let openClawEventPollingStopped = false;
      let openClawEventFetchInFlight = false;
      let openClawLastEventSeq = openclaw
        ? effectiveOpenClawStartSeq
        : 0;
      const UPDATE_INTERVAL = 100;
      const OPENCLAW_EVENT_POLL_INTERVAL = 800;
      const OPENCLAW_FINAL_RECONCILE_DELAYS = [0, 300, 900, 2500, 5500, 8500, 15000, 30000, 60000];
      const initialConversationId = String(conversation_id ?? "");

      const publishMessageList = (messageToPublish: Message = newMessage) => {
        onMessageListChange?.((list) => [...list], messageToPublish);
      };

      const publishReconciledOpenClawMessage = (messageToPublish: Message, conversationId: string) => {
        onMessageListChange?.(
          (list) => mergeOpenClawActiveMessageIntoList([...list], messageToPublish, conversationId),
          messageToPublish
        );
      };

      const hydrateOpenClawEvents = async (
        conversationId: string,
        force = false,
        messageToHydrate?: Message
      ): Promise<boolean> => {
        if (!openclaw || (!conversationApi.events && !conversationApi.snapshot) || !conversationId) return false;
        if (!hasUsableConversationId(conversationId) || isOpenClawPendingConversationId(conversationId)) return false;
        if (openClawEventFetchInFlight && !force) return false;
        const targetMessage = messageToHydrate || currentMessageRef.current;
        if (!targetMessage) return false;

        openClawEventFetchInFlight = true;
        try {
          const turnStartSeq = Number.isFinite(Number(targetMessage._openclawTurnStartSeq))
            ? Number(targetMessage._openclawTurnStartSeq)
            : 0;
          const requestAfterSeq = force ? turnStartSeq : openClawLastEventSeq;
          const response = conversationApi.snapshot
            ? await conversationApi.snapshot(conversationId, {
                ...(requestAfterSeq > 0 ? { after_seq: requestAfterSeq } : {}),
              })
            : await conversationApi.events!(conversationId, {
                limit: 100,
                ...(requestAfterSeq > 0 ? { after_seq: requestAfterSeq } : {}),
              });
          if (!force && (requestId !== requestIdRef.current || !currentMessageRef.current)) return false;

          const rawPayload = response?.data ?? response;
          const payload = force
            ? rawPayload
            : withOpenClawEventsAfterSeq(rawPayload, requestAfterSeq);
          if (!force && !hasOpenClawEventsAfterSeq(rawPayload, requestAfterSeq)) {
            return false;
          }
          const nextSeq = getOpenClawTimelineMaxSeq(payload);
          if (nextSeq > openClawLastEventSeq) {
            openClawLastEventSeq = nextSeq;
            onOpenClawEventSeqChange?.(conversationId, nextSeq);
          }
          const changed = force
            ? replaceOpenClawTurnWithTimelineEvents(targetMessage, payload, { canonicalOnly: true })
            : mergeOpenClawTimelineEventsIntoMessage(targetMessage, payload, { canonicalOnly: true });
          if (changed) {
            if (force) {
              publishReconciledOpenClawMessage(targetMessage, conversationId);
            } else {
              publishMessageList(targetMessage);
            }
          }
          return changed;
        } catch {
          // Event hydration is an enhancement for OpenClaw realtime UI. Chat streaming remains authoritative.
          return false;
        } finally {
          openClawEventFetchInFlight = false;
        }
      };

      const finishOpenClawLoadingIfReady = (
        messageToFinish: Message,
        conversationId: string
      ): boolean => {
        if (!messageToFinish.loading) return false;
        if (!hasOpenClawTerminalState(messageToFinish)) {
          return false;
        }
        messageToFinish.loading = false;
        publishReconciledOpenClawMessage(messageToFinish, conversationId);
        return true;
      };

      const reconcileFinalOpenClawEvents = async (conversationId: string, messageToReconcile: Message) => {
        for (const delayMs of OPENCLAW_FINAL_RECONCILE_DELAYS) {
          if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
          await hydrateOpenClawEvents(conversationId, true, messageToReconcile);
          finishOpenClawLoadingIfReady(messageToReconcile, conversationId);
        }
      };

      const finishOpenClawRequest = async (currentMessage: Message) => {
        const finalConversationId = String(currentMessage.conversation_id || openClawEventConversationId || "");
        if (!hasUsableConversationId(finalConversationId)) {
          currentMessage.loading = false;
          publishMessageList(currentMessage);
          return;
        }
        await hydrateOpenClawEvents(finalConversationId, true, currentMessage);
        if (!finishOpenClawLoadingIfReady(currentMessage, finalConversationId)) {
          publishMessageList(currentMessage);
        }
        void reconcileFinalOpenClawEvents(finalConversationId, currentMessage);
      };

      const scheduleOpenClawEventPolling = (conversationId: string) => {
        if (!openclaw || (!conversationApi.events && !conversationApi.snapshot)) return;
        if (!hasUsableConversationId(conversationId) || isOpenClawPendingConversationId(conversationId)) return;

        openClawEventConversationId = conversationId;
        if (openClawEventPollingStopped || openClawEventTimer) return;

        openClawEventTimer = setTimeout(() => {
          openClawEventTimer = null;
          void hydrateOpenClawEvents(openClawEventConversationId).finally(() => {
            scheduleOpenClawEventPolling(openClawEventConversationId);
          });
        }, OPENCLAW_EVENT_POLL_INTERVAL);
      };

      const stopOpenClawEventPolling = () => {
        openClawEventPollingStopped = true;
        if (openClawEventTimer) {
          clearTimeout(openClawEventTimer);
          openClawEventTimer = null;
        }
      };

      const notifyOpenClawConversationResolved = () => {
        if (!openclaw || openClawConversationResolved || !currentMessageRef.current) return;
        const nextConversationId = String(currentMessageRef.current.conversation_id || "");
        if (!hasUsableConversationId(nextConversationId)) return;
        if (isOpenClawPendingConversationId(nextConversationId)) return;
        if (nextConversationId === initialConversationId) return;

        openClawConversationResolved = true;
        scheduleOpenClawEventPolling(nextConversationId);
        onOpenClawConversationResolved?.(nextConversationId);
      };

      if (openclaw && hasUsableConversationId(initialConversationId) && !isOpenClawPendingConversationId(initialConversationId)) {
        scheduleOpenClawEventPolling(initialConversationId);
      }

      setIsStreaming(true);
      try {
        await conversationApi.completions(completionsPayload, {
          responseType: "stream",
          onDownloadProgress: (e: any) => {
            // 检查请求是否已被新请求覆盖
            if (requestId !== requestIdRef.current) return;
            if (!currentMessageRef.current) return;

            processedLength = processStreamData(
              e,
              processedLength,
              currentMessageRef.current,
              networkSearch,
              formatRagStats,
              { openclaw, canonicalOnly: openclaw }
            );
            notifyOpenClawConversationResolved();

            // 节流触发 React 重渲染
            const now = Date.now();
            if (now - lastUpdateTime >= UPDATE_INTERVAL && onMessageListChange) {
              lastUpdateTime = now;
              publishMessageList();
            }
          },
          signal: abortControllerRef.current.signal,
        });
      } catch (err: any) {
        // 旧请求被覆盖时静默忽略错误
        if (requestId !== requestIdRef.current) return;

        if (isCanceledError(err)) {
          return;
        }

        if (err.message !== "canceled") {
          const currentMessage = currentMessageRef.current;
          if (currentMessage && !currentMessage.answer) {
            currentMessage.answer = openclaw ? getOpenClawErrorMessage(err) : err.response?.data || "网络错误";
            currentMessage.error = true;
          }
        }
        throw err;
      } finally {
        // 只有当前请求才更新状态
        if (requestId === requestIdRef.current) {
          const currentMessage = currentMessageRef.current;
          stopOpenClawEventPolling();
          abortControllerRef.current = null;
          clearBuffer();
          setIsStreaming(false);
          if (openclaw && currentMessage) {
            void finishOpenClawRequest(currentMessage);
          } else if (currentMessage) {
            currentMessage.loading = false;
            if (onMessageListChange) publishMessageList(currentMessage);
          } else if (onMessageListChange) {
            publishMessageList();
          }
          if (openclaw) {
            openClawTurnPhaseRef.current = "idle";
          }
        }
      }
    },
    [conversationApi, processStreamData, clearBuffer, formatRagStats]
  );

  /** 停止生成 */
  const handleStop = useCallback(() => {
    if (openClawStopPromiseRef.current) {
      return;
    }

    // 立即使当前流式请求失效，避免被 abort 的旧请求在 finally 中继续刷新 events
    // 或清理下一轮请求的 AbortController。
    requestIdRef.current += 1;

    const currentMessage = currentMessageRef.current;
    const currentPhase = openClawTurnPhaseRef.current;
      if (openClawRequestRef.current && currentMessage) {
        currentMessage.interrupted = true;
        currentMessage.error = false;
        currentMessage.loading = false;
        if (currentMessage.openclawTurn) {
          currentMessage.openclawTurn = {
            ...currentMessage.openclawTurn,
            status: "interrupted",
          };
        }
        if (!currentMessage.answer?.trim()) {
          currentMessage.answer = "本次运行已中断";
        }
      messageListChangeRef.current?.((list) => [...list], currentMessage);
    }

    if (currentPhase === "queued") {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      openClawRequestRef.current = false;
      currentMessageRef.current = null;
      openClawTurnPhaseRef.current = openClawStopPromiseRef.current ? "stopping" : "idle";
      clearBuffer();
      setIsStreaming(false);
      return;
    }

    const controlOpenClawConversation = conversationApi.control;
    const shouldStopRemoteOpenClawRequest =
      openClawRequestRef.current &&
      currentMessage &&
      hasUsableConversationId(currentMessage.conversation_id) &&
      !isOpenClawPendingConversationId(currentMessage.conversation_id) &&
      controlOpenClawConversation;

    if (shouldStopRemoteOpenClawRequest) {
      let trackedStopPromise: Promise<void>;
      const remoteStopPromise = Promise.resolve(
        controlOpenClawConversation(String(currentMessage.conversation_id), { action: "stop" })
      )
        .catch(() => {
          // The local stream is still stopped below; the UI will surface the next status refresh/error if the remote stop fails.
        });
      trackedStopPromise = remoteStopPromise.finally(() => {
        if (openClawStopPromiseRef.current === trackedStopPromise) {
          openClawStopPromiseRef.current = null;
        }
        if (openClawTurnPhaseRef.current === "stopping") {
          openClawTurnPhaseRef.current = "idle";
        }
        setIsStopping(false);
      });
      openClawStopPromiseRef.current = trackedStopPromise;
      openClawTurnPhaseRef.current = "stopping";
      setIsStopping(true);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    openClawRequestRef.current = false;
    currentMessageRef.current = null;
    if (!openClawStopPromiseRef.current) {
      openClawTurnPhaseRef.current = "idle";
    }
    clearBuffer();
    setIsStreaming(false);
  }, [clearBuffer, conversationApi]);

  /** 获取当前 AbortController */
  const getAbortController = useCallback(() => abortControllerRef.current, []);

  return {
    sendMessage,
    handleStop,
    isStreaming,
    isStopping,
    getAbortController,
  };
}

export default useChatSend;
