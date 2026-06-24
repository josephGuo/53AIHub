import { useState, useEffect } from "react";
import { Input } from "antd";
import { Search as SearchInput, Tabs } from "@km/shared-components-react";
import { SearchOutlined } from "@ant-design/icons";
import { useLinksStore } from "@/stores/modules/links";
import { t } from "@/locales";
import { useIsSoftStyle } from "@/stores/modules/enterprise";
import { scrollToElement } from "@km/shared-utils";
import { useSearchParams } from "react-router-dom";
import { showLoginModal, isLoggedIn } from "@/utils/permission";
import ListView from "./List";

interface ExploreToolkitProps {
  stickyOffset?: number;
}

export function GroupList({ stickyOffset = 0 }: ExploreToolkitProps) {
  const linksStore = useLinksStore();
  const isSoftStyle = useIsSoftStyle();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groupId, setGroupId] = useState(0);
  const [keyword, setKeyword] = useState("");

  // 有缓存则静默刷新，无缓存则显示骨架屏
  const [loading, setLoading] = useState(!linksStore.links.length);

  useEffect(() => {
    if (linksStore.links.length === 0) {
      setLoading(true);
    }
    Promise.all([
      linksStore.loadCategorys(),
      linksStore.loadLinks(),
    ]).finally(() => setLoading(false));
  }, []);

  // 响应 URL 参数变化选中分组
  useEffect(() => {
    const groupIdParam = searchParams.get("group_id");
    if (groupIdParam) {
      const id = Number(groupIdParam);
      if (!isNaN(id) && id >= 0) {
        const categorys = linksStore.categorys || [];
        const exists =
          id === 0 || categorys.some((cat) => cat.group_id === id);
        if (exists) {
          setGroupId(id);
        }
      }
    }
  }, [searchParams, linksStore.categorys]);

  const categorys = linksStore.categorys || [];

  const links = (linksStore.links || []).filter((item) => {
    if (groupId === 0) return true;
    return item.group_id === groupId;
  });

  const tabItems = categorys.map((item) => ({
    key: String(item.group_id),
    label: item.group_name,
  }));

  const handleTabChange = (key: string) => {
    if (!isLoggedIn()) {
      showLoginModal()
    }
    setGroupId(Number(key));
    const newParams = new URLSearchParams(searchParams);
    if (key === "0") {
      newParams.delete("group_id");
    } else {
      newParams.set("group_id", key);
    }
    setSearchParams(newParams, { replace: true });
    scrollToElement(`#group_${key}`, (stickyOffset || 0) + 150);
  };

  const handleSearchFocus = () => {
    if (!isLoggedIn()) {
      showLoginModal()
    }
  };

  return (
    <>
      <div
        className="sticky z-[100] bg-white"
        style={{ top: isSoftStyle ? "120px" : "30px" }}
      >
        <div className="flex md:flex-row flex-col-reverse gap-5 items-stretch md:items-center justify-between bg-white py-1">
          <Tabs
            activeKey={String(groupId)}
            onChange={handleTabChange}
            items={tabItems}
            className="flex-1 overflow-hidden toolkit-tabs"
          />
          <div className="w-full md:w-auto">
            <SearchInput
              className="hidden md:flex"
              value={keyword}
              onDebouncedChange={setKeyword}
              onFocus={handleSearchFocus}
              placeholder={t("action.search") + t("module.toolbox")}
            />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onFocus={handleSearchFocus}
              placeholder={t("toolbox.search_placeholder")}
              prefix={<SearchOutlined className="text-gray-400" />}
              className="w-full md:hidden"
              allowClear
              size="large"
            />
          </div>
        </div>
      </div>
      <ListView
        className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 ${isSoftStyle ? "mt-3 mb-16" : "my-3"}`}
        keyword={keyword}
        list={links}
        groupId={groupId}
        loading={loading}
      />
    </>
  );
}

export default GroupList;
