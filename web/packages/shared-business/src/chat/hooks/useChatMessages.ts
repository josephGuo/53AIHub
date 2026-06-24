import { useState, useCallback, useRef } from "react";
import type { Message, Skill, MessageFile, SpecifiedFile, ProcessRecord } from "../types";
import { parseJson } from "./useChatStream";
import { useRagStats } from "./useRagStats";

interface FileInfo {
  id: string;
  file_name: string;
  url: string;
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
}

function processRecordsToOutputFiles(records: ProcessRecord[]): FileInfo[] {
  const outputFiles: FileInfo[] = [];
  const indexByKey = new Map<string, number>();

  const appendFiles = (files: any[]) => {
    files.forEach((file: any) => {
      if (!file || typeof file !== "object") return;
      const fileName = file.file_name ?? file.fileName ?? file.filename ?? file.name;
      const mimeType = file.mime_type ?? file.mimeType ?? file.mime;
      const base64 = typeof file.base64 === "string" && file.base64.trim() ? file.base64.trim() : "";
      const content = typeof file.content === "string" ? file.content : undefined;
      const filePath = typeof file.file_path === "string" ? file.file_path : typeof file.path === "string" ? file.path : "";
      const downloadUrl = typeof file.download_url === "string" ? file.download_url : typeof file.downloadUrl === "string" ? file.downloadUrl : "";
      const signedDownloadUrl = typeof file.signed_download_url === "string" ? file.signed_download_url : typeof file.signedDownloadUrl === "string" ? file.signedDownloadUrl : "";
      const rawUrl = typeof file.url === "string" ? file.url : typeof file.href === "string" ? file.href : "";
      const url = signedDownloadUrl || downloadUrl || rawUrl || (base64 ? `data:${mimeType || "application/octet-stream"};base64,${base64}` : undefined);
      const id = file.id ?? file.file_id ?? file.fileId ?? url ?? fileName;
      if (id == null && !url && !fileName) return;
      const key = id != null ? String(id) : `${url || ""}|${fileName || ""}`;
      const incoming = {
        id: String(id ?? key),
        file_name: fileName != null ? String(fileName) : "",
        url: url != null ? String(url) : "",
        download_url: downloadUrl || undefined,
        signed_download_url: signedDownloadUrl || undefined,
        mime_type: mimeType,
        size: typeof file.size === "number" ? file.size : Number.isFinite(Number(file.size)) ? Number(file.size) : undefined,
        kind: file.kind,
        message_id: file.message_id ?? file.messageId,
        source_kind: file.source_kind ?? file.sourceKind,
        base64: base64 || undefined,
        content,
        file_path: filePath || undefined,
      };
      if (key && indexByKey.has(key)) {
        const index = indexByKey.get(key)!;
        const existing = outputFiles[index];
        outputFiles[index] = {
          ...incoming,
          ...existing,
          mime_type: existing.mime_type ?? incoming.mime_type,
          size: existing.size ?? incoming.size,
          kind: existing.kind ?? incoming.kind,
          message_id: existing.message_id ?? incoming.message_id,
          download_url: existing.download_url ?? incoming.download_url,
          signed_download_url: existing.signed_download_url ?? incoming.signed_download_url,
          source_kind: existing.source_kind ?? incoming.source_kind,
          base64: incoming.base64 ?? existing.base64,
          content: incoming.content ?? existing.content,
          file_path: existing.file_path ?? incoming.file_path,
        };
        return;
      }
      if (key) indexByKey.set(key, outputFiles.length);
      outputFiles.push({
        ...incoming,
      });
    });
  };

  for (const record of records) {
    if (record.step_code === "output_files" && record.status === "completed" && record.data) {
      const data = typeof record.data === "string" ? parseJson<{ files?: FileInfo[]; media_attachments?: FileInfo[] }>(record.data as string) : record.data;
      if (Array.isArray(data?.files)) appendFiles(data.files);
      if (Array.isArray(data?.media_attachments)) appendFiles(data.media_attachments);
    }
  }

  return outputFiles;
}

