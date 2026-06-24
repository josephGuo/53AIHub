import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { SearchOutlined } from "@ant-design/icons";
import { Input } from "antd";
import { Search as SearchInput, Tabs } from "@km/shared-components-react";
import { useSkillsStore } from "@/stores/modules/skills";
import { useIsSoftStyle } from "@/stores/modules/enterprise";
import { isLoggedIn, showLoginModal } from "@/utils/permission";
import SkillList from "./SkillList";
import { t } from "@/locales";

interface GroupListProps {
  onAdd?: (id: string) => void;
}

export function GroupList({ onAdd }: GroupListProps) {
  const skillsStore = useSkillsStore();
  const isSoftStyle = useIsSoftStyle();
  const [searchParams, setSearchParams] = useSearchParams();
  const [keyword, setKeyword] = useState("");
  const [groupId, setGroupId] = useState(0);

  // 有缓存则静默刷新，无缓存则显示骨架屏
  const [loading, setLoading] = useState(!skillsStore.skillList.length);

  useEffect(() => {
    if (skillsStore.skillList.length === 0) {
      setLoading(true);
    }
    skillsStore.loadSkillList().finally(() => setLoading(false));
  }, []);

  // 响应 URL 参数变化选中分组
  useEffect(() => {
    const groupIdParam = searchParams.get('group_id');
    if (groupIdParam) {
      const id = Number(groupIdParam);
      if (!isNaN(id) && id >= 0) {
        const exists = id === 0 || skillsStore.categorys.some(cat => cat.group_id === id);
        if (exists) {
          setGroupId(id);
        }
      }
    }
  }, [searchParams, skillsStore.categorys]);

  const showSkillList = useMemo(() => {
    return skillsStore.skillList;
  }, [skillsStore.skillList]);

  const tabItems = useMemo(() => {
    return skillsStore.categorys.map((cat) => ({
      key: String(cat.group_id),
      label: cat.group_name,
    }));
  }, [skillsStore.categorys]);

  const handleTabChange = useCallback(
    async (key: string) => {
      if (!isLoggedIn()) {
        showLoginModal()
      }
      try {
        const group_id = Number(key);
        setGroupId(group_id);
        const newParams = new URLSearchParams(searchParams);
        if (key === '0') {
          newParams.delete('group_id');
        } else {
          newParams.set('group_id', key);
        }
        setSearchParams(newParams, { replace: true });
        if (!isLoggedIn()) return;
        setLoading(true);
        await skillsStore.loadSkillList({
          group_id: group_id || undefined,
          isRefresh: true,
        });
      } finally {
        setLoading(false);
      }
    },
    [skillsStore, searchParams, setSearchParams],
  );

  const handleSearchFocus = () => {
    if (!isLoggedIn()) {
      showLoginModal()
    }
  };

  return (
    <div>
      <div
        className="sticky z-[100] bg-white"
        style={{ top: isSoftStyle ? "120px" : "30px" }}
      >
        <div className="flex md:flex-row flex-col-reverse gap-5 items-stretch md:items-center justify-between bg-white py-1">
          <Tabs
            items={tabItems}
            activeKey={String(groupId)}
            onChange={handleTabChange}
            className="flex-1 index-tabs overflow-hidden"
          />
          <div className="w-full md:w-auto">
            <SearchInput
              value={keyword}
              onDebouncedChange={setKeyword}
              onFocus={handleSearchFocus}
              className="hidden md:flex"
              placeholder={t("action.search") + t("module.skill")}
            />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onFocus={handleSearchFocus}
              size="large"
              className="w-full md:hidden el-input--main"
              placeholder={t("action.search") + t("module.skill")}
              prefix={<SearchOutlined />}
            />
          </div>
        </div>
      </div>

      <SkillList
        loading={loading}
        keyword={keyword}
        list={showSkillList}
        type="explore"
        groupId={groupId}
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 ${isSoftStyle ? "mt-2 mb-16" : "my-3"}`}
        onAdd={onAdd}
      />
    </div>
  );
}

export default GroupList;
