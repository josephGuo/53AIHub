// packages/shared-business/src/chat/components/source/panels/ThinkKnowledge.tsx

import { forwardRef, useImperativeHandle, useState } from 'react';
import { Drawer, List } from 'antd';
import { useTranslation } from '../../../i18n';
import type { FileItem } from '../../../types/message';

export interface ThinkKnowledgeRef {
  updateResults: (files: FileItem[], type?: string) => void;
  selectItem: (item: FileItem) => void;
}

interface ThinkKnowledgeProps {
  onClose: () => void;
}

const ThinkKnowledge = forwardRef<ThinkKnowledgeRef, ThinkKnowledgeProps>(({ onClose }, ref) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);

  useImperativeHandle(ref, () => ({
    updateResults: (newFiles: FileItem[], _type?: string) => {
      setFiles(newFiles);
    },
    selectItem: (item: FileItem) => {
      setSelectedId(item.id || null);
    },
  }));

  return (
    <Drawer
      title={t("source.knowledge_title") || "知识库引用"}
      placement="right"
      width={400}
      open={true}
      onClose={onClose}
    >
      <List
        dataSource={files}
        renderItem={(item) => (
          <List.Item
            style={{ backgroundColor: selectedId === item.id ? '#f0f0f0' : undefined, cursor: 'pointer' }}
            onClick={() => setSelectedId(item.id)}
          >
            <div className="truncate">{item.name || item.file_name}</div>
          </List.Item>
        )}
      />
    </Drawer>
  );
});

ThinkKnowledge.displayName = 'ThinkKnowledge';

export default ThinkKnowledge;