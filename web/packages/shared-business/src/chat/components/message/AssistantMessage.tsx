// packages/shared-business/src/chat/components/message/AssistantMessage.tsx

import { memo, useState, useCallback, useMemo } from "react";
import { Checkbox, message as antdMessage, Tooltip } from "antd";
import { BubbleAssistant } from "@km/hub-ui-x-react";
import { MessageMenu } from "../MessageMenu";
import { FeedbackPanel } from "../feedback";
import { ProcessFlowHeader, type TranslateFn } from "../process-flow";
import { OutputFiles } from "../output";
import OpenClawTimeline from "./OpenClawTimeline";
import { Quotation } from "../source";
import { useTranslation, useKnowledgePanel } from "../../i18n";
import type {
  Message,
  ChatMessagesFeatures,
  FileItem,
  ChunkItem,
  OutputFile,
  OpenClawActivityItem,
  OpenClawInteractionOption,
} from "../../types/message";
import { getOutputFileDownloadStrategy } from "../../utils/output-file-download";

export interface AssistantMessageProps {
  /** 消息数据 */
  message: Message;
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
  /** 是否是最后一条消息 */
  isLastMessage?: boolean;
  /** 分享模式 */
  isShareMode?: boolean;
  /** 是否被选中（分享模式） */
  isSelected?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** OpenClaw 时间线模式 */
  openclaw?: boolean;
  /** 消息选择回调 */
  onSelect?: (message: Message) => void;
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
  onSourceReferenceClick?: (data: any, message: Message) => void;
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
  /** 折叠/展开 OpenClaw 时间线时保持外层滚动位置 */
  preserveScrollDuringToggle?: (callback: () => void) => void;
  /** 外部传入的翻译函数（可选，不传则使用内部 i18n） */
  t?: TranslateFn;
}

const FEEDBACK_OPTIONS_SATISFIED = new Map([
  ["准确", false],
  ["有帮助", false],
  ["快速", false],
  ["其它", false],
]);

const FEEDBACK_OPTIONS_UNSATISFIED = new Map([
  ["不准确", false],
  ["不完整", false],
  ["不相关", false],
  ["其它", false],
]);

