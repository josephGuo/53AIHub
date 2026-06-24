import {
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useMemo,
} from "react";
import { Drawer, Modal, Input, Button } from "antd";
import { Dropdown, SvgIcon } from "@km/shared-components-react";
import type { ConversationInfo } from "../types";
import { useConversationStore } from "../stores/conversation";
import { useTranslation } from "../i18n";

export interface ChatHistoryRef {
  open: () => void;
}

export interface ChatHistoryProps {
  onNew?: () => void;
  title?: string;
  showCreate?: boolean;
  showItemActions?: boolean;
  /** 侧边栏模式 - 外部控制显示 */
  sidebarMode?: boolean;
  /** 侧边栏模式下的显示状态 */
  open?: boolean;
  /** 侧边栏模式下的关闭回调 */
  onClose?: () => void;
}

const ChatHistory = forwardRef<ChatHistoryRef, ChatHistoryProps>(
  ({ onNew, title, showCreate = true, showItemActions = true, sidebarMode = false, open: externalOpen, onClose }, ref) => {
    const { t } = useTranslation();
    const [internalVisible, setInternalVisible] = useState(false);
    const [editVisible, setEditVisible] = useState(false);
    const [convForm, setConvForm] = useState({
      conversation_id: 0 as string | number,
      title: "",
    });

    // 侧边栏模式使用外部状态，Drawer 模式使用内部状态
    const visible = sidebarMode ? externalOpen : internalVisible;
    const setVisible = sidebarMode
      ? (v: boolean) => { if (!v) onClose?.(); }
      : setInternalVisible;

    const setCurrentState = useConversationStore((state) => state.setCurrentState);
    const delConversationStore = useConversationStore((state) => state.delConversation);
    const editConversationStore = useConversationStore((state) => state.editConversation);
    const conversations = useConversationStore((state) => state.conversations);
    const currentConversationId = useConversationStore(
      (state) => state.current_conversationid
    );

    useImperativeHandle(ref, () => ({
      open: () => {
        if (!sidebarMode) {
          setInternalVisible(true);
        }
      },
    }));

    const handleCreate = useCallback(() => {
      onNew?.();
      setVisible(false);
    }, [onNew, setVisible]);

    const handleEditConv = useCallback(async () => {
      if (!convForm.title.trim()) return;
      await editConversationStore({
        conversation_id: convForm.conversation_id,
        title: convForm.title,
      });
      setEditVisible(false);
    }, [convForm, editConversationStore]);

    const delConversation = useCallback(async (conv: ConversationInfo) => {
      Modal.confirm({
        title: t("chat.conversation_confirm_delete"),
        content: t("action.del"),
        okText: t("action.del"),
        cancelText: t("action.cancel"),
        okButtonProps: { danger: true },
        onOk: () => delConversationStore(conv),
      });
    }, [delConversationStore, t]);

    const handleCommandConv = useCallback((event: string, conv: ConversationInfo) => {
      if (event === "del") {
        delConversation(conv);
      } else if (event === "edit") {
        setConvForm({
          conversation_id: conv.conversation_id,
          title: conv.title || "",
        });
        setEditVisible(true);
      }
    }, [delConversation]);

    const handleSelect = useCallback((conv: ConversationInfo) => {
      setCurrentState(conv.agent_id || 0, conv.conversation_id);
      setVisible(false);
    }, [setCurrentState, setVisible]);

    const menuItems = useCallback((item: ConversationInfo) => [
      {
        key: "edit",
        icon: <SvgIcon name="edit" className="mr-1" />,
        label: t("action.rename"),
      },
      {
        key: "del",
        danger: true,
        icon: <SvgIcon name="del" className="mr-1" />,
        label: t("action.del"),
      },
    ], [t]);

    const currentId = String(currentConversationId);

    // 按时间分类会话
    const groupedConversations = useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      return [
        {
          title: t("time.today"),
          conversations: conversations.filter(
            (item) => {
              const createdTime = item.created_time ? new Date(item.created_time) : null;
              return createdTime && createdTime >= today;
            }
          ),
        },
        {
          title: t("time.yesterday"),
          conversations: conversations.filter((item) => {
            const createdTime = item.created_time ? new Date(item.created_time) : null;
            return createdTime && createdTime >= yesterday && createdTime < today;
          }),
        },
        {
          title: t("time.within_7_days"),
          conversations: conversations.filter((item) => {
            const createdTime = item.created_time ? new Date(item.created_time) : null;
            return createdTime && createdTime >= weekAgo && createdTime < yesterday;
          }),
        },
        {
          title: t("time.over_7_days"),
          conversations: conversations.filter((item) => {
            const createdTime = item.created_time ? new Date(item.created_time) : null;
            return createdTime && createdTime < weekAgo;
          }),
        },
      ];
    }, [conversations, t]);

    // 统一的列表内容
    const content = (
      <>
        {/* 新会话按钮 */}
        {showCreate && (
          <div className="flex-none px-3">
            <div
              className="h-9 flex items-center justify-center cursor-pointer gap-2 border rounded-lg hover:shadow"
              onClick={handleCreate}
            >
              <SvgIcon name="add-chat" className="w-4 h-4 mr-1 text-[#1D1E1F]" />
              <span className="text-sm text-[#1D1E1F]">
                {t("chat.new_conversation")}
              </span>
            </div>
          </div>
        )}

        {/* 对话列表 */}
        <div className={`flex-1 px-3 py-4 overflow-y-auto ${showCreate ? "" : "pt-0"}`}>
          <div className="space-y-1">
            {groupedConversations.map((group) => {
              if (group.conversations.length === 0) return null;
              return (
                <div key={group.title}>
                  <h3 className="h-8 px-2 flex items-center text-sm text-[#999999]">
                    {group.title}
                  </h3>
                  {group.conversations.map((item, index) => (
                    <div
                      key={item.conversation_id || `conv-${index}`}
                      className="relative group"
                    >
                      <div
                        className={`w-full h-9 px-2 rounded flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer ${
                          String(item.conversation_id) === currentId
                            ? "bg-blue-50"
                            : "bg-white"
                        }`}
                        onClick={() => handleSelect(item)}
                      >
                        <p className="text-sm text-gray-700 truncate flex-1">
                          {item.title || t("chat.no_title")}
                        </p>
                        {showItemActions && (
                          <Dropdown
                            menu={{
                              items: menuItems(item),
                              onClick: ({ key }) => handleCommandConv(key, item),
                            }}
                            trigger={["hover"]}
                            placement="bottom"
                          >
                            <div
                              className="invisible group-hover:visible transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <SvgIcon name="more-h" />
                            </div>
                          </Dropdown>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </>
    );

    // 编辑弹窗
    const editModal = (
      <Modal
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        title={t("chat.edit_conversation")}
        onOk={handleEditConv}
        okButtonProps={{ disabled: !convForm.title.trim() }}
        width={480}
      >
        <Input
          size="large"
          value={convForm.title}
          onChange={(e) =>
            setConvForm({
              ...convForm,
              title: e.target.value,
            })
          }
          placeholder={t("chat.conversation_title_placeholder")}
          maxLength={20}
          showCount
        />
      </Modal>
    );

    // 侧边栏模式：返回固定侧边栏
    if (sidebarMode) {
      return (
        <>
          <div className="h-full bg-white border-r border-gray-200 flex flex-col">
            {/* 头部区域 */}
            <div className="flex-none px-3 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <SvgIcon name="history" className="w-4 h-4 text-gray-600" />
                  </div>
                  <h2 className="text-base font-medium text-gray-900">
                    {title || t("chat.history_conversation")}
                  </h2>
                </div>
                <Button type="link" size="small" onClick={onClose}>
                  <SvgIcon name="double-left" className="w-4 h-4 text-gray-500" />
                </Button>
              </div>
            </div>
            {content}
          </div>
          {editModal}
        </>
      );
    }

    // Drawer 模式（默认）
    return (
      <>
        <Drawer
          open={visible}
          onClose={() => setVisible(false)}
          title={title || t("chat.history_conversation")}
          styles={{ wrapper: { width: 300 }, body: { padding: 'var(--ant-padding-lg) 0' } }}
        >
          {content}
        </Drawer>
        {editModal}
      </>
    );
  },
);

ChatHistory.displayName = "ChatHistory";

export default ChatHistory;
