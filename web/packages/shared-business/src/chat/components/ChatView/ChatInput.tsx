import { memo, useCallback } from "react";
import { Sender } from "@km/hub-ui-x-react";
import { SvgIcon } from "@km/shared-components-react";
import { useTranslation } from "../../i18n";

export interface SendData {
  textContent?: string;
  pureTextContent?: string;
  files?: any[];
}

export interface ChatInputProps {
  inputValue: string;
  onChange: (value: string) => void;
  onSend: (data: SendData | string, files?: any[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  stopDisabled?: boolean;
  disabledReason?: string;
  enableUpload?: boolean;
  placeholder?: string;
  features?: {
    history?: boolean;
    newConversation?: boolean;
  };
  onNewConversation?: () => void;
  onHistoryOpen?: () => void;
  /** 左侧按钮区域 - 用于 AgentTooltip 等组件 */
  renderLeftButtons?: () => React.ReactNode;
  /** 启用拖拽上传 */
  enableDragUpload?: boolean;
  /** 允许多文件选择 */
  allowMultiple?: boolean;
  /** 允许仅文件发送 */
  allowSendWithFiles?: boolean;
  /** 接受的文件类型 */
  acceptTypes?: string;
  /** 最大文件大小（字节） */
  maxFileSize?: number;
  /** 自定义上传函数 */
  httpRequest?: (file: File) => Promise<any>;
  /** 启用粘贴上传 */
  enablePasteUpload?: boolean;
  /** 是否显示推荐面板（调整宽度） */
  showRecommend?: boolean;
  boxClassName?: string
}

function ChatInputInner({
  inputValue,
  onChange,
  onSend,
  onStop,
  isStreaming,
  disabled = false,
  stopDisabled = false,
  disabledReason,
  enableUpload = false,
  placeholder,
  features = {},
  onNewConversation,
  onHistoryOpen,
  renderLeftButtons,
  enableDragUpload,
  allowMultiple,
  allowSendWithFiles,
  acceptTypes,
  maxFileSize,
  httpRequest,
  enablePasteUpload,
  showRecommend = false,
  boxClassName= ''
}: ChatInputProps) {
  const { t } = useTranslation();
  const { history = true, newConversation = true } = features;

  const handleSend = useCallback(
    (data: SendData | string, files?: any[]) => {
      onSend(data, files);
    },
    [onSend]
  );

  return (
    <div className={`pb-5 sticky bottom-0 bg-white ${showRecommend ? "w-4/6" : (boxClassName || "w-11/12 md:w-4/5 max-w-[1200px]")} mx-auto`}>
      <div className="flex gap-2 mb-2.5">
        {renderLeftButtons?.()}

        <div className="flex-1"></div>

        {history && onHistoryOpen && (
          <div
            className="h-8 px-2 rounded-full flex items-center gap-1.5 bg-[#F1F2F3] text-sm text-[#1F2123] cursor-pointer hover:bg-[#E1E2E3]"
            onClick={onHistoryOpen}
          >
            <SvgIcon name="history" size={16} />
            {t("chat.history_conversation")}
          </div>
        )}

        {newConversation && onNewConversation && (
          <div
            className="h-8 px-2 rounded-full flex items-center gap-1.5 bg-[#F1F2F3] text-sm text-[#1F2123] cursor-pointer hover:bg-[#E1E2E3]"
            onClick={onNewConversation}
          >
            <SvgIcon name="plus" size={16} />
            {t("chat.new_conversation")}
          </div>
        )}
      </div>

      <Sender
        value={inputValue}
        onChange={onChange}
        onSend={handleSend}
        onStop={onStop}
        loading={isStreaming}
        disabled={disabled}
        stopDisabled={stopDisabled}
        enableUpload={enableUpload}
        placeholder={(disabled && disabledReason) || placeholder || t("chat.input_placeholder")}
        enableDragUpload={enableDragUpload}
        allowMultiple={allowMultiple}
        allowSendWithFiles={allowSendWithFiles}
        acceptTypes={acceptTypes}
        maxFileSize={maxFileSize}
        httpRequest={httpRequest}
        enablePasteUpload={enablePasteUpload}
      />
      {disabled && disabledReason && (
        <div className="mt-2 text-center text-xs text-[#E8A600]">
          {disabledReason}
        </div>
      )}
      <div className="text-center text-xs text-gray-400 mt-2">
        {t("chat.ai_disclaimer")}
      </div>
    </div>
  );
}

const ChatInput = memo(ChatInputInner);
ChatInput.displayName = "ChatInput";

export default ChatInput;
