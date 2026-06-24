import {
  CheckOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { Button, Modal, Radio, Tree, Skeleton, Tooltip } from "antd";
import { SvgIcon, Search } from "@km/shared-components-react";
import type { TreeProps } from "antd";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { t } from "@/locales";
import { departmentApi, getRootDepartmentData } from "@/api/modules/department";
import { groupApi } from "@/api/modules/group";
import { INTERNAL_USER_STATUS_ALL, userApi } from "@/api/modules/user";
import { GROUP_TYPE, type GroupType } from "@/constants/group";

export interface DeptMemberPickerValue {
  value: number | string;
  label: string;
  name?: string;
  user_id?: number;
  did?: number;
  type?: "member" | "group" | "department";
  dept_id_list?: number[];
  group_id?: number;
  group_name?: string;
  nickname?: string;
}

export interface DeptMemberPickerRef {
  open: () => void;
  close: () => void;
}

export interface DeptMemberPickerProps {
  /** simpleValue=true 时为 number[]，否则为 DeptMemberPickerValue[] */
  value?: DeptMemberPickerValue[] | number[];
  /** simpleValue=true 时参数为 number[]，否则为 DeptMemberPickerValue[] */
  onChange?: (value: DeptMemberPickerValue[] | number[]) => void;
  onConfirm?: (result: { value: DeptMemberPickerValue[] | number[] }) => void;
  onValueChange?: (result: {
    value: DeptMemberPickerValue[] | number[];
  }) => void;
  type?: "general" | "department" | "user" | "group";
  defaultFirstValue?: boolean;
  defaultAll?: boolean;
  defaultFirst?: boolean;
  multiple?: boolean;
  showGroup?: boolean;
  allowSelectAllCompany?: boolean;
  trigger?: React.ReactNode;
  children?: React.ReactNode;
  groupType?: GroupType;
  simpleValue?: boolean;
}

interface TreeNode {
  value: number | string;
  label: string;
  name?: string;
  user_id?: number;
  did?: number;
  type?: "member" | "group" | "department";
  children?: TreeNode[];
  dept_id_list?: number[];
  group_id?: number;
  group_name?: string;
}

function DeptMemberPickerInner(
  props: DeptMemberPickerProps,
  ref: React.ForwardedRef<DeptMemberPickerRef>,
) {
  const {
    value = [],
    onChange,
    onConfirm,
    onValueChange,
    type = "general",
    defaultFirstValue = true,
    defaultAll = false,
    defaultFirst = false,
    multiple = true,
    showGroup = false,
    allowSelectAllCompany = false,
    trigger,
    children,
    groupType = GROUP_TYPE.INTERNAL_USER,
    simpleValue = false,
  } = props;

  const isGroupMode = type === "group";
  const triggerElement = trigger || children;

  const [visible, setVisible] = useState(false);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [groupData, setGroupData] = useState<TreeNode[]>([]);
  const [selectedValue, setSelectedValue] = useState<DeptMemberPickerValue[]>(
    [],
  );
  const [selectionMode, setSelectionMode] = useState<"member" | "group">(
    isGroupMode ? "group" : "member",
  );
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [rootData, setRootData] = useState<TreeNode>({} as TreeNode);
  const [visibleCount, setVisibleCount] = useState<number | null>(null); // null 表示未检测，显示全部
  const ulRef = useRef<HTMLUListElement>(null);

  const treeRef = useRef<any>(null);
  const treeGroupRef = useRef<any>(null);
  const didApplyDefault = useRef(false);

  const onChangeRef = useRef(onChange);
  const onConfirmRef = useRef(onConfirm);
  const onValueChangeRef = useRef(onValueChange);
  useEffect(() => {
    onChangeRef.current = onChange;
    onConfirmRef.current = onConfirm;
    onValueChangeRef.current = onValueChange;
  }, [onChange, onConfirm, onValueChange]);

  // Normalize value for display (handles simpleValue number[] → display items)
  const displayItems = useMemo(() => {
    if (
      isGroupMode &&
      simpleValue &&
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0] === "number"
    ) {
      // 过滤掉不在 groupData 中的值
      return (value as number[])
        .filter((id) => groupData.some((g) => g.value === id))
        .map((id) => {
          const group = groupData.find((g) => g.value === id);
          return {
            value: id,
            label: group?.label || group?.group_name || String(id),
            name: group?.label || group?.group_name || group?.name || "",
            type: "group" as const,
            group_id: id as any,
            group_name: group?.group_name || group?.label || "",
          };
        });
    }
    // 标准化数据格式，确保 name 字段存在
    return (value as DeptMemberPickerValue[]).map((item: any) => ({
      ...item,
      name: item.name || item.label || "",
      label: item.label || item.name || "",
      value: item.value ?? item.did ?? item.user_id ?? 0,
    }));
  }, [isGroupMode, simpleValue, value, groupData]);

  // 检测是否换行，动态调整显示数量
  useEffect(() => {
    const ul = ulRef.current;
    if (!ul || displayItems.length <= 3) {
      setVisibleCount(null);
      return;
    }

    const checkOverflow = () => {
      if (!ul) return;

      const lis = ul.querySelectorAll('li[data-item="true"]');
      if (lis.length < 2) {
        setVisibleCount(3);
        return;
      }

      const firstTop = lis[0].offsetTop;
      for (let i = 1; i < lis.length; i++) {
        if (lis[i].offsetTop > firstTop + 2) {
          // 换行了，保留到换行前一个，再减 1 给 +n 和 button 留空间
          setVisibleCount(Math.max(1, i - 2));
          return;
        }
      }
      // 没换行，最多显示 3 个
      setVisibleCount(3);
    };

    // 监听容器尺寸变化
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(checkOverflow);
    });
    resizeObserver.observe(ul);

    return () => {
      resizeObserver.disconnect();
    };
  }, [displayItems]);

  // setModelValue - 与 Vue 的 setModelValue 一致
  const setModelValue = (params: { value?: DeptMemberPickerValue[] } = {}) => {
    const newValue = JSON.parse(JSON.stringify(params.value || []));
    setSelectedValue(newValue);
    onChange?.(newValue);
    onValueChange?.({ value: newValue });
  };

  // 获取部门树
  const fetchDepartmentTree = async () => {
    setLoading(true);
    try {
      const data = await departmentApi.fetch_department_tree();
      setTreeData(data);
      setRootData(data[0] || {});
      return data;
    } finally {
      setLoading(false);
    }
  };

  // 获取内部用户 - 与 Vue 的 fetchInternalUserData 一致
  const fetchInternalUserData = async () => {
    const params = {
      status: INTERNAL_USER_STATUS_ALL,
      offset: 0,
      limit: 10000,
    };
    const { list = [] } = await userApi.fetch_internal_user(params);
    return list.map((item: any) => ({
      ...item,
      value: +item.user_id || 0,
      label: item.nickname || item.name || "",
      type: "member" as const,
    }));
  };

  // 获取分组数据
  const fetchGroupData = async (gType?: GroupType) => {
    const list = await groupApi.list({
      params: { group_type: gType || groupType },
    });
    const data = list.map((item: any) => ({
      ...item,
      value: item.group_id || 0,
      label: item.group_name || "",
      type: "group" as const,
    }));
    setGroupData(data);
    return data;
  };

  // 初始化
  useEffect(() => {
    const init = async () => {
      if (isGroupMode) {
        setLoading(true);
        try {
          const groups = await fetchGroupData();
          const isEmpty =
            !value || (Array.isArray(value) && value.length === 0);
          if (!didApplyDefault.current && isEmpty) {
            didApplyDefault.current = true;
            if (defaultAll) {
              const allIds = groups.map((g) => g.value);
              setTimeout(() => {
                if (simpleValue) {
                  onChangeRef.current?.(allIds as number[]);
                } else {
                  onChangeRef.current?.(groups as DeptMemberPickerValue[]);
                }
              }, 0);
            } else if (defaultFirst && groups.length > 0) {
              setTimeout(() => {
                if (simpleValue) {
                  onChangeRef.current?.([groups[0].value] as number[]);
                } else {
                  onChangeRef.current?.([groups[0]] as DeptMemberPickerValue[]);
                }
              }, 0);
            }
          }
        } finally {
          setLoading(false);
        }
        return;
      }

      if (["general", "department", "user"].includes(type)) {
        const root = await getRootDepartmentData();
        setRootData(root);

        if (defaultFirstValue && !value.length) {
          setModelValue({ value: [root] });
        }

        const [deptTree, users] = await Promise.all([
          fetchDepartmentTree(),
          ["general", "user"].includes(type)
            ? fetchInternalUserData()
            : Promise.resolve([]),
        ]);

        if (["general", "user"].includes(type) && users.length) {
          const findData = (data: any = {}): TreeNode => {
            const children = (data.children || []).map((item: any) =>
              findData(item),
            );
            users.forEach((item: any) => {
              const deptIdList = item.dept_id_list || [];
              if (
                deptIdList.includes(data.did) ||
                (!deptIdList.length && data.did === 0)
              ) {
                children.push(JSON.parse(JSON.stringify(item)));
              }
            });
            return { ...data, children };
          };

          setTreeData(deptTree.map((item: any) => findData(item)));
        }
      }

      if (showGroup) {
        await fetchGroupData();
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 打开对话框
  const open = () => {
    let normalizedValue: DeptMemberPickerValue[];
    if (
      isGroupMode &&
      simpleValue &&
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0] === "number"
    ) {
      // 过滤掉不在 groupData 中的值，只展示匹配到的内部用户分组
      normalizedValue = (value as number[])
        .filter((id) => groupData.some((g) => g.value === id))
        .map((id) => {
          const group = groupData.find((g) => g.value === id);
          return group ? { ...group } : { value: id, label: String(id), type: "group" as const };
        });
    } else {
      normalizedValue = JSON.parse(JSON.stringify(value)).map(
        (item: any = {}) => {
          item.value = +item.value || +item.did || +item.user_id || 0;
          item.label = item.label || item.name || "";
          return item;
        },
      );
    }
    setSelectedValue(normalizedValue);
    setKeyword("");
    setVisible(true);
  };

  const close = () => {
    setVisible(false);
  };

  useImperativeHandle(ref, () => ({
    open,
    close,
  }));

  // 过滤节点 - 与 Vue 的 filterNode 一致
  const filterNode = (nodeValue: string, data: any): boolean => {
    if (!nodeValue) return true;
    if (selectionMode === "group") {
      return (
        (data.label || "").includes(nodeValue) ||
        (data.group_name || "").includes(nodeValue)
      );
    }
    return (
      (data.name || "").includes(nodeValue) ||
      (data.label || "").includes(nodeValue)
    );
  };

  // 过滤树数据 - 递归过滤并保留匹配节点的父节点
  const filterTreeData = useCallback(
    (data: TreeNode[], keyword: string): TreeNode[] => {
      if (!keyword.trim()) return data;

      const filterNodeRecursive = (nodes: TreeNode[]): TreeNode[] => {
        return nodes
          .map((node) => {
            const filteredChildren = node.children
              ? filterNodeRecursive(node.children)
              : [];

            const isMatch = filterNode(keyword, node);

            // 如果当前节点匹配或有匹配的子节点，保留该节点
            if (isMatch || filteredChildren.length > 0) {
              return {
                ...node,
                children: filteredChildren,
              };
            }
            return null;
          })
          .filter((node) => node !== null) as TreeNode[];
      };

      return filterNodeRecursive(data);
    },
    [selectionMode],
  );

  // 过滤后的树数据
  const filteredTreeData = useMemo(() => {
    return filterTreeData(treeData, keyword);
  }, [treeData, keyword, filterTreeData]);

  // 过滤后的分组数据
  const filteredGroupData = useMemo(() => {
    if (!keyword.trim()) return groupData;
    return groupData.filter((node) => filterNode(keyword, node));
  }, [groupData, keyword]);

  // 处理节点点击 - 与 Vue 的 handleNodeClick 一致
  const handleNodeClick = (data: TreeNode) => {
    if (type === "user") {
      if (allowSelectAllCompany) {
        if (!data.user_id && data.value) return;
      } else if (!data.user_id) {
        return;
      }
    }

    if (multiple) {
      if (selectedValue.some((i) => i.value === data.value)) {
        setSelectedValue(selectedValue.filter((i) => i.value !== data.value));
      } else {
        setSelectedValue([...selectedValue, data]);
      }
    } else {
      setSelectedValue([data]);
    }
  };

  // 处理分组节点点击 - 与 Vue 的 handleNodeClickGroup 一致
  const handleNodeClickGroup = (data: TreeNode) => {
    if (selectedValue.some((i) => i.value === data.value)) {
      setSelectedValue(selectedValue.filter((i) => i.value !== data.value));
    } else {
      setSelectedValue([...selectedValue, data]);
    }
  };

  // 移除选中项
  const handleRemove = (item: DeptMemberPickerValue) => {
    setSelectedValue(selectedValue.filter((i) => i.value !== item.value));
  };

  // 清空 - 与 Vue 的 handleClear 一致
  const handleClear = () => {
    setModelValue({ value: [] });
  };

  // 确认
  const handleConfirm = () => {
    if (simpleValue) {
      const ids = selectedValue.map((item) => item.value);
      onChangeRef.current?.(ids as number[]);
      onConfirmRef.current?.({ value: ids as number[] });
      onValueChangeRef.current?.({ value: ids as number[] });
    } else {
      setModelValue({ value: selectedValue });
      onConfirmRef.current?.({ value: selectedValue });
    }
    close();
  };

  // 渲染树节点 - 与 Vue 的 template #default="{ data }" 一致
  const renderTreeData = (data: TreeNode[]): TreeProps["treeData"] => {
    return data.map((node) => ({
      key: node.value,
      ...node,
      children: node.children ? renderTreeData(node.children) : undefined,
    }));
  };

  // 渲染树节点标题 - 使用 titleRender 让节点占满整行
  const renderTreeTitle = (nodeData: any) => {
    const node = nodeData as TreeNode;
    return (
      <div
        className="w-full flex items-center gap-2 group"
        onClick={() => handleNodeClick(node)}
      >
        <SvgIcon
          name={node.user_id ? "member" : "department"}
          width="16px"
          height="16px"
          color={
            selectedValue.some((i) => i.value === node.value)
              ? "#3664EF"
              : "#999"
          }
        />
        <div
          className={`flex-1 w-0 text-sm truncate ${
            selectedValue.some((i) => i.value === node.value)
              ? "text-brand"
              : "text-primary"
          }`}
          title={node.label}
        >
          {node.label}
        </div>
        {selectedValue.some((i) => i.value === node.value) && (
          <CheckOutlined style={{ color: "#3664EF" }} />
        )}
      </div>
    );
  };

  // 渲染分组树节点数据
  const renderGroupTreeData = (data: TreeNode[]): TreeProps["treeData"] => {
    return data.map((node) => ({
      key: node.value,
      ...node,
    }));
  };

  // 渲染分组树节点标题
  const renderGroupTreeTitle = (nodeData: any) => {
    const node = nodeData as TreeNode;
    return (
      <div
        className="w-full flex items-center gap-2 group"
        onClick={() => handleNodeClickGroup(node)}
      >
        <SvgIcon
          name="user-group"
          width="16px"
          height="16px"
          color={
            selectedValue.some((i) => i.value === node.value)
              ? "#3664EF"
              : "#999"
          }
        />
        <div
          className={`flex-1 w-0 text-sm truncate ${
            selectedValue.some((i) => i.value === node.value)
              ? "text-brand"
              : "text-primary"
          }`}
          title={node.label}
        >
          {node.label}
        </div>
        {selectedValue.some((i) => i.value === node.value) && (
          <CheckOutlined style={{ color: "#3664EF" }} />
        )}
      </div>
    );
  };

  return (
    <Skeleton className="w-full" active loading={isGroupMode && loading}>
      <div className="relative">
        {/* 隐藏的测量容器，用于检测换行 */}
        {displayItems.length > 3 && !triggerElement && (
          <ul
            ref={ulRef}
            className="w-full flex items-center flex-wrap gap-2 absolute left-0 top-0 opacity-0 pointer-events-none"
            style={{ visibility: 'hidden' }}
          >
            {displayItems.map((item, index) => (
              <li
                data-item="true"
                key={item.value ?? item.did ?? index}
                className="h-8 flex items-center gap-2 px-2 border border-[#E5E5E5] rounded text-tertiary"
              >
                {item.label || item.group_name || item.name}
              </li>
            ))}
            {/* 模拟 +n */}
            <li className="h-8 flex items-center px-2 text-tertiary">+n</li>
            {/* 模拟 button */}
            <li className="h-8 px-4 flex items-center">修改</li>
          </ul>
        )}

        {triggerElement ? (
          <div onClick={open}>{triggerElement}</div>
        ) : isGroupMode ? (
          <ul className="w-full flex items-center flex-wrap gap-2">
            {displayItems.slice(0, visibleCount ?? 3).map((item, index) => (
              <li
                key={item.value ?? index}
                className="h-8 flex items-center gap-2 px-2 box-border border border-[#E5E5E5] rounded text-tertiary"
              >
                <SvgIcon
                  name="user-group"
                  width="18px"
                  height="18px"
                  color="#C7C7C7"
                />
                {item.label || item.group_name || item.name}
              </li>
            ))}
            {displayItems.length > (visibleCount ?? 3) && (
              <Tooltip title={displayItems.slice(visibleCount ?? 3).map(i => i.label || i.group_name || i.name || '').join('、')}>
                <li className="h-8 flex items-center px-2 border border-[#E5E5E5] rounded text-tertiary">
                  +{displayItems.length - (visibleCount ?? 3)}
                </li>
              </Tooltip>
            )}
            <Button type="link" onClick={open}>
              {t(!displayItems.length ? "action_add" : "action_modify")}
            </Button>
          </ul>
        ) : (
          <ul className="w-full flex items-center flex-wrap gap-2">
            {displayItems.slice(0, visibleCount ?? 3).map((item, index) => (
              <li
                key={item.value ?? item.did ?? index}
                className="h-8 flex items-center gap-2 px-2 border border-[#E5E5E5] rounded text-tertiary"
              >
                <SvgIcon
                  name="department"
                  width="16px"
                  height="16px"
                  color="#57A1FF"
                />
                {item.name}
              </li>
            ))}
            {displayItems.length > (visibleCount ?? 3) && (
              <Tooltip title={displayItems.slice(visibleCount ?? 3).map(i => i.name || '').join('、')}>
                <li className="h-8 flex items-center px-2 border border-[#E5E5E5] rounded text-tertiary">
                  +{displayItems.length - (visibleCount ?? 3)}
                </li>
              </Tooltip>
            )}
            <Button color="primary" variant="link" onClick={open}>
              {t(!displayItems.length ? "action_add" : "action_modify")}
            </Button>
          </ul>
        )}

        <Modal
          open={visible}
          onCancel={close}
          title={t("action_select")}
          width={650}
          destroyOnHidden
          mask={{ closable: false }}
          getContainer={false}
          footer={
            <>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  close();
                }}
              >
                {t("action_cancel")}
              </Button>
              <Button type="primary" onClick={handleConfirm}>
                {t("action_confirm")}
              </Button>
            </>
          }
        >
          <div className="flex h-[400px]">
            {/* 左侧选择区域 */}
            <div className="flex-1 w-0 pr-4 box-border flex flex-col border-r border-[#E5E5E5]">
              <Search
                mode="expanded"
                value={keyword}
                onDebouncedChange={setKeyword}
                className="w-full"
                placeholder={
                  isGroupMode
                    ? t("internal_user.group.search_placeholder_v2")
                    : type === "user"
                      ? t("internal_user.organization.user_search_placeholder")
                      : t(
                          "internal_user.organization.department_search_placeholder",
                        )
                }
              />

              {isGroupMode ? (
                <Tree
                  ref={treeGroupRef}
                  className="mt-4 flex-1 h-0 box-border pr-1 overflow-auto"
                  treeData={renderGroupTreeData(filteredGroupData)}
                  defaultExpandedKeys={[0]}
                  selectable={false}
                  titleRender={renderGroupTreeTitle}
                  blockNode
                />
              ) : (
                <>
                  {showGroup && (
                    <Radio.Group
                      value={selectionMode}
                      onChange={(e) => setSelectionMode(e.target.value)}
                      className="mt-4"
                    >
                      <Radio.Button value="member">
                        {t("common.member")}
                      </Radio.Button>
                      <Radio.Button value="group">{t("group")}</Radio.Button>
                    </Radio.Group>
                  )}

                  {selectionMode === "member" && (
                    <Tree
                      ref={treeRef}
                      className="mt-4 flex-1 h-0 box-border pr-1 overflow-auto"
                      treeData={renderTreeData(filteredTreeData)}
                      defaultExpandedKeys={[0]}
                      selectable={false}
                      titleRender={renderTreeTitle}
                      blockNode
                    />
                  )}
                  {selectionMode === "group" && (
                    <Tree
                      ref={treeGroupRef}
                      className="mt-4 flex-1 h-0 box-border pr-1 overflow-auto"
                      treeData={renderGroupTreeData(filteredGroupData)}
                      defaultExpandedKeys={[0]}
                      selectable={false}
                      titleRender={renderGroupTreeTitle}
                      blockNode
                    />
                  )}
                </>
              )}
            </div>

            {/* 右侧已选区域 */}
            <div className="flex-1 w-0 pl-4 box-border flex flex-col">
              <div className="h-10 flex items-center justify-between">
                <h4>{t("internal_user.scope.selected_title")}</h4>
              </div>
              <div className="flex-1 h-0 w-full mt-3 bg-[#FBF8FB] rounded overflow-auto">
                <ul className="box-border p-4 flex items-start flex-wrap gap-2">
                  {selectedValue.map((item, index) => (
                    <li
                      key={item.value ?? item.did ?? index}
                      className="py-1 bg-white px-2 box-border border border-[#E5E5E5] rounded-sm flex items-center gap-1"
                    >
                      {item.type === "member" && (
                        <SvgIcon
                          name={item.user_id ? "member" : "department"}
                          width="12px"
                          height="12px"
                          color="#939499"
                        />
                      )}
                      {(item.type === "group" ||
                        (isGroupMode && !item.type)) && (
                        <SvgIcon
                          name="user-group"
                          width="12px"
                          height="12px"
                          color="#939499"
                        />
                      )}
                      {item.type === "department" && !item.user_id && (
                        <SvgIcon
                          name="department"
                          width="12px"
                          height="12px"
                          color="#939499"
                        />
                      )}
                      <span className="text-sm">{item.label}</span>
                      <CloseOutlined
                        className="cursor-pointer text-[#C4C4C4] hover:text-placeholder text-xs ml-1"
                        onClick={() => handleRemove(item)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </Skeleton>
  );
}

export const DeptMemberPicker = forwardRef<
  DeptMemberPickerRef,
  DeptMemberPickerProps
>(DeptMemberPickerInner);

export default DeptMemberPicker;
