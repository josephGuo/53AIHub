// packages/shared-business/src/chat/components/source/lists/Quotation.tsx

import { useState, useMemo } from 'react';
import { UpOutlined, RightOutlined, LinkOutlined } from '@ant-design/icons';
import { useTranslation, useChatConfig, buildLibraryUrl } from '../../../i18n';
import type { FileItem } from '../../../types/message';

interface QuotationProps {
  type?: string;
  files?: FileItem[];
  /** 点击知识库文件回调 */
  onFileClick?: (file: FileItem) => void;
}

export function Quotation({ type, files = [], onFileClick }: QuotationProps) {
  const { t } = useTranslation();
  const config = useChatConfig();
  const [showFiles, setShowFiles] = useState(false);

  const isWebSearch = type === 'web_search';

  const getIndex = (item: FileItem, sourceKey?: string) => {
    const match = (sourceKey || '').replace('[Source:', '').replace(']', '').split('-');
    const index = isWebSearch ? match[1] : match[0];
    return Number(index) > -1 ? index : '';
  };

  const fileList = useMemo(() => {
    const list = files.map(item => ({
      ...item,
      index: getIndex(item, item.source_key || item.source)
    }));
    return list.sort((a, b) => (a.index as number) - (b.index as number));
  }, [files, isWebSearch]);

  if (!files.length) return null;

  const handleFileClick = (item: FileItem) => {
    if (onFileClick) {
      onFileClick(item);
      return;
    }
    // 使用配置构建 URL
    const url = buildLibraryUrl(config, item.library_id, item.file_id);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      <div
        className="h-8 px-2 rounded-lg cursor-pointer bg-[#F4F5F7] hover:bg-[#E1E2E3] inline-flex items-center mt-3"
        onClick={() => setShowFiles(!showFiles)}
      >
        <p className="text-sm text-[#1D1E1F]">
          {t("chat.quotation", { count: fileList.length }) || `引用 ${fileList.length} 篇资料作为参考`}
        </p>
        {showFiles ? (
          <UpOutlined className="text-[#939499] ml-2" />
        ) : (
          <RightOutlined className="text-[#939499] ml-2" />
        )}
      </div>
      {showFiles && (
        <div className="space-y-1.5 mt-3">
          {fileList.map((item, index) => {
            const displayIndex = item.source_key || item.source
              ? getIndex(item, item.source_key || item.source)
              : index + 1;

            // web_search 类型：外链
            if (isWebSearch || item.chunk_type === 'web_search') {
              return (
                <a
                  key={item.id || index}
                  href={item.file_path || item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <div className="size-4 rounded-full bg-[#EDEDED] flex items-center justify-center text-xs text-[#4F5052]">
                    {displayIndex}
                  </div>
                  <LinkOutlined className="text-[#939499]" />
                  <div className="flex-1 text-sm text-[#1D1E1F] truncate">
                    {item.name || item.file_name}
                  </div>
                </a>
              );
            }

            // 知识库类型：跳转到文档
            return (
              <div
                key={item.id || index}
                className="flex items-center gap-2 cursor-pointer hover:bg-[#F5F5F5] rounded px-1 py-0.5 -mx-1"
                onClick={() => handleFileClick(item)}
              >
                <div className="size-4 rounded-full bg-[#EDEDED] flex items-center justify-center text-xs text-[#4F5052]">
                  {displayIndex}
                </div>
                {item.file_icon && <img src={item.file_icon} className="size-5" alt="" />}
                <div className="flex-1 text-sm text-[#1D1E1F] truncate">
                  {item.name || item.file_name}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default Quotation;