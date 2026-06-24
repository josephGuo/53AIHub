import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Table, Button, Modal, message, Empty } from "antd";
import { Dropdown, Search, SvgIcon } from "@km/shared-components-react";
import { MoreOutlined } from "@ant-design/icons";
import { t } from "@/locales";
import { groupApi } from "@/api/modules/group";
import { useEnterpriseStore } from "@/stores";
import {
  GROUP_TYPE,
  GroupType,
  RESOURCE_TYPE,
  ResourceType,
} from "@/constants/group";
import GroupAddDialog from "../components/GroupAddDialog";
import { DeptMemberPicker } from "@/components/DeptMemberPicker";
import { ResourcePicker } from "@/components/ResourcePicker";
import type { ColumnsType } from "antd/es/table";

// Types
interface GroupItem {
  group_id: number;
  group_name: string;
}

interface UserItem {
  id: number;
  user_id: number;
  nickname: string;
  name?: string;
  mobile: string;
  dept_names?: string;
  resource_type?: string;
  department?: { name: string };
  deleting?: boolean;
}

// Available buttons config
const getAvailableBtns = () => [
  { type: GROUP_TYPE.AGENT, label: t("module.agent") },
  { type: GROUP_TYPE.PROMPT, label: t("module.prompt") },
  { type: GROUP_TYPE.AI_LINK, label: t("module.ai_toolbox") },
];

