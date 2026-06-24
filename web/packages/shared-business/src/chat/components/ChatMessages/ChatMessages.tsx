import { memo, useCallback, useEffect, useRef } from "react";
import { LoadingOutlined } from "@ant-design/icons";
import { BubbleList, type BubbleListRef } from "@km/hub-ui-x-react";
import Welcome from "../Welcome";
import RelatedScene from "../related-scene/RelatedScene";
import MessageItem from "../message/MessageItem";
import { useTranslation } from "../../i18n";
import type { TranslateFn } from "../process-flow";
import type { IAgentInfo } from "../../adapters/types";
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

/** 默认功能配置 */
const DEFAULT_FEATURES: ChatMessagesFeatures = {
  menu: {
    copy: true,
    regenerate: false,
    share: false,
    addAsMd: false,
    feedback: false,
  },
  outputFiles: false,
  fileFavorite: false, // 默认关闭文件收藏
  sourceRef: false,
  processFlow: false,
  specifiedFiles: false,
  specifiedFilesType: 'no_jump',
  skillTag: false,
};

const DEFAULT_IMG = "/images/default_agent.png";

function handleImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const target = e.target as HTMLImageElement;
  if (target.src.endsWith(DEFAULT_IMG)) return;
  target.src = DEFAULT_IMG;
}

export interface ChatMessagesProps {
  /** 消息列表 */
  messageList: Message[];
  /** Agent 信息 */
  agentInfo: IAgentInfo;
  /** 是否正在流式输出 */
  isStreaming: boolean;
  /** 功能配置 */
  features?: ChatMessagesFeatures;
  /** 建议问题点击回调 */
  onSuggestionClick?: (content: string) => void;
  /** 分享模式 */
  isShareMode?: boolean;
  /** 是否显示欢迎页 */
  showWelcome?: boolean;
  /** 选中的消息 ID 列表 */
  selectedMessageIds?: (string | number)[];
  /** 全选状态 */
  selectAll?: boolean;
  /** 消息选择回调 */
  onMessageSelect?: (msg: Message) => void;
  /** 全选回调 */
  onSelectAll?: () => void;
  /** 消息菜单渲染函数 - 已弃用，请使用 features 配置 */
  renderMessageMenu?: (type: "user" | "assistant", msg: Message) => React.ReactNode;
  /** 欢迎页 AuthTags 渲染函数 */
  renderAuthTags?: (userGroupIds: number[]) => React.ReactNode;
  /** 是否显示推荐面板 */
  showRecommend?: boolean;
  /** 推荐智能体列表 */
  recommendAgents?: IAgentInfo[];
  /** 推荐智能体选择回调 */
  onRecommendAgentSelect?: (agent: IAgentInfo) => void;
  /** 下一个智能体回调 - 用于 RelatedScene */
  onNextAgent?: (item: any, parameters: Record<string, string>) => void;
  /** 重新初始化当前智能体回调 - 当跳转到同一智能体时触发 */
  onInitAgent?: () => void;
  /** Openclaw 模式 */
  openclaw?: boolean;
  /** 显示相关场景 */
  showRelatedScene?: boolean;
  /** 是否还有更早消息 */
  hasMore?: boolean;
  /** 是否正在加载更早消息 */
  isLoadingMore?: boolean;
  /** 是否正在加载当前会话消息 */
  isConversationLoading?: boolean;
  /** 上拉加载更早消息 */
  onLoadMore?: (done: () => void) => void;
  /** 重新生成回调 */
  onRegenerate?: (msg: Message) => void;
  /** 分享回调 */
  onShare?: () => void;
  /** 添加为文件回调 */
  onAddAsMd?: (msg: Message) => void;
  /** 反馈回调 */
  onFeedback?: (msg: Message, type: 'satisfied' | 'unsatisfied', description?: string) => void;
  /** 文件点击回调 */
  onFileClick?: (file: FileItem) => void;
  /** 源文件点击回调 */
  onSourceClick?: (source: ChunkItem, msg: Message) => void;
  /** 打开知识库侧边栏回调 */
  onOpenKnow?: (msg: Message) => void;
  /** Source 引用点击回调 */
  onSourceReferenceClick?: (data: SourceReferenceData, msg: Message) => void;
  /** Source 引用悬停回调 */
  /** 自定义 Source 渲染函数 */
  renderSource?: (type: string, number: number, msg: Message) => string;
  /** 输出文件收藏回调 */
  onOutputFileFavorite?: (file: OutputFile, msg: Message) => void;
  /** 输出文件预览回调 */
  onOutputFilePreview?: (file: OutputFile, msg: Message) => void;
  /** 输出文件收藏状态检查回调 */
  onOutputFileCheckFavorite?: (fileIds: string[]) => void;
  /** OpenClaw 交互选项提交回调 */
  onOpenClawInteractionSubmit?: (activity: OpenClawActivityItem, option: OpenClawInteractionOption, msg: Message) => Promise<void> | void;
  /** 反馈面板关闭回调 */
  onFeedbackClose?: (msg: Message) => void;
  /** 反馈选项切换回调 */
  onFeedbackToggle?: (msg: Message, key: string) => void;
  /** 反馈描述变化回调 */
  onFeedbackDescriptionChange?: (msg: Message, value: string) => void;
  /** 显示错误详情回调 */
  onShowErrorDetails?: (msg: Message) => void;
  /** 自定义文件链接渲染（用于跳转） */
  renderFileLink?: (file: FileItem, children: React.ReactNode) => React.ReactNode;
  /** 外部传入的翻译函数（可选） */
  t?: TranslateFn;
  /** 自定义内容区域容器类名 */
  boxClassName?: string;
}

