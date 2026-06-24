// packages/shared-business/src/chat/components/message/UserMessage.tsx

import { memo, useCallback, useMemo } from "react";
import { Checkbox } from "antd";
import { BubbleUser } from "@km/hub-ui-x-react";
import { MessageMenu } from "../MessageMenu";
import { SpecifiedFiles } from "../source";
import { useTranslation } from "../../i18n";
import type { Message, ChatMessagesFeatures, FileItem } from "../../types/message";

export interface UserMessageProps {
  /** 消息数据 */
  message: Message;
  /** Agent Logo */
  agentLogo?: string;
  /** 功能开关 */
  features?: ChatMessagesFeatures;
  /** 分享模式 */
  isShareMode?: boolean;
  /** 是否被选中（分享模式） */
  isSelected?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 消息选择回调 */
  onSelect?: (message: Message) => void;
  /** 文件点击回调 */
  onFileClick?: (file: FileItem) => void;
  /** 自定义文件链接渲染（用于跳转） */
  renderFileLink?: (file: FileItem, children: React.ReactNode) => React.ReactNode;
}

/**
 * 解析消息内容
 * 支持 JSON 格式的 question (如 [{type: "text", content: "..."}])
 * 支持技能前缀移除 (如 "/skill_name actual_question")
 */
function parseMessageContent(msg: Message): string {
  let content = "";
  const rawContent = msg.original_question || msg.question || "";

  // 尝试解析 JSON 格式
  try {
    const question = JSON.parse(rawContent);
    if (question && Array.isArray(question)) {
      const textItem = question.find((item: any) => item.type === "text");
      if (textItem?.content) {
        content = textItem.content;
      }
    } else {
      content = rawContent;
    }
  } catch {
    // Not JSON format, use raw string
    content = rawContent;
  }

  // Strip skill prefix if skill info is available
  // Format: "/skill_name actual_question"
  if (msg.skill?.skill_name && content.startsWith(`/${msg.skill.skill_name} `)) {
    content = content.substring(msg.skill.skill_name.length + 2);
  }

  return content;
}

function UserMessageInner({
  message,
  agentLogo,
  features,
  isShareMode = false,
  isSelected = false,
  className,
  style,
  onSelect,
  onFileClick,
  renderFileLink,
}: UserMessageProps) {
  const { t } = useTranslation();

  const handleSelect = useCallback(() => {
    if (isShareMode && onSelect) {
      onSelect(message);
    }
  }, [isShareMode, onSelect, message]);

  const handleFileClick = useCallback((file: FileItem) => {
    onFileClick?.(file);
  }, [onFileClick]);

  // 解析后的内容
  const parsedContent = useMemo(() => parseMessageContent(message), [message]);

  // 合并 specified_files 和 uploaded_files
  const specifiedFiles = useMemo(() => {
    const files = [
      ...(message.specified_files || []),
      ...(message.uploaded_files || []),
    ];
    return files;
  }, [message.specified_files, message.uploaded_files]);

  // 渲染技能标签
  const renderSkillTag = () => {
    if (!features?.skillTag || !message.skill || !(message.skill.skill_name && message.skill.display_name)) return null;
    return (
      <span className="bg-[#e6e9f2] rounded py-1 px-2 text-sm mr-2">
        {message.skill.display_name || message.skill.skill_name}
      </span>
    );
  };

  // 渲染指定文件头部
  const renderSpecifiedFilesHeader = () => {
    if (!features?.specifiedFiles || !specifiedFiles.length) return undefined;
    
    return (
      <SpecifiedFiles
        files={specifiedFiles}
        type={features?.specifiedFilesType || "no_jump"}
        onFileClick={handleFileClick}
        renderFileLink={renderFileLink}
      />
    );
  };

  return (
    <div
      className={`flex items-center gap-5 rounded-xl ${isShareMode ? "mb-4 px-3 py-4 bg-[#F5F5F5]" : ""}`}
      onClick={handleSelect}
    >
      {isShareMode && <Checkbox checked={isSelected} />}

      <div className="flex-1 overflow-hidden">
        <BubbleUser
          content={parsedContent}
          files={message.uploaded_files}
          avatar={agentLogo}
          className={className}
          style={{
            "--hubx-color-bg-message": "#EBF1FF",
            ...style,
          }}
          header={renderSpecifiedFilesHeader()}
          contentBefore={renderSkillTag()}
          menu={
            !isShareMode && features?.menu?.copy !== false ? (
              <MessageMenu
                type="user"
                content={parsedContent}
                features={{ copy: features?.menu?.copy ?? true }}
              />
            ) : undefined
          }
        />
      </div>
    </div>
  );
}

const UserMessage = memo(UserMessageInner);
UserMessage.displayName = "UserMessage";

export default UserMessage;
