// packages/shared-business/src/chat/components/message/MessageItem.tsx

import { memo } from "react";
import UserMessage from "./UserMessage";
import AssistantMessage from "./AssistantMessage";
import type { TranslateFn } from "../process-flow";
import type {
  Message,
  ChatMessagesFeatures,
  FileItem,
  ChunkItem,
  OutputFile,
  SourceReferenceData,
  OpenClawActivityItem,
  OpenClawInteractionOption,
} from "../../types/message";

function readOpenClawVisibleAssistantContent(message: Message): string {
  return String(message.openclawProjection?.visibleAnswer || "").trim();
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

function traceOpenClawMessageRender(label: string, payload: Record<string, unknown>) {
  if (!isOpenClawUiDebugEnabled()) return;
  console.info(`[openclaw-ui:${label}] ${JSON.stringify(payload)}`);
}

export interface MessageItemProps {
  /** 消息数据 */
  message: Message;
  /** 消息索引 */
  index: number;
  /** 消息总数 */
  total: number;
  /** Agent 信息 */
  agentInfo?: {
    agent_id?: string | number;
    name?: string;
    logo?: string;
    settings?: {
      opening_statement?: string;
      answer_remarks_config?: { enable: boolean; content: string };
    };
  };
  /** 功能开关 */
  features?: ChatMessagesFeatures;
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 分享模式 */
  isShareMode?: boolean;
  /** 选中的消息 ID 列表 */
  selectedMessageIds?: (string | number)[];
  /** Openclaw 模式 */
  openclaw?: boolean;
  /** 消息选择回调 */
  onMessageSelect?: (message: Message) => void;
  /** 重新生成回调 */
  onRegenerate?: (message: Message) => void;
  /** 分享回调 */
  onShare?: () => void;
  /** 添加为文件回调 */
  onAddAsMd?: (message: Message) => void;
  /** 反馈回调 */
  onFeedback?: (message: Message, type: 'satisfied' | 'unsatisfied', description?: string) => void;
  /** 文件点击回调 */
  onFileClick?: (file: FileItem) => void;
  /** 源文件点击回调 */
  onSourceClick?: (source: ChunkItem, message: Message) => void;
  /** 打开知识库侧边栏回调 */
  onOpenKnow?: (message: Message) => void;
  /** Source 引用点击回调 */
  onSourceReferenceClick?: (data: SourceReferenceData, message: Message) => void;
  /** 自定义 Source 渲染函数 */
  renderSource?: (type: string, number: number, message: Message) => string;
  /** 输出文件收藏回调 */
  onOutputFileFavorite?: (file: OutputFile, message: Message) => void;
  /** 输出文件预览回调 */
  onOutputFilePreview?: (file: OutputFile, message: Message) => void;
  /** 输出文件收藏状态检查回调 */
  onOutputFileCheckFavorite?: (fileIds: string[]) => void;
  /** OpenClaw 交互选项提交回调 */
  onOpenClawInteractionSubmit?: (activity: OpenClawActivityItem, option: OpenClawInteractionOption, message: Message) => Promise<void> | void;
  /** 反馈面板关闭回调 */
  onFeedbackClose?: (message: Message) => void;
  /** 反馈选项切换回调 */
  onFeedbackToggle?: (message: Message, key: string) => void;
  /** 反馈描述变化回调 */
  onFeedbackDescriptionChange?: (message: Message, value: string) => void;
  /** 显示错误详情回调 */
  onShowErrorDetails?: (message: Message) => void;
  /** 自定义文件链接渲染（用于跳转） */
  renderFileLink?: (file: FileItem, children: React.ReactNode) => React.ReactNode;
  /** 折叠/展开 OpenClaw 时间线时保持外层滚动位置 */
  preserveScrollDuringToggle?: (callback: () => void) => void;
  /** 外部传入的翻译函数（可选） */
  t?: TranslateFn;
}

function MessageItemInner({
  message,
  index,
  total,
  agentInfo,
  features,
  isStreaming = false,
  isShareMode = false,
  selectedMessageIds = [],
  openclaw = false,
  onMessageSelect,
  onRegenerate,
  onShare,
  onAddAsMd,
  onFeedback,
  onFileClick,
  onSourceClick,
  onOpenKnow,
  onSourceReferenceClick,
  renderSource,
  onOutputFileFavorite,
  onOutputFilePreview,
  onOutputFileCheckFavorite,
  onOpenClawInteractionSubmit,
  onFeedbackClose,
  onFeedbackToggle,
  onFeedbackDescriptionChange,
  onShowErrorDetails,
  renderFileLink,
  preserveScrollDuringToggle,
  t,
}: MessageItemProps) {
  const isLastMessage = index === total - 1;
  const isSelected = selectedMessageIds.includes(message.id);
  const visibleAssistantContent = openclaw
    ? readOpenClawVisibleAssistantContent(message)
    : String(message.answer || message.content || "").trim();
  const hasAssistantSurface = openclaw
    ? message.loading ||
      Boolean(visibleAssistantContent) ||
      Boolean(message.openclawProjection?.timelineItems?.length) ||
      Boolean(message.openclawProjection?.outputFiles?.length)
    : Boolean(
        message.loading ||
          visibleAssistantContent ||
          message.outputFiles?.length ||
          message.process_records?.length
      );
  const shouldRenderAssistant = !openclaw || hasAssistantSurface;
  if (openclaw) {
    traceOpenClawMessageRender("message-item.render", {
      id: message.id,
      questionLen: String(message.question || "").length,
      questionHash: hashOpenClawText(message.question),
      answerLen: String(message.answer || "").length,
      answerHash: hashOpenClawText(message.answer),
      visibleAssistantLen: visibleAssistantContent.length,
      timelineCount: message.openclawTimelineItems?.length || 0,
      projectionTimelineCount: message.openclawProjection?.timelineItems?.length || 0,
      projectionAnswerLen: String(message.openclawProjection?.visibleAnswer || "").length,
      status: message.openclawTurn?.status,
      loading: Boolean(message.loading),
      shouldRenderAssistant,
    });
  }

  return (
    <div key={message.id}>
      {/* User Message */}
      <UserMessage
        message={message}
        agentLogo={agentInfo?.logo}
        features={features}
        isShareMode={isShareMode}
        isSelected={isSelected}
        onSelect={onMessageSelect}
        onFileClick={onFileClick}
        renderFileLink={renderFileLink}
      />

      {/* Assistant Message */}
      {shouldRenderAssistant && (
        <AssistantMessage
          message={message}
          agentInfo={agentInfo}
          features={features}
          isStreaming={isStreaming}
          isLastMessage={isLastMessage}
          isShareMode={isShareMode}
          isSelected={isSelected}
          openclaw={openclaw}
          onSelect={onMessageSelect}
          onRegenerate={onRegenerate}
          onShare={onShare}
          onAddAsMd={onAddAsMd}
          onFeedback={onFeedback}
          onFileClick={onFileClick}
          onSourceClick={onSourceClick}
          onOpenKnow={onOpenKnow}
          onSourceReferenceClick={onSourceReferenceClick}
          renderSource={renderSource}
          onOutputFileFavorite={onOutputFileFavorite}
          onOutputFilePreview={onOutputFilePreview}
          onOutputFileCheckFavorite={onOutputFileCheckFavorite}
          onOpenClawInteractionSubmit={onOpenClawInteractionSubmit}
          onFeedbackClose={onFeedbackClose}
          onFeedbackToggle={onFeedbackToggle}
          onFeedbackDescriptionChange={onFeedbackDescriptionChange}
          onShowErrorDetails={onShowErrorDetails}
          preserveScrollDuringToggle={preserveScrollDuringToggle}
          t={t}
        />
      )}
    </div>
  );
}

const MessageItem = memo(MessageItemInner);
MessageItem.displayName = "MessageItem";

export default MessageItem;