export function UserGroup() {
  const enterpriseStore = useEnterpriseStore();

  // Group list state
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupData, setGroupData] = useState<GroupItem[]>([]);
  const [groupKeyword, setGroupKeyword] = useState("");
  const groupKeywordRef = useRef(groupKeyword);
  groupKeywordRef.current = groupKeyword;
  const [activeGroupId, setActiveGroupId] = useState(0);

  // Tab state
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [activeAvailableTabIndex, setActiveAvailableTabIndex] =
    useState<GroupType>(GROUP_TYPE.AGENT);

  // User list state
  const [userLoading, setUserLoading] = useState(false);
  const [userTableData, setUserTableData] = useState<UserItem[]>([]);
  const [userTableTotal, setUserTableTotal] = useState(0);
  const [userKeyword, setUserKeyword] = useState("");
  const userKeywordRef = useRef(userKeyword);
  userKeywordRef.current = userKeyword;
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);
  const paginationRef = useRef({ userPage, userPageSize });
  paginationRef.current = { userPage, userPageSize };

  // Resource list state
  const [availableData, setAvailableData] = useState<any[]>([]);

  // Dialog state
  const [groupAddDialogOpen, setGroupAddDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);

  // Available buttons
  const availableBtns = useMemo(() => getAvailableBtns(), []);

  // Active group info
  const activeGroupInfo = useMemo(() => {
    return groupData.find((item) => item.group_id === activeGroupId) || {};
  }, [groupData, activeGroupId]);

  // Resource type based on active tab
  const resourceType = useMemo<ResourceType>(() => {
    switch (activeAvailableTabIndex) {
      case GROUP_TYPE.AGENT:
        return RESOURCE_TYPE.AGENT;
      case GROUP_TYPE.PROMPT:
        return RESOURCE_TYPE.PROMPT;
      case GROUP_TYPE.AI_LINK:
        return RESOURCE_TYPE.AI_LINK;
      default:
        return RESOURCE_TYPE.AGENT;
    }
  }, [activeAvailableTabIndex]);

  // ID field name
  const idName = useMemo(() => {
    if (resourceType === RESOURCE_TYPE.AGENT) return "agent_id";
    if (resourceType === RESOURCE_TYPE.PROMPT) return "prompt_id";
    return "id";
  }, [resourceType]);

  // Fetch group data
  const fetchGroupData = useCallback(async () => {
    setGroupLoading(true);
    try {
      const list = await groupApi.list({
        params: { group_type: GROUP_TYPE.INTERNAL_USER },
      });
      const filtered = list.filter((item: any) =>
        (item.group_name || "").includes(groupKeywordRef.current),
      );
      setGroupData(filtered);
      if (!activeGroupId && filtered.length > 0) {
        setActiveGroupId(filtered[0].group_id);
      }
    } finally {
      setGroupLoading(false);
    }
  }, [activeGroupId]);

  // Fetch user data
  const fetchUserData = useCallback(
    async (overrides?: { page?: number; pageSize?: number }) => {
      if (!activeGroupId) return;
      setUserLoading(true);
      const { userPage, userPageSize } = {
        ...paginationRef.current,
        ...overrides,
      };
      try {
        const { total = 0, list = [] } = await groupApi.user_list({
          group_id: activeGroupId,
          keyword: userKeywordRef.current,
          offset: (userPage - 1) * userPageSize,
          limit: userPageSize,
        });
        setUserTableTotal(total);
        setUserTableData(list);
      } finally {
        setUserLoading(false);
      }
    },
    [activeGroupId],
  );

  // Fetch resource data
  const fetchResourceData = useCallback(async () => {
    if (!activeGroupId) return;
    const { list = [] } = await groupApi.resource_list({
      id: activeGroupId,
      params: {
        offset: 0,
        limit: 1000,
        resource_type: resourceType,
      },
    });
    setAvailableData(list);
  }, [activeGroupId, resourceType]);

  // Refresh (reset to page 1 and fetch data)
  const refresh = useCallback(() => {
    if (activeTabIndex === 0) {
      setUserPage(1);
      fetchUserData({ page: 1 });
    } else {
      fetchResourceData();
    }
  }, [activeTabIndex, fetchUserData, fetchResourceData]);

  // Handle group click
  const handleGroupClick = (item: GroupItem) => {
    setActiveGroupId(item.group_id);
    setUserKeyword("");
    setUserPage(1);
  };

  // Handle group command
  const handleGroupCommand = useCallback(
    async (command: string, item: GroupItem, index: number) => {
      switch (command) {
        case "create":
          setEditingGroup(null);
          setGroupAddDialogOpen(true);
          break;
        case "rename":
          setEditingGroup(item);
          setGroupAddDialogOpen(true);
          break;
        case "delete":
          Modal.confirm({
            title: t("action_delete"),
            content: t("group_delete_confirm"),
            onOk: async () => {
              await groupApi.delete({ data: { group_id: item.group_id } });
              message.success(t("action_delete_success"));
              groupApi.clearCache(GROUP_TYPE.INTERNAL_USER);
              fetchGroupData();
            },
          });
          break;
      }
    },
    [fetchGroupData],
  );

  // Handle user add confirm
  const handleUserAddConfirm = async ({ value = [] }: { value: any[] }) => {
    if (!activeGroupId) {
      message.warning(t("internal_user.group.create_tip"));
      return;
    }
    const department_ids = value
      .filter((item) => +item.did)
      .map((item) => +item.did);
    const user_ids = value
      .filter((item) => +item.user_id)
      .map((item) => +item.user_id);
    await groupApi.batch_add_user({
      group_id: activeGroupId,
      department_ids,
      user_ids,
    });
    message.success(t("action_add_success"));
    refresh();
  };

  // Handle user remove
  const handleUserRemove = async (item: UserItem) => {
    Modal.confirm({
      title: t("tip"),
      content: t("internal_user.group.remove_user_confirm"),
      onOk: async () => {
        await groupApi.remove_user({
          group_id: activeGroupId,
          permission_ids: [item.id],
        });
        message.success(t("action_remove_success"));
        fetchUserData();
      },
    });
  };

  // Handle resource add confirm
  const handleResourceAddConfirm = async ({ value = [] }: { value: any[] }) => {
    if (!activeGroupId) {
      message.warning(t("internal_user.group.create_tip"));
      return;
    }
    const resource_ids = value
      .filter((item) => item[idName])
      .map((item) => item[idName]);
    await groupApi.batch_add_resource({
      id: activeGroupId,
      request: {
        resource_ids,
        resource_type: resourceType,
      },
    });
    message.success(t("action_add_success"));
    refresh();
  };

  // Handle resource remove
  const handleResourceRemove = async ({ value = [] }: { value: any[] }) => {
    const resource_ids = value
      .filter((item) => item[idName])
      .map((item) => item[idName]);

    let confirmText = "";
    switch (resourceType) {
      case RESOURCE_TYPE.AGENT:
        confirmText = t("internal_user.group.remove_agent_confirm");
        break;
      case RESOURCE_TYPE.PROMPT:
        confirmText = t("internal_user.group.remove_prompt_confirm");
        break;
      case RESOURCE_TYPE.AI_LINK:
        confirmText = t("internal_user.group.remove_ai_toolkit_confirm");
        break;
    }

    Modal.confirm({
      title: t("tip"),
      content: confirmText,
      onOk: async () => {
        await groupApi.remove_resource({
          id: activeGroupId,
          request: {
            resource_ids,
            resource_type: resourceType,
          },
        });
        message.success(t("action_remove_success"));
        fetchResourceData();
      },
    });
  };

  // User table columns
  const userColumns: ColumnsType<UserItem> = [
    {
      title: t("internal_user.account.name"),
      dataIndex: "nickname",
      key: "nickname",
      render: (value: string, record) => (
        <div className="flex items-center gap-2">
          <SvgIcon
            name={
              record.resource_type === "department" ? "department" : "member"
            }
            width="16px"
            height="16px"
            color="#999"
          />
          <span>{value || record.name || "--"}</span>
        </div>
      ),
    },
    {
      title: t("internal_user.account.mobile"),
      dataIndex: "mobile",
      key: "mobile",
      render: (value: string) => (
        <span className={!value ? "text-gray-400" : ""}>{value || "--"}</span>
      ),
    },
    {
      title: t("internal_user.account.department"),
      dataIndex: "dept_names",
      key: "department",
      render: (value: string) => value || enterpriseStore.info?.name || "--",
    },
    {
      title: t("operation"),
      key: "operation",
      width: 80,
      fixed: "end",
      render: (_: any, record: UserItem) => (
        <Button
          type="link"
          danger
          icon={<SvgIcon name="delete" />}
          className="opacity-0 group-hover:opacity-100"
          loading={record.deleting}
          onClick={(e) => {
            e.stopPropagation();
            handleUserRemove(record);
          }}
        />
      ),
    },
  ];

  // Initial load
  useEffect(() => {
    fetchGroupData();
  }, []);

  // Load data when activeGroupId or pagination changes
  useEffect(() => {
    if (activeTabIndex === 0) {
      fetchUserData();
    } else {
      fetchResourceData();
    }
  }, [
    activeGroupId,
    activeTabIndex,
    activeAvailableTabIndex,
    userPage,
    userPageSize,
  ]);

  return (
    <div className="bg-white h-full flex">
      {/* Left: Group List */}
      <div className="w-[280px] flex flex-col pr-5 py-2 border-r border-gray-200">
        <div className="flex items-center gap-2">
          <Search
            mode="expanded"
            value={groupKeyword}
            onDebouncedChange={(val) => {
              groupKeywordRef.current = val;
              setGroupKeyword(val);
              fetchGroupData();
            }}
            placeholder={t("internal_user.group.search_placeholder")}
            className="flex-1"
          />
        </div>

        <ul className="flex-1 h-0 w-full mt-4 overflow-auto">
          {groupLoading ? (
            <div className="text-center py-4">Loading...</div>
          ) : groupData.length === 0 ? (
            <Empty description={t("no_data")} className="mt-10" />
          ) : (
            groupData.map((item, index) => (
              <li
                key={item.group_id}
                className="group w-full flex items-center gap-2 cursor-pointer hover:bg-gray-50"
                onClick={() => handleGroupClick(item)}
              >
                <div
                  className={`flex-1 w-0 text-sm truncate rounded-md py-2 px-4 hover:bg-blue-50 ${
                    activeGroupId === item.group_id
                      ? "text-blue-600 bg-blue-50"
                      : "text-gray-800"
                  }`}
                  title={item.group_name}
                >
                  {item.group_name || "--"}
                </div>
                <Dropdown
                  menu={{
                    items: [
                      { key: "rename", label: t("action_rename") },
                      {
                        key: "delete",
                        label: t("action_delete"),
                        danger: true,
                      },
                    ],
                    onClick: ({ key }) => handleGroupCommand(key, item, index),
                  }}
                  trigger={["click"]}
                >
                  <MoreOutlined
                    className="text-gray-400 rotate-90 mr-2 opacity-0 group-hover:opacity-100 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                </Dropdown>
              </li>
            ))
          )}
        </ul>

        <div className="w-full flex items-center gap-2 mt-4">
          <Button
            color="primary"
            variant="filled"
            className="mx-auto !border-none"
            onClick={() => handleGroupCommand("create", {} as any, 0)}
          >
            +{t("internal_user.group.create")}
          </Button>
        </div>
      </div>

      {/* Right: Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Tab header */}
        <div className="h-8 flex items-center px-4 text-base">
          <label
            className={`cursor-pointer ${
              activeTabIndex === 0 ? "text-blue-600" : "text-gray-800"
            }`}
            onClick={() => setActiveTabIndex(0)}
          >
            {t("internal_user.group.member")}
          </label>
          <span className="w-px h-5 bg-gray-300 mx-2" />
          <label
            className={`cursor-pointer ${
              activeTabIndex === 1 ? "text-blue-600" : "text-gray-800"
            }`}
            onClick={() => setActiveTabIndex(1)}
          >
            {t("internal_user.group.usable")}
          </label>
        </div>

        {/* Tab content: Member */}
        {activeTabIndex === 0 && (
          <div className="flex-1 overflow-hidden px-4">
            <div className="flex items-center justify-between h-10 gap-4">
              <h1
                className="truncate text-base"
                title={activeGroupInfo.group_name}
              >
                {activeGroupInfo.group_name || "--"}
              </h1>
              <div className="flex items-center gap-4">
                <Search
                  mode="expanded"
                  value={userKeyword}
                  onDebouncedChange={(val) => {
                    userKeywordRef.current = val;
                    setUserKeyword(val);
                    refresh();
                  }}
                  placeholder={t(
                    "internal_user.organization.all_search_placeholder",
                  )}
                  className="w-[268px]"
                />
                <DeptMemberPicker onConfirm={handleUserAddConfirm}>
                  <Button type="primary">{t("action_add")}</Button>
                </DeptMemberPicker>
              </div>
            </div>

            <Table
              className="mt-4"
              rowKey="id"
              columns={userColumns}
              dataSource={userTableData}
              loading={userLoading}
              pagination={{
                current: userPage,
                pageSize: userPageSize,
                total: userTableTotal,
                showSizeChanger: true,
                showTotal: (total) => t("table_footer_text", { total }),
                onChange: (page, pageSize) => {
                  setUserPage(page);
                  setUserPageSize(pageSize);
                },
              }}
              rowClassName="group cursor-pointer hover:bg-gray-50"
              scroll={{ x: "max-content" }}
            />
          </div>
        )}

        {/* Tab content: Available */}
        {activeTabIndex === 1 && (
          <div className="flex-1 overflow-auto px-4">
            <div className="flex items-center gap-3 mt-2">
              {availableBtns.map((item) => (
                <Button
                  key={item.type}
                  className={`leading-9 px-3 text-sm rounded-md ${
                    activeAvailableTabIndex === item.type
                      ? "text-blue-600 bg-blue-50"
                      : "text-gray-600 bg-gray-100"
                  }`}
                  onClick={() => setActiveAvailableTabIndex(item.type)}
                >
                  {item.label}
                </Button>
              ))}
            </div>

            <ResourcePicker
              value={availableData}
              groupType={activeAvailableTabIndex}
              className="mt-4"
              onConfirm={handleResourceAddConfirm}
              onRemove={handleResourceRemove}
            />
          </div>
        )}
      </div>

      {/* Group Add Dialog */}
      <GroupAddDialog
        open={groupAddDialogOpen}
        data={editingGroup || undefined}
        onClose={() => {
          setGroupAddDialogOpen(false);
          setEditingGroup(null);
        }}
        onSuccess={() => {
          setGroupAddDialogOpen(false);
          setEditingGroup(null);
          groupApi.clearCache(GROUP_TYPE.INTERNAL_USER);
          fetchGroupData();
        }}
      />
    </div>
  );
}

export default UserGroup;
