import { useState, useEffect, useMemo } from "react";
import { Input } from "antd";
import { Dropdown } from "@km/shared-components-react";
import { SearchOutlined, DownOutlined } from "@ant-design/icons";
import { Search as SearchInput, Tabs } from "@km/shared-components-react";
import { SvgIcon } from "@km/shared-components-react";
import { usePromptStore } from "@/stores/modules/prompt";
import { useIsSoftStyle } from "@/stores/modules/enterprise";
import { t } from "@/locales";
import PromptList from "./List";
import { useSearchParams } from "react-router-dom";
import { showLoginModal, isLoggedIn } from "@/utils/permission";
import "./GroupList.css";

const sortOptions = [
  { key: "default_sort", label: t("prompt.default_sort") },
  { key: "likes_sort", label: t("prompt.likes_sort") },
  { key: "views_sort", label: t("prompt.views_sort") },
];

export function GroupList() {
  const promptStore = usePromptStore();
  const isSoftStyle = useIsSoftStyle();
  const [searchParams, setSearchParams] = useSearchParams();

  // 有缓存则静默刷新，无缓存则显示骨架屏
  const [loading, setLoading] = useState(!promptStore.promptList.length);
  const [keyword, setKeyword] = useState("");
  const [groupId, setGroupId] = useState(0);
  const [sortType, setSortType] = useState("default_sort");

  useEffect(() => {
    if (promptStore.promptList.length === 0) {
      setLoading(true);
    }
    Promise.all([
      promptStore.loadCategorys(),
      promptStore.loadPromptList(),
    ]).finally(() => {
      setLoading(false);
    });
  }, []);

  // 新增：响应 URL 参数变化选中分组
  useEffect(() => {
    const groupIdParam = searchParams.get('group_id');
    if (groupIdParam) {
      const id = Number(groupIdParam);
      // 验证：必须是有效数字且 >= 0，且要么是 0（全部），要么存在于分组列表中
      if (!isNaN(id) && id >= 0) {
        const exists = id === 0 || promptStore.categorys.some((cat: any) => cat.group_id === id);
        if (exists) {
          setGroupId(id);
        }
      }
    }
  }, [searchParams, promptStore.categorys]);

  const showPromptList = useMemo(() => {
    let promptList = promptStore.promptList.map((item: any = {}) => {
      item.group_ids = item.group_ids || [];
      const group_options = promptStore.categorys.filter(
        (row: any = {}) =>
          +row.group_id && item.group_ids.includes(row.group_id),
      );
      item.group_names = group_options.map((row: any = {}) => row.group_name);
      return item;
    });

    if (sortType === "likes_sort") {
      promptList = [...promptList].sort(
        (a, b) => (b.likes || 0) - (a.likes || 0),
      );
    } else if (sortType === "views_sort") {
      promptList = [...promptList].sort(
        (a, b) => (b.views || 0) - (a.views || 0),
      );
    }

    const lowerKeyword = keyword.toLowerCase().trim();
    if (lowerKeyword) {
      promptList = promptList.filter((item: any) => {
        const matchKeyword = item.name?.toLowerCase().includes(lowerKeyword);
        return (
          (groupId === 0 || (+groupId && item.group_ids?.includes(groupId))) &&
          matchKeyword
        );
      });
    } else {
      promptList =
        groupId === 0
          ? promptList
          : promptList.filter(
              (item: any) => +groupId && item.group_ids?.includes(groupId),
            );
    }

    return promptList;
  }, [
    promptStore.promptList,
    promptStore.categorys,
    keyword,
    groupId,
    sortType,
  ]);

  const tabItems = useMemo(() => {
    return promptStore.categorys.map((item: any) => ({
      key: String(item.group_id),
      label: item.group_name,
    }));
  }, [promptStore.categorys]);

  const handleSortChange = (value: string) => {
    setSortType(value);
  };

  const handleTabChange = (key: string) => {
    if (!isLoggedIn()) {
      showLoginModal()
    }
    setGroupId(Number(key));
    const newParams = new URLSearchParams(searchParams);
    if (key === '0') {
      newParams.delete('group_id');
    } else {
      newParams.set('group_id', key);
    }
    setSearchParams(newParams, { replace: true });
  };

  const handleSearchFocus = () => {
    if (!isLoggedIn()) {
      showLoginModal()
    }
  };

  return (
    <>
      {/* Sticky filter bar */}
      <div
        className="sticky z-[100] bg-white"
        style={{ top: isSoftStyle ? "120px" : "30px" }}
      >
        <div className="flex md:flex-row flex-col-reverse gap-5 items-stretch md:items-center justify-between bg-white py-1">
          <div className="flex-1 md:w-0 flex items-center gap-2">
            <Tabs
              activeKey={String(groupId)}
              onChange={handleTabChange}
              items={tabItems}
              className="w-full prompt-tabs md:mb-0 overflow-hidden"
            />
            <Dropdown
              menu={{
                items: sortOptions,
                onClick: ({ key }) => handleSortChange(key),
              }}
            >
              <div className="flex-none md:hidden flex items-center gap-1 text-gray-600 cursor-pointer">
                <SvgIcon name="sort" stroke />
                <span className="text-sm">
                  {sortOptions.find((opt) => opt.key === sortType)?.label}
                </span>
                <DownOutlined style={{ fontSize: 14, color: "#aaa" }} />
              </div>
            </Dropdown>
          </div>
          <div className="w-full md:w-auto flex-none flex md:flex-row-reverse items-center gap-2">
            <SearchInput
              className="flex-none hidden md:flex"
              value={keyword}
              onDebouncedChange={setKeyword}
              onFocus={handleSearchFocus}
              placeholder={t("action.search") + t("module.prompt")}
            />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onFocus={handleSearchFocus}
              placeholder={t("action.search") + t("module.prompt")}
              prefix={<SearchOutlined className="text-gray-400" />}
              className="w-full md:hidden"
              allowClear
              size="large"
            />
            <Dropdown
              menu={{
                items: sortOptions,
                onClick: ({ key }) => handleSortChange(key),
              }}
            >
              <div className="hidden md:flex items-center space-x-1 cursor-pointer text-gray-600">
                <SvgIcon name="sort" stroke size={14} />
                <span className="text-sm">
                  {sortOptions.find((opt) => opt.key === sortType)?.label}
                </span>
                <DownOutlined style={{ fontSize: 14, color: "#aaa" }} />
              </div>
            </Dropdown>
          </div>
        </div>
      </div>

      {/* List */}
      <PromptList
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 ${isSoftStyle ? "mt-3 mb-16" : "my-3"}`}
        list={showPromptList}
        keyword={keyword}
        groupId={groupId}
        loading={loading}
      />
    </>
  );
}

export default GroupList;