function ChatMessagesInner({
  messageList,
  agentInfo,
  isStreaming,
  features,
  onSuggestionClick,
  isShareMode = false,
  selectedMessageIds = [],
  selectAll = false,
  onMessageSelect,
  onSelectAll,
  renderMessageMenu,
  renderAuthTags,
  showRecommend = false,
  showWelcome = true,
  recommendAgents,
  onRecommendAgentSelect,
  onNextAgent,
  onInitAgent,
  openclaw = false,
  showRelatedScene = false,
  hasMore = false,
  isLoadingMore = false,
  isConversationLoading = false,
  onLoadMore,
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
  t: externalT,
  boxClassName,
}: ChatMessagesProps) {
  const { t: internalT } = useTranslation();
  const t = externalT || internalT;
  const bubbleListRef = useRef<BubbleListRef>(null);

  const mergedFeatures = { ...DEFAULT_FEATURES, ...features };
  const shouldShowWelcome = showWelcome && messageList.length === 0 && !isConversationLoading;
  const lastMessageId = messageList.length > 0 ? messageList[messageList.length - 1]?.id : undefined;
  const translatedLoadingMessages = t("chat.loading_messages");
  const loadingMessage =
    translatedLoadingMessages && translatedLoadingMessages !== "chat.loading_messages"
      ? translatedLoadingMessages
      : "加载消息...";

  const preserveScrollDuringToggle = useCallback((callback: () => void) => {
    const wrapper = bubbleListRef.current?.getWrapperElement();
    if (!wrapper) {
      callback();
      return;
    }

    const scrollTop = wrapper.scrollTop;
    const scrollLeft = wrapper.scrollLeft;
    callback();

    const restore = () => {
      if (!wrapper.isConnected) return;
      wrapper.scrollTop = scrollTop;
      wrapper.scrollLeft = scrollLeft;
    };

    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      restore();
      return;
    }

    window.requestAnimationFrame(() => {
      restore();
      window.requestAnimationFrame(restore);
    });
  }, []);

  useEffect(() => {
    bubbleListRef.current?.scrollToBottom();
  }, [messageList.length]);

  return (
    <main className="flex-1 py-4 overflow-hidden flex relative">
      <BubbleList
        ref={bubbleListRef}
        messages={messageList}
        autoScroll
        className="flex-1"
        mainClass={showRecommend ? "w-[95%]" : boxClassName || "w-11/12 md:w-4/5 max-w-[1200px] mx-auto"}
        enablePullUp={hasMore && !isLoadingMore}
        pullUpText="正在加载更早的消息..."
        onPullUp={onLoadMore}
      >
        {shouldShowWelcome && (
          <Welcome
            agentInfo={agentInfo}
            onSuggestion={onSuggestionClick}
            renderAuthTags={renderAuthTags}
          />
        )}
        {openclaw && messageList.length === 0 && (
          <div className="max-w-[520px] mt-5 mb-3 px-4 py-2 bg-[#F4F5F7] rounded-xl">
            {t("chat.openclaw_welcome_hint")}
          </div>
        )}

        {messageList.map((msg, index) => (
          <div key={msg.id}>
            {/* Message Item */}
            <MessageItem
              message={msg}
              index={index}
              openclaw={openclaw}
              total={messageList.length}
              agentInfo={agentInfo}
              features={mergedFeatures}
              isStreaming={isStreaming && msg.id === lastMessageId}
              isShareMode={isShareMode}
              selectedMessageIds={selectedMessageIds}
              onMessageSelect={onMessageSelect}
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
              renderFileLink={renderFileLink}
              preserveScrollDuringToggle={preserveScrollDuringToggle}
              t={t}
            />

            {/* Related Scene - 只在最后一条消息后显示 */}
            {index === messageList.length - 1 &&
              !msg.loading &&
              !isStreaming &&
              !isShareMode &&
              showRelatedScene && (
                <RelatedScene
                  output={msg.answer || ""}
                  relateAgents={agentInfo?.settings_obj?.relate_agents}
                  currentAgentId={agentInfo?.agent_id}
                  onNextAgent={onNextAgent}
                  onInitAgent={onInitAgent}
                />
              )}
          </div>
        ))}
      </BubbleList>

      {isConversationLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 pointer-events-auto">
          <div className="flex items-center gap-2 text-gray-500">
            <LoadingOutlined className="text-xl animate-spin" />
            <span>{loadingMessage}</span>
          </div>
        </div>
      )}

      {/* Recommend Panel */}
      {showRecommend && recommendAgents && recommendAgents.length > 0 && (
        <div className={`flex-none w-2/6 flex flex-col gap-4 pb-5 ${isShareMode ? "-mt-[70px]" : ""}`}>
          <h2 className="flex-none text-base font-semibold text-regular">
            {t("common.related_agent") || "相关智能体"}
          </h2>
          <div className="flex-1 overflow-y-auto flex flex-col gap-2.5">
            {recommendAgents.map((agent) => (
              <div
                key={agent.agent_id}
                className="flex-none h-24 border rounded p-4 cursor-pointer hover:bg-[#F1F2F3]"
                onClick={() => onRecommendAgentSelect?.(agent)}
              >
                <div className="flex items-center gap-2">
                  <img
                    className="size-6 rounded-full"
                    src={agent.logo || DEFAULT_IMG}
                    alt={agent.name}
                    onError={handleImageError}
                  />
                  <span className="text-sm text-primary">{agent.name}</span>
                </div>
                <div
                  className="text-sm text-regular line-clamp-2 mt-1.5"
                  title={agent.description || ""}
                >
                  {agent.description || t("chat.no_description") || "暂无描述"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

const ChatMessages = memo(ChatMessagesInner);
ChatMessages.displayName = "ChatMessages";

export default ChatMessages;
export { DEFAULT_FEATURES };
export type { ChatMessagesFeatures, FileItem, ChunkItem, OutputFile, SourceReferenceData };