function getOpenClawAssistantContent(message: Message) {
  const projectedAnswer = message.openclawProjection?.visibleAnswer?.trim();
  if (projectedAnswer) return projectedAnswer;
  return "";
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

function traceOpenClawAssistantRender(label: string, payload: Record<string, unknown>) {
  if (!isOpenClawUiDebugEnabled()) return;
  console.info(`[openclaw-ui:${label}] ${JSON.stringify(payload)}`);
}

function AssistantMessageInner({
  message,
  agentInfo,
  features,
  isStreaming = false,
  isLastMessage = false,
  isShareMode = false,
  isSelected = false,
  className,
  style,
  openclaw = false,
  onSelect,
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
  preserveScrollDuringToggle,
  t: externalT,
}: AssistantMessageProps) {
  const { t: internalT } = useTranslation();
  const t = externalT || internalT;
  const onOpenKnowledgePanel = useKnowledgePanel();

  // 反馈状态 - 支持外部控制或内部状态
  const feedbackVisible = message.feedbackVisible ?? false;
  const feedbackType = message.feedback_type ?? "";
  const feedbackTypeOptions = message.feedbackTypeOptions ?? null;
  const feedbackSuccessful = message.feedbackSuccessful ?? false;
  const description = message.description ?? "";

  // 内部反馈状态（当没有外部回调时使用）
  const [internalFeedbackVisible, setInternalFeedbackVisible] = useState(false);
  const [internalFeedbackType, setInternalFeedbackType] = useState<"satisfied" | "unsatisfied" | "">("");
  const [internalFeedbackOptions, setInternalFeedbackOptions] = useState<Map<string, boolean>>(new Map());
  const [internalDescription, setInternalDescription] = useState("");
  const [internalFeedbackSuccessful, setInternalFeedbackSuccessful] = useState(false);
  // 内部错误详情状态
  const [internalShowErrorDetails, setInternalShowErrorDetails] = useState(false);

  // 使用外部状态还是内部状态
  const useExternalFeedback = !!onFeedbackClose;
  const actualFeedbackVisible = useExternalFeedback ? feedbackVisible : internalFeedbackVisible;
  const actualFeedbackType = useExternalFeedback ? feedbackType : internalFeedbackType;
  const actualFeedbackOptions = useExternalFeedback ? feedbackTypeOptions : internalFeedbackOptions;
  const actualFeedbackSuccessful = useExternalFeedback ? feedbackSuccessful : internalFeedbackSuccessful;
  const actualDescription = useExternalFeedback ? description : internalDescription;

  // 错误详情显示状态（优先使用外部状态）
  const showErrorDetails = message.showErrorDetails ?? internalShowErrorDetails;

  const handleSelect = useCallback(() => {
    if (isShareMode && onSelect) {
      onSelect(message);
    }
  }, [isShareMode, onSelect, message]);

  const handleRegenerate = useCallback(() => {
    onRegenerate?.(message);
  }, [onRegenerate, message]);

  const handleShare = useCallback(() => {
    onShare?.();
  }, [onShare]);

  const handleAddAsMd = useCallback(() => {
    onAddAsMd?.(message);
  }, [onAddAsMd, message]);

  const handleFeedback = useCallback((type: "satisfied" | "unsatisfied") => {
    if (useExternalFeedback) {
      onFeedback?.(message, type);
    } else {
      setInternalFeedbackType(type);
      setInternalFeedbackOptions(type === "satisfied" ? new Map(FEEDBACK_OPTIONS_SATISFIED) : new Map(FEEDBACK_OPTIONS_UNSATISFIED));
      setInternalFeedbackVisible(true);
      setInternalDescription("");
      setInternalFeedbackSuccessful(false);
    }
  }, [useExternalFeedback, onFeedback, message]);

  const handleFeedbackToggle = useCallback((key: string) => {
    if (useExternalFeedback && onFeedbackToggle) {
      onFeedbackToggle(message, key);
    } else {
      setInternalFeedbackOptions((prev) => {
        const next = new Map(prev);
        next.set(key, next.get(key) !== true);
        return next;
      });
    }
  }, [useExternalFeedback, onFeedbackToggle, message]);

  const handleFeedbackSubmit = useCallback(() => {
    const options = useExternalFeedback ? feedbackTypeOptions : internalFeedbackOptions;
    const desc = useExternalFeedback ? description : internalDescription;

    const selectedOptions = Array.from((options || new Map()).entries())
      .filter(([, value]) => value)
      .map(([key]) => key);

    if (selectedOptions.length === 0) {
      antdMessage.warning(t("chat.select_feedback_option") || "请选择至少一个反馈选项");
      return;
    }

    // Guard: ensure feedbackType is valid before submitting
    const fbType = useExternalFeedback ? feedbackType : internalFeedbackType;
    if (fbType !== "satisfied" && fbType !== "unsatisfied") {
      return;
    }

    const feedbackDescription = desc.trim() ? `${selectedOptions.join(", ")}: ${desc}` : selectedOptions.join(", ");
    onFeedback?.(message, fbType, feedbackDescription);

    if (!useExternalFeedback) {
      setInternalFeedbackSuccessful(true);
      setInternalFeedbackVisible(false);
      // 2秒后重置成功状态
      setTimeout(() => {
        setInternalFeedbackSuccessful(false);
      }, 2000);
    }
  }, [useExternalFeedback, feedbackTypeOptions, internalFeedbackOptions, description, internalDescription, feedbackType, internalFeedbackType, onFeedback, message, t]);

  const handleFeedbackClose = useCallback(() => {
    if (useExternalFeedback && onFeedbackClose) {
      onFeedbackClose(message);
    } else {
      setInternalFeedbackVisible(false);
      setInternalFeedbackType("");
      setInternalDescription("");
    }
  }, [useExternalFeedback, onFeedbackClose, message]);

  const handleDescriptionChange = useCallback((value: string) => {
    if (useExternalFeedback && onFeedbackDescriptionChange) {
      onFeedbackDescriptionChange(message, value);
    } else {
      setInternalDescription(value);
    }
  }, [useExternalFeedback, onFeedbackDescriptionChange, message]);

  const handleOutputFilePreview = useCallback((file: OutputFile) => {
    if (onOutputFilePreview) {
      onOutputFilePreview(file, message);
      return;
    }

    const triggerAnchorDownload = (url: string, filename?: string) => {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const triggerBlobDownload = async (blob: Blob, filename?: string) => {
      const url = URL.createObjectURL(blob);
      triggerAnchorDownload(url, filename);
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    };

    const resolveMessageOutputUrl = async () => {
      if (!file.message_id) return "";
      const accessToken = localStorage.getItem("access_token") || "";
      const response = await fetch(`/api/messages/${file.message_id}/files`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        credentials: "include",
      });
      if (!response.ok) return "";
      const payload = await response.json();
      const records = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      const matched = records.find((item: any) => {
        const ids = [item?.id, item?.file?.origin_ref_id].map((value) => String(value || ""));
        return ids.includes(String(file.id || "")) || String(item?.file_name || "") === String(file.file_name || "");
      });
      return matched?.signed_download_url || matched?.download_url || "";
    };

    const preview = async () => {
      const filename = file.file_name || "download";
      const strategy = getOutputFileDownloadStrategy(file);
      if (strategy.kind === "direct_url") {
        triggerAnchorDownload(strategy.url, filename);
        return;
      }
      if (strategy.kind === "data_url") {
        const response = await fetch(strategy.url);
        await triggerBlobDownload(await response.blob(), filename);
        return;
      }
      if (strategy.kind === "message_lookup") {
        const resolvedUrl = await resolveMessageOutputUrl();
        if (resolvedUrl) {
          triggerAnchorDownload(resolvedUrl, filename);
        }
      }
    };

    void preview();
  }, [message, onOutputFilePreview]);

  const handleOutputFileFavorite = useCallback((file: OutputFile) => {
    onOutputFileFavorite?.(file, message);
  }, [onOutputFileFavorite, message]);

  const handleSourceClick = useCallback((source: ChunkItem) => {
    // 优先使用 context 中的回调
    if (onOpenKnowledgePanel) {
      const handled = onOpenKnowledgePanel({ type: 'source_click', source });
      if (handled !== false) return;
    }
    // 回退到外部 props
    onSourceClick?.(source, message);
  }, [onOpenKnowledgePanel, onSourceClick, message]);

  const handleOpenKnow = useCallback(() => {
    // 优先使用 context 中的回调
    if (onOpenKnowledgePanel) {
      const files = message.rag_stats?.files_search || [];
      const handled = onOpenKnowledgePanel({ type: 'knowledge_search', files });
      if (handled !== false) return;
    }
    // 回退到外部 props
    onOpenKnow?.(message);
  }, [onOpenKnowledgePanel, onOpenKnow, message]);

  const handleSourceReferenceClick = useCallback((data: any) => {
    onSourceReferenceClick?.(data, message);
  }, [onSourceReferenceClick, message]);

  const handleRenderSource = useCallback((type: string, number: number) => {
    if (renderSource) {
      return renderSource(type, number, message);
    }
    // 默认渲染
    return `${type}-${number}`;
  }, [renderSource, message]);

  const handleShowErrorDetails = useCallback(() => {
    if (onShowErrorDetails) {
      onShowErrorDetails(message);
    } else {
      // 没有外部回调时，使用内部状态切换
      setInternalShowErrorDetails(true);
    }
  }, [onShowErrorDetails, message]);

  const menuFeatures = useMemo(() => ({
    copy: features?.menu?.copy ?? true,
    regenerate: features?.menu?.regenerate ?? true,
    share: features?.menu?.share ?? false,
    feedback: features?.menu?.feedback ?? false,
    addAsFile: features?.menu?.addAsMd ?? false,
  }), [features?.menu]);

  const assistantMenuContent = openclaw ? getOpenClawAssistantContent(message) : (message.answer || message.content || "");
  const showMenu = !message.loading && !isShareMode;
  const showProcessFlow = features?.processFlow && message.process_records && message.process_records.length > 0;
  const showOutputFiles = !openclaw && features?.outputFiles && message.outputFiles && message.outputFiles.length > 0;
  const showQuotation = features?.sourceRef && message.rag_stats?.file_quotations && message.rag_stats.file_quotations.length > 0;
  const showAnswerRemarks = agentInfo?.settings?.answer_remarks_config?.enable && !message.loading;

  if (
    openclaw &&
    message.openclawProjection &&
    (message.openclawProjection.timelineItems.length > 0 || message.openclawProjection.outputFiles.length > 0)
  ) {
    traceOpenClawAssistantRender("assistant.render.timeline", {
      id: message.id,
      answerLen: String(message.answer || "").length,
      projectionAnswerLen: String(message.openclawProjection?.visibleAnswer || "").length,
      timelineCount: message.openclawTimelineItems?.length || 0,
      projectionTimelineCount: message.openclawProjection?.timelineItems?.length || 0,
      loading: Boolean(message.loading),
      isStreaming: Boolean(isStreaming && isLastMessage),
    });
    return (
      <div
        className={`flex items-center gap-5 rounded-xl ${isShareMode ? "mb-4 px-3 py-4 bg-[#F5F5F5]" : ""}`}
        onClick={handleSelect}
      >
        {isShareMode && <Checkbox checked={isSelected} />}
        <div className="flex-1 overflow-hidden space-y-3">
          <OpenClawTimeline
            message={message}
            items={message.openclawProjection.timelineItems}
            agentInfo={agentInfo}
            isStreaming={message.loading || (isStreaming && isLastMessage)}
            features={features}
            renderSource={renderSource}
            onSourceReferenceClick={onSourceReferenceClick}
            onOutputFilePreview={handleOutputFilePreview}
            onOutputFileFavorite={onOutputFileFavorite}
            onOutputFileCheckFavorite={onOutputFileCheckFavorite}
            onInteractionSubmit={(activity, option) => onOpenClawInteractionSubmit?.(activity, option, message)}
            preserveScrollDuringToggle={preserveScrollDuringToggle}
            answerMenu={
              showMenu ? (
                <MessageMenu
                  type="assistant"
                  content={assistantMenuContent}
                  features={menuFeatures}
                  feedbackType={message.feedback_type}
                  onRegenerate={handleRegenerate}
                  onShare={handleShare}
                  onFeedback={handleFeedback}
                  onAddAsFile={handleAddAsMd}
                />
              ) : undefined
            }
          />

          {showAnswerRemarks && (
            <div className="text-sm text-[#999999] break-words">
              {agentInfo!.settings!.answer_remarks_config.content}
            </div>
          )}

          {showQuotation && (
            <Quotation
              type={message.rag_stats?.type}
              files={message.rag_stats?.file_quotations}
              onFileClick={onFileClick}
            />
          )}

          {features?.menu?.feedback && actualFeedbackVisible && (
            <FeedbackPanel
              visible={actualFeedbackVisible}
              feedbackType={actualFeedbackType}
              feedbackTypeOptions={actualFeedbackOptions}
              submitBtnDisabled={message.submitBtnDisabled !== false}
              feedbackSuccessful={actualFeedbackSuccessful}
              description={actualDescription}
              onClose={handleFeedbackClose}
              onToggle={handleFeedbackToggle}
              onSubmit={handleFeedbackSubmit}
              onDescriptionChange={handleDescriptionChange}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-5 rounded-xl ${isShareMode ? "mb-4 px-3 py-4 bg-[#F5F5F5]" : ""}`}
      onClick={handleSelect}
    >
      {isShareMode && <Checkbox checked={isSelected} />}

      <div className="flex-1 overflow-hidden">
        <BubbleAssistant
          content={message.answer || ""}
          streaming={message.loading || (isStreaming && isLastMessage)}
          reasoning={message.reasoning_content}
          reasoningExpanded={message.reasoning_expanded}
          avatar={agentInfo?.logo}
          name={agentInfo?.name}
          alwaysShowMenu={isLastMessage || actualFeedbackVisible}
          className={className}
          style={style}
          sourceEnabled={true}
          renderSource={handleRenderSource}
          onSourceReferenceClick={handleSourceReferenceClick}
          showError={message.error}
          header={
            showProcessFlow ? (
              <ProcessFlowHeader
                t={t}
                processRecords={message.process_records}
                streaming={message.loading || (isStreaming && isLastMessage)}
                hasContent={!!(message.answer || message.content)}
                getKnowledgeSearchFiles={() => message.rag_stats?.files_search || []}
                onOpenKnow={handleOpenKnow}
                onSourceClick={handleSourceClick}
              />
            ) : undefined
          }
          footer={
            <>
              {showOutputFiles && (
                <OutputFiles
                  files={message.outputFiles!}
                  onPreview={handleOutputFilePreview}
                  onFavorite={features?.outputFiles && onOutputFileFavorite ? handleOutputFileFavorite : undefined}
                  onCheckFavorite={features?.outputFiles && onOutputFileCheckFavorite ? onOutputFileCheckFavorite : undefined}
                />
              )}
              {showAnswerRemarks && (
                <div className="text-sm text-[#999999] break-words my-2">
                  {agentInfo!.settings!.answer_remarks_config.content}
                </div>
              )}
              {showQuotation && (
                <Quotation
                  type={message.rag_stats?.type}
                  files={message.rag_stats?.file_quotations}
                  onFileClick={onFileClick}
                />
              )}
            </>
          }
          menu={
            showMenu ? (
              <MessageMenu
                type="assistant"
                content={assistantMenuContent}
                features={menuFeatures}
                feedbackType={message.feedback_type}
                onRegenerate={handleRegenerate}
                onShare={handleShare}
                onFeedback={handleFeedback}
                onAddAsFile={handleAddAsMd}
              />
            ) : undefined
          }
          error={
            message.error ? (
              <div className="text-[#262626]">
                {t("chat.error_tip") || "回答出错"}
                <span
                  className="text-blue-500 cursor-pointer underline ml-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShowErrorDetails();
                  }}
                >
                  {t("chat.error_details") || "查看详情"}
                </span>
                {showErrorDetails && (
                  <div className="mt-2 whitespace-pre-wrap text-sm">
                    {message.answer || message.content}
                  </div>
                )}
              </div>
            ) : undefined
          }
        />

        {/* Feedback Panel */}
        {features?.menu?.feedback && actualFeedbackVisible && (
          <FeedbackPanel
            visible={actualFeedbackVisible}
            feedbackType={actualFeedbackType}
            feedbackTypeOptions={actualFeedbackOptions}
            submitBtnDisabled={message.submitBtnDisabled !== false}
            feedbackSuccessful={actualFeedbackSuccessful}
            description={actualDescription}
            onClose={handleFeedbackClose}
            onToggle={handleFeedbackToggle}
            onSubmit={handleFeedbackSubmit}
            onDescriptionChange={handleDescriptionChange}
          />
        )}
      </div>
    </div>
  );
}

const AssistantMessage = memo(AssistantMessageInner);
AssistantMessage.displayName = "AssistantMessage";

export default AssistantMessage;