interface UseChatMessagesOptions {
  limit?: number;
  supportSpecifiedContent?: boolean;
  skillList?: any[];
  mySkillList?: any[];
}

interface MessageState {
  messageList: Message[];
  isLoadingMessages: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  offset: number;
}

function JSONParse(json: string, defaultValue: any): any {
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

function readPaginationHasMore(response: any): boolean | undefined {
  const value = response?.data?.pagination?.hasMore ?? response?.pagination?.hasMore;
  return typeof value === "boolean" ? value : undefined;
}

function isOpenClawUiDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search || "");
    return (
      params.get("openclaw_debug") === "1" ||
      params.get("OPENCLAW_LEDGER_DEBUG") === "1" ||
      window.localStorage?.getItem("OPENCLAW_LEDGER_DEBUG") === "1"
    );
  } catch {
    return false;
  }
}

function hashOpenClawText(value?: string | null): string {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function traceOpenClawMessages(label: string, messages: Message[]) {
  if (!isOpenClawUiDebugEnabled()) return;
  const openclawMessages = messages.filter((message: any) => message.openclawTurn || message.openclawProjection || message.openclawTimelineItems);
  if (!openclawMessages.length) return;
  console.info(`[openclaw-ui:${label}] ${JSON.stringify({
    count: messages.length,
    openclawCount: openclawMessages.length,
    messages: openclawMessages.map((message: any) => ({
      id: message.id,
      conversationId: message.conversation_id,
      questionLen: String(message.question || "").length,
      questionHash: hashOpenClawText(message.question),
      answerLen: String(message.answer || "").length,
      answerHash: hashOpenClawText(message.answer),
      timelineCount: message.openclawTimelineItems?.length || 0,
      eventCount: message.openclawTurn?.events?.length || 0,
      status: message.openclawTurn?.status,
      loading: Boolean(message.loading),
    })),
  })}`);
}

export function useChatMessages(options?: UseChatMessagesOptions) {
  const { formatRagStats } = useRagStats();
  const skillList = options?.skillList || [];
  const mySkillList = options?.mySkillList || [];

  const limit = options?.limit || 10;
  const supportSpecifiedContent = options?.supportSpecifiedContent || false;

  const [state, setState] = useState<MessageState>({
    messageList: [],
    isLoadingMessages: false,
    isLoadingMore: false,
    hasMore: true,
    offset: 0,
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const loadMoreRequestSeqRef = useRef(0);
  const loadMessageListRequestSeqRef = useRef(0);

  const loadMessages = useCallback(
    async (
      messages: any[],
      limit: number,
      skipFeedback: boolean = true,
      options?: { skillList?: any[]; mySkillList?: any[] }
    ): Promise<{ messages: Message[]; hasMore: boolean }> => {
      const validSkillList = options?.skillList || skillList;
      const validMySkillList = options?.mySkillList || mySkillList;

      try {
        const list: Message[] = [];

        for (const item of messages) {
          const message = JSONParse(
            item.message,
            typeof item.message === "string" ? [{ role: "user", content: item.message }] : []
          );
          const userMessage = message.find((item: any) => item.role === "user") || { content: "" };
          const userInfoList = supportSpecifiedContent
            ? message.filter((item: any) => item.role === "info")
            : [message.find((item: any) => item.role === "info")].filter(Boolean);

          let specified_files: SpecifiedFile[] = [];
          let specified_content = "";
          let uploaded_files: MessageFile[] = [];
          let questionText = "";

          const userContent = JSONParse(userMessage.content, null);

          if (Array.isArray(userContent)) {
            const textItem = userContent.find((item: any) => item?.type === "text");
            questionText = textItem?.content || "";
            uploaded_files = userContent
              .filter((item: any) => item != null && (item.type === "file" || item.type === "image"))
              .map((fileItem: any, index: number) => {
                const fileId = fileItem.content?.replace("file_id:", "") || `file_${index}_${Date.now()}`;
                return {
                  id: fileId,
                  filename: fileItem.filename || `文件 ${fileId}`,
                  name: fileItem.filename || `文件 ${fileId}`,
                  size: fileItem.size,
                  mime_type: fileItem.mime_type,
                  preview_key: fileItem.preview_key,
                  url: fileItem.url,
                };
              });
          } else {
            const content = userMessage.content;
            questionText = typeof content === "string" ? content : (content?.text || content?.content || "");
          }

          let skill: Skill = { skill_name: "", display_name: "" };
          const skillMatch = questionText?.match(/^\/([^\s]+)\s+([\s\S]*)/);
          if (skillMatch) {
            const skillName = skillMatch[1];
            const targetSkill =
              validSkillList.find((s: any) => s.skill_name === skillName) ||
              validMySkillList.find((s: any) => s.skill_name === skillName);
            if (targetSkill) {
              skill.display_name = targetSkill.display_name;
              skill.skill_name = targetSkill.skill_name;
              questionText = skillMatch[2];
            } else {
              skill.display_name = skillName;
              skill.skill_name = skillName;
              questionText = skillMatch[2];
            }
          }

          let answer = "";
          let processedOutputFiles: any[] = [];
          if (item.process_records?.length > 0) {
            processedOutputFiles = processRecordsToOutputFiles(item.process_records);
          }
          answer = item.answer || "";

          userInfoList.forEach((userInfo: any) => {
            if (!userInfo) return;
            userInfo.content = JSONParse(userInfo.content, {});
            const infoType = userInfo.content?.type;

            if (infoType === "specified_files") {
              specified_files = userInfo.content.list.map((fileItem: any) => ({
                id: fileItem.id,
                name: fileItem.name,
                icon: fileItem.icon || "file",
              }));
            } else if (infoType === "specified_content" && supportSpecifiedContent) {
              specified_content = userInfo.content.content || "";
            }
          });

          const initialFeedbackParams = {
            feedbackId: null,
            feedbackVisible: false,
            feedbackTypeOptions: null,
            submitBtnDisabled: true,
            feedbackSuccessful: false,
            feedback_type: "",
            feedbackLoading: !skipFeedback,
          };

          list.push({
            ...item,
            id: item.id,
            question: questionText,
            role: "assistant",
            skill,
            answer: answer?.split("<decision>DONE</decision>").join(""),
            rag_stats: formatRagStats(item.rag_stats, item.process_records),
            specified_files,
            uploaded_files,
            specified_content: supportSpecifiedContent ? specified_content : undefined,
            outputFiles: processedOutputFiles,
            ...initialFeedbackParams,
            error: answer?.includes("Access denied") || answer?.includes("InvalidApiKey") || false,
          });
        }

        return {
          messages: list,
          hasMore: list.length === limit,
        };
      } catch (err) {
        console.error("Failed to load messages:", err);
        return { messages: [], hasMore: false };
      }
    },
    [formatRagStats, supportSpecifiedContent, skillList, mySkillList]
  );

  const handleLoadListMore = useCallback(
    async (
      done: () => void,
      conversationId: string,
      loadMessagesApi: (conversationId: string, params: { offset: number; limit: number }) => Promise<any>,
      options?: { skillList?: any[]; mySkillList?: any[] }
    ): Promise<void> => {
      const currentState = stateRef.current;
      if (currentState.isLoadingMore || !currentState.hasMore) return done();

      if (!conversationId) return done();

      const requestSeq = loadMoreRequestSeqRef.current + 1;
      loadMoreRequestSeqRef.current = requestSeq;
      const messageListRequestSeq = loadMessageListRequestSeqRef.current;
      setState((prev) => ({ ...prev, isLoadingMore: true }));

      const newOffset = currentState.offset + limit;

      try {
        const res = await loadMessagesApi(conversationId, { offset: newOffset, limit });
        const { messages, hasMore } = await loadMessages(res.data?.messages || res.messages || [], limit, true, options);
        const responseHasMore = readPaginationHasMore(res);
        traceOpenClawMessages("load-more", messages);
        if (
          requestSeq !== loadMoreRequestSeqRef.current ||
          messageListRequestSeq !== loadMessageListRequestSeqRef.current
        ) {
          return done();
        }
        setState((prev) => ({
          ...prev,
          hasMore: responseHasMore ?? hasMore,
          offset: newOffset,
          messageList: [...messages, ...prev.messageList],
        }));
      } catch (err) {
        if (
          requestSeq !== loadMoreRequestSeqRef.current ||
          messageListRequestSeq !== loadMessageListRequestSeqRef.current
        ) {
          return done();
        }
        setState((prev) => ({
          ...prev,
          offset: Math.max(0, prev.offset - limit),
        }));
      } finally {
        if (
          requestSeq === loadMoreRequestSeqRef.current &&
          messageListRequestSeq === loadMessageListRequestSeqRef.current
        ) {
          setState((prev) => ({ ...prev, isLoadingMore: false }));
        }
      }
      return done();
    },
    [limit, loadMessages]
  );

  const loadMessageList = useCallback(
    async (
      conversationId: string,
      loadMessagesApi: (conversationId: string, params: { offset: number; limit: number }) => Promise<any>,
      options?: { skillList?: any[]; mySkillList?: any[]; isRunning?: boolean; runningMessageId?: string | number }
    ) => {
      const requestSeq = loadMessageListRequestSeqRef.current + 1;
      loadMessageListRequestSeqRef.current = requestSeq;
      loadMoreRequestSeqRef.current += 1;
      setState((prev) => ({
        ...prev,
        isLoadingMessages: true,
        isLoadingMore: false,
        offset: 0,
        hasMore: true,
      }));

      try {
        const res = await loadMessagesApi(conversationId, { offset: 0, limit });

        const { messages, hasMore } = await loadMessages(res.data?.messages || res.messages || [], limit, true, options);
        const responseHasMore = readPaginationHasMore(res);
        traceOpenClawMessages("load-list", messages);

        if (requestSeq !== loadMessageListRequestSeqRef.current) {
          return [];
        }

        const isActiveRun = options?.isRunning;
        const runningMessageId = options?.runningMessageId;
        if (isActiveRun && runningMessageId && messages.length > 0) {
          const targetIndex = messages.findIndex((m: any) => m.id === runningMessageId);
          if (targetIndex !== -1) {
            messages[targetIndex] = {
              ...messages[targetIndex],
              reasoning_content: "",
              answer: "",
              process_records: [],
              skillRunItems: [],
              outputFiles: [],
              rag_temp: {},
              rag_stats: undefined,
              rag_search_text: "",
              loading: true,
            };
          }
        }

        setState((prev) => ({
          ...prev,
          hasMore: responseHasMore ?? hasMore,
          messageList: messages,
        }));
        return messages;
      } finally {
        if (requestSeq === loadMessageListRequestSeqRef.current) {
          setState((prev) => ({ ...prev, isLoadingMessages: false }));
        }
      }
    },
    [limit, loadMessages]
  );

  const clearMessageList = useCallback(() => {
    loadMessageListRequestSeqRef.current += 1;
    loadMoreRequestSeqRef.current += 1;
    setState((prev) => ({
      ...prev,
      messageList: [],
      isLoadingMessages: false,
      offset: 0,
      hasMore: true,
    }));
  }, []);

  const updateMessageList = useCallback((updater: (list: Message[]) => Message[]) => {
    setState((prev) => {
      const newList = updater(prev.messageList);
      const deduped = [...new Map(newList.map((m) => [m.id, m])).values()];
      return {
        ...prev,
        messageList: deduped,
      };
    });
  }, []);

  const addMessage = useCallback((message: Message) => {
    setState((prev) => ({
      ...prev,
      messageList: [...prev.messageList, message],
    }));
  }, []);

  const updateMessage = useCallback((id: string | number, updater: (msg: Message) => Message) => {
    setState((prev) => ({
      ...prev,
      messageList: prev.messageList.map((msg) => (msg.id === id ? updater(msg) : msg)),
    }));
  }, []);

  return {
    state,
    loadMessages,
    handleLoadListMore,
    loadMessageList,
    clearMessageList,
    updateMessageList,
    addMessage,
    updateMessage,
  };
}

export default useChatMessages;
