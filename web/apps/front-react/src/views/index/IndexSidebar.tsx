import { useState, useEffect, useMemo, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Tooltip, Modal, Skeleton, message } from "antd";
import { SvgIcon, Dropdown } from "@km/shared-components-react";
import type { MenuProps } from "@km/shared-components-react";
import { ExpandSidebarButton } from "@/components/Layout/ExpandSidebarButton";
import { GroupList } from "@/views/agent/components/GroupList";
import { MyList } from "@/views/agent/components/MyList";
import agentShortcutsApi from "@/api/modules/agent-shortcuts";
import type { AgentShortcutItem } from "@/api/modules/agent-shortcuts/types";
import { checkVersion } from "@/utils/version";
import { VERSION_MODULE } from "@/constants/enterprise";
import { AGENT_USAGES } from "@/constants/agent";
import { t } from "@/locales";
import { getFormatTimeStamp, eventBus } from "@km/shared-utils";
import { EVENT_NAMES } from "@/constants/events";
import { showLoginModal, isLoggedIn } from "@/utils/permission";
import "./index.css";
import { CloudOutlined, PlusOutlined, MoreOutlined, DeleteOutlined } from "@ant-design/icons";
import { getPublicPath } from '@/utils/config';

/** 固定导航项映射（id=0 的占位项） */
const fixedNavItemMap: Record<number, { path: string; label: string; logo: string }> = {
  [AGENT_USAGES.WORK_AI]: {
    path: "/index/chat",
    label: "小助理",
    logo: getPublicPath('/images/chat/workbench.png'),
  },
  [AGENT_USAGES.KM_AI_SEARCH]: {
    path: "/index/knowledge",
    label: "AI搜问",
    logo: getPublicPath('/images/chat/knowledge.png'),
  },
};

/** 动态导航项类型 */
interface NavItem {
  path: string;
  label: string;
  description: string;
  lastMessageContent: string
  logo?: string;
  agentId?: string;
  shortcutId: string;
  isFixed: boolean;
  isPinned: boolean;
  agentUsage?: number;
  lastMessageTime?: number;
}

/** 将快捷方式列表项转换为导航项 */
function shortcutToNavItem(shortcut: AgentShortcutItem): NavItem {
  // id=0 是固定项占位，使用 fixedNavItemMap 的信息
  if (fixedNavItemMap[shortcut.agent_usage]) {
    const fixedItem = fixedNavItemMap[shortcut.agent_usage];
    return {
      path: fixedItem.path,
      label: fixedItem.label,
      logo: fixedItem.logo,
      agentId: shortcut.agent_id,
      description: shortcut.agent_description,
      shortcutId: `fixed-${shortcut.agent_usage}`,
      isFixed: true,
      isPinned: shortcut.is_pinned,
      agentUsage: shortcut.agent_usage,
      lastMessageContent: shortcut.last_message_content,
      lastMessageTime: shortcut.last_message_time,
    };
  }
  // id>0 是真实智能体
  return {
    path: `/index/agent?agent_id=${shortcut.agent_id}`,
    label: shortcut.agent_name,
    lastMessageContent: shortcut.last_message_content,
    description: shortcut.agent_description,
    logo: shortcut.agent_logo,
    agentId: shortcut.agent_id,
    shortcutId: shortcut.agent_id,
    isFixed: false,
    isPinned: shortcut.is_pinned,
    lastMessageTime: shortcut.last_message_time,
  };
}

