// packages/shared-business/src/chat/components/source/SpecifiedFiles.tsx

import { memo } from "react";
import { Tooltip } from "antd";
import { SvgIcon } from "@km/shared-components-react";
import { useTranslation } from "../../i18n";
import type { FileItem } from "../../types/message";

export interface SpecifiedFilesProps {
  /** 文件列表 */
  files?: FileItem[];
  /** 显示类型：no_jump 不跳转，jump 支持跳转 */
  type?: "no_jump" | "jump";
  /** 引用内容（替代文件显示） */
  content?: string;
  /** 是否展开显示内容 */
  isExpanded?: boolean;
  /** 文件点击回调 */
  onFileClick?: (file: FileItem) => void;
  /** 自定义跳转链接渲染 */
  renderLink?: (file: FileItem, children: React.ReactNode) => React.ReactNode;
}

function SpecifiedFilesInner({
  files,
  type = "no_jump",
  content,
  isExpanded = false,
  onFileClick,
  renderLink,
}: SpecifiedFilesProps) {
  const { t } = useTranslation();

  // Content display mode
  if (content) {
    if (isExpanded) {
      return (
        <div className="mb-2">
          <div className="max-w-[568px] p-2 rounded-lg cursor-pointer text-[#4F5052] bg-[#F8F9FA] hover:bg-[#E1E2E3] inline-flex items-end gap-1">
            <SvgIcon className="flex-none" name="corner-down-right" />
            <p className="text-sm text-start">{content}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="mb-2">
        <Tooltip title={content}>
          <div className="max-w-40 h-7 px-2 rounded-lg cursor-pointer text-[#4F5052] bg-[#F8F9FA] hover:bg-[#E1E2E3] inline-flex items-center gap-1">
            <SvgIcon className="flex-none" name="corner-down-right" />
            <p className="text-sm truncate">{content}</p>
          </div>
        </Tooltip>
      </div>
    );
  }

  // Files display mode
  if (!files?.length) return null;

  const renderFileItem = (file: FileItem) => {
    const inner = (
      <>
        <SvgIcon className="flex-none" name="corner-down-right" />
        {file.icon && <img src={file.icon} className="size-3" alt="" />}
        <p className="text-sm truncate">{file.name || file.file_name}</p>
      </>
    );

    // 如果提供了自定义链接渲染，使用它
    if (renderLink && type === "jump") {
      return renderLink(file, inner);
    }

    // no_jump 模式或无渲染器时，使用点击回调
    return (
      <div
        key={file.id}
        className="max-w-40 h-7 px-2 rounded-lg cursor-pointer text-[#4F5052] bg-[#F8F9FA] hover:bg-[#E1E2E3] inline-flex items-center gap-1"
        onClick={() => onFileClick?.(file)}
      >
        {inner}
      </div>
    );
  };

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {files.map(renderFileItem)}
    </div>
  );
}

const SpecifiedFiles = memo(SpecifiedFilesInner);
SpecifiedFiles.displayName = "SpecifiedFiles";

export default SpecifiedFiles;