export function IndexSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showExploreModal, setShowExploreModal] = useState(false);
  const [showMyAgentModal, setShowMyAgentModal] = useState(false);
  const [showAddTooltip, setShowAddTooltip] = useState(false);
  const [shortcuts, setShortcuts] = useState<AgentShortcutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const activeItemRef = useRef<HTMLAnchorElement>(null);

  // 智能体功能开关
  const hasAgent = checkVersion(VERSION_MODULE.AGENT);
  // 知识库功能开关
  const hasKnowledgeBase = checkVersion(VERSION_MODULE.KNOWLEDGE_BASE);

  // 将快捷方式列表转换为导航项，并根据权限过滤
  const navItems = useMemo(() => {
    const seenFixedItems = new Set<number>();

    // 确保固定项存在：检查 shortcuts 中是否包含每个固定项，缺失则补充
    const hasWorkAi = shortcuts.some(s => s.agent_usage === AGENT_USAGES.WORK_AI);
    const hasKmSearch = shortcuts.some(s => s.agent_usage === AGENT_USAGES.KM_AI_SEARCH);

    const defaultWorkAi: AgentShortcutItem = { id: 0, agent_id: '', agent_usage: AGENT_USAGES.WORK_AI, is_pinned: false, last_message_time: 0, last_message_content: '', agent_name: '', agent_logo: '', agent_description: '', channel_type: 0, created_time: 0, updated_time: 0 };
    const defaultKmSearch: AgentShortcutItem = { id: 0, agent_id: '', agent_usage: AGENT_USAGES.KM_AI_SEARCH, is_pinned: false, last_message_time: 0, last_message_content: '', agent_name: '', agent_logo: '', agent_description: '', channel_type: 0, created_time: 0, updated_time: 0 };

    let sourceItems: AgentShortcutItem[];
    if (shortcuts.length === 0) {
      // shortcuts 为空时，根据权限创建默认项
      sourceItems = [defaultWorkAi];
      if (hasKnowledgeBase) {
        sourceItems.push(defaultKmSearch);
      }
    } else {
      // shortcuts 不为空时，补充缺失的固定项
      sourceItems = [...shortcuts];
      if (!hasWorkAi) {
        sourceItems.unshift(defaultWorkAi);
      }
      if (!hasKmSearch && hasKnowledgeBase) {
        sourceItems.push(defaultKmSearch);
      }
    }

    return sourceItems
      .map(shortcutToNavItem)
      .filter((item) => {
        // 固定项去重：只保留第一个出现的
        if (item.isFixed && item.agentUsage) {
          if (seenFixedItems.has(item.agentUsage)) {
            return false;
          }
          seenFixedItems.add(item.agentUsage);
        }

        // 知识搜问需要知识库权限
        if (item.agentUsage === AGENT_USAGES.KM_AI_SEARCH) {
          return hasKnowledgeBase;
        }
        // 非固定项需要智能体权限
        if (!item.isFixed) {
          return hasAgent;
        }
        return true;
      });
  }, [shortcuts, hasKnowledgeBase, hasAgent]);

  // 获取快捷方式列表
  const fetchShortcuts = useMemo(() => async (loading = true) => {
    try {
      setLoading(loading);
      const data = await agentShortcutsApi.list();
      setShortcuts(data);
    } catch (error) {
      console.error("Failed to fetch agent shortcuts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载快捷方式列表
  useEffect(() => {
    fetchShortcuts();
  }, [fetchShortcuts]);

  // 监听快捷方式添加事件，刷新列表
  useEffect(() => {
    const handleShortcutAdded = () => {
      fetchShortcuts();
    };
    eventBus.on(EVENT_NAMES.SHORTCUT_ADDED, handleShortcutAdded);
    return () => {
      eventBus.off(EVENT_NAMES.SHORTCUT_ADDED, handleShortcutAdded);
    };
  }, [fetchShortcuts]);

  // 监听快捷方式更新事件（聊天后刷新 last_message_time）
  useEffect(() => {
    const handleShortcutUpdated = () => {
      fetchShortcuts(false);  // 静默刷新，不显示 loading
    };
    eventBus.on(EVENT_NAMES.SHORTCUT_UPDATED, handleShortcutUpdated);
    return () => {
      eventBus.off(EVENT_NAMES.SHORTCUT_UPDATED, handleShortcutUpdated);
    };
  }, [fetchShortcuts]);

  // 监听登录成功事件，刷新快捷方式列表
  useEffect(() => {
    const handleLoginSuccess = () => {
      fetchShortcuts();
    };
    eventBus.on(EVENT_NAMES.LOGIN_SUCCESS, handleLoginSuccess);
    return () => {
      eventBus.off(EVENT_NAMES.LOGIN_SUCCESS, handleLoginSuccess);
    };
  }, [fetchShortcuts]);

  // 刷新后滚动到选中的智能体
  useEffect(() => {
    if (!loading && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [loading]);

  // 置顶/取消置顶（静默更新）
  const handlePin = async (item: NavItem) => {
    if (!item.agentId) return;
    try {
      await agentShortcutsApi.pin(item.agentId, !item.isPinned);
      message.success(item.isPinned ? t('action.unpin_success') : t('action.pin_success'));
      fetchShortcuts(false);
    } catch (error) {
      message.error(t('action.operation_failed'));
    }
  };

  // 删除快捷方式（二次确认）
  const handleDelete = (item: NavItem) => {
    if (!item.agentId) return;

    // 判断是否是当前正在聊的智能体
    const params = new URLSearchParams(location.search);
    const currentAgentId = params.get("agent_id");
    const isActiveAgent = !item.isFixed && currentAgentId === item.agentId;

    Modal.confirm({
      title: t('common.confirm_delete'),
      okText: t('action.confirm'),
      okType: 'danger',
      cancelText: t('action.cancel'),
      onOk: async () => {
        try {
          await agentShortcutsApi.delete(item.agentId);
          setShortcuts(prev => prev.filter(s => s.agent_id !== item.agentId));
          message.success(t('action.delete_success'));
          // 如果删除的是当前正在聊的智能体，跳转到工作台AI
          if (isActiveAgent) {
            navigate('/index/chat');
          }
        } catch (error) {
          message.error(t('action.operation_failed'));
        }
      },
    });
  };

  return (
    <div className="w-[252px] h-full py-3 bg-[#fff] border-r border-[#E5E7EB] flex flex-col shrink-0">
      <div className="px-5 h-9 flex items-center gap-2">
        <ExpandSidebarButton />
        <div className="flex-1 text-sm text-[#1D1E1F]">{t('workbench.title')}</div>
        {hasAgent && (
          <Tooltip
            open={showAddTooltip}
            onOpenChange={(open) => {
              if (open && !isLoggedIn()) {
                showLoginModal();
                return;
              }
              setShowAddTooltip(open);
            }}
            color="#fff"
            title={
              <>
                <div className="h-7 flex items-center text-xs text-[#9CA3AF]">{t('action.add')}</div>
                <div className="flex flex-col gap-2 mt-1">

                  <div
                    className="flex items-center p-3 border border-[#E6E8EB] hover:bg-[#f0f0f0] cursor-pointer rounded-lg"
                    onClick={() => {
                      setShowAddTooltip(false);
                      setShowExploreModal(true);
                    }}
                  >
                    <div className="size-9 rounded-xl bg-[#F2F3F5] flex items-center justify-center mr-3">
                      <SvgIcon name="airplay" size={18} color="#6B7280" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-[#1D1E1F]">{t('workbench.add_from_portal')}</div>
                      <div className="text-xs text-[#9CA3AF]">{t('workbench.add_from_portal_desc')}</div>
                    </div>
                    <PlusOutlined style={{ fontSize: 16, color: "#9CA3AF" }} />
                  </div>

                  <div
                    className="flex items-center p-3 border border-[#E6E8EB] hover:bg-[#f0f0f0] cursor-pointer rounded-lg"
                    onClick={() => {
                      setShowAddTooltip(false);
                      setShowMyAgentModal(true);
                    }}
                  >
                    <div className="size-9 rounded-xl bg-[#F2F3F5] flex items-center justify-center mr-3">
                      <CloudOutlined style={{ fontSize: 16, color: "#6B7280" }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-[#1D1E1F]">{t('workbench.add_from_my_agent')}</div>
                      <div className="text-xs text-[#9CA3AF]">{t('workbench.add_from_my_agent_desc')}</div>
                    </div>
                    <PlusOutlined style={{ fontSize: 16, color: "#9CA3AF" }} />
                  </div>
                </div>
              </>
            }
            trigger="click"
            placement="bottomLeft"
            classNames={{
              container: 'w-[398px]'
            }}
          >
            <div className="cursor-pointer">
              <SvgIcon name="add-one" size={16} />
            </div>
          </Tooltip>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* 加载中显示骨架屏 */}
        {loading && (
          <div className="p-3">
            <Skeleton active paragraph={{ rows: 0 }} />
          </div>
        )}

        {/* 按API返回顺序渲染导航项 */}
        {!loading &&
          navItems.map((item) => {
            // 自定义 active 判断
            const params = new URLSearchParams(location.search);
            const currentAgentId = params.get("agent_id");
            // 固定项按路径匹配，动态智能体按 agent_id 参数匹配
            const isActive = item.isFixed
              ? location.pathname === item.path
              : location.pathname === "/index/agent" && currentAgentId === item.agentId;

            // 下拉菜单项
            const menuItems: MenuProps['items'] = [
              // {
              //   key: 'pin',
              //   icon: <VerticalAlignTopOutlined />,
              //   label: item.isPinned ? t('action.unpin') : t('action.pin'),
              //   onClick: () => handlePin(item),
              // },
            ];

            // 非固定项才显示删除
            if (!item.isFixed) {
              menuItems.push({
                key: 'delete',
                icon: <DeleteOutlined />,
                label: t('action.delete'),
                danger: true,
                onClick: () => handleDelete(item),
              });
            }

            return (
              <NavLink
                key={item.shortcutId}
                to={item.path}
                ref={isActive ? activeItemRef : null}
                className={() =>
                  `group flex items-center gap-2.5 p-3 rounded-xl transition-colors ${
                    isActive
                      ? "bg-[#E7EFFB]"
                        : item.isPinned
                          ? "bg-[#F5F0FF]"
                          : "hover:bg-[#E7EFFB]"
                  }`
                }
              >
                <div className="flex-none size-9 rounded-full overflow-hidden">
                  {item.logo ? (
                    <img
                      src={item.logo}
                      alt={item.label}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <SvgIcon name="agent" size={18} />
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex-1 text-sm text-[#1D1E1F] truncate">{item.label}</p>
                    {/* 时间和三个点互斥显示 */}
                    {item.lastMessageTime > 0 && (
                      <span className={`text-xs text-[#9CA3AF] ${ menuItems.length > 0 ? 'group-hover:hidden' : '' }  `}>
                        {getFormatTimeStamp(new Date(item.lastMessageTime).toISOString())}
                      </span>
                    )}
                    
                  </div>
                  <p className="text-xs text-[#888994] truncate mt-0.5">
                    { item.lastMessageContent || item.description || '--'}
                  </p>
                </div>
                { menuItems.length > 0 &&  <Dropdown
                  menu={{ items: menuItems }}
                  trigger={['click']}
                  placement="bottomRight"
                >
                  <div
                    className="hidden group-hover:flex size-6 items-center justify-center rounded hover:bg-[#E5E7EB] transition-opacity"
                    onClick={(e) => e.preventDefault()}
                  >
                    <MoreOutlined className="text-[#6B7280]" />
                  </div>
                </Dropdown>}
              </NavLink>
            );
          })}
      </nav>

      {/* AI门户弹窗 */}
      <Modal
        open={showExploreModal}
        onCancel={() => setShowExploreModal(false)}
        footer={null}
        width={800}
        title={t('module.agent')}
        destroyOnClose
      >
        <div className="h-[60vh] overflow-y-auto">
          <GroupList selectMode flatMode />
        </div>
      </Modal>

      {/* 我的智能体弹窗 */}
      <Modal
        open={showMyAgentModal}
        onCancel={() => setShowMyAgentModal(false)}
        footer={null}
        width={800}
        title={t('agent.my_agent')}
        destroyOnClose
      >
        <div className="h-[60vh] overflow-y-auto">
          <MyList selectMode flatMode />
        </div>
      </Modal>
    </div>
  );
}

export default IndexSidebar;
