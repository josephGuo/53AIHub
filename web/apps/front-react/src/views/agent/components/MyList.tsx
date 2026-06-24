import { useState, useEffect } from "react";
import { Input, Select } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { Search } from "@km/shared-components-react";
import { useAgentStore } from "@/stores/modules/agent";
import { useIsSoftStyle } from "@/stores/modules/enterprise";
import AgentList from "./AgentList";
import { t } from "@/locales";

interface MyListProps {
  className?: string;
  selectMode?: boolean;
  flatMode?: boolean;
}

// 常量定义，移到组件外部
const SORT_OPTIONS = [
  { label: t("agent.sort_by_created_time"), value: "created_time" as const },
  { label: t("agent.sort_by_updated_time"), value: "updated_time" as const },
];

export function MyList({ className, selectMode = false, flatMode = false }: MyListProps) {
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState<"created_time" | "updated_time">("created_time");

  const agentStore = useAgentStore();
  const isSoftStyle = useIsSoftStyle();

  useEffect(() => {
    agentStore.loadMyAgentList(true);
  }, []);

  const listClassName = flatMode
    ? `flex flex-col gap-2 ${isSoftStyle ? "mt-2 mb-16" : "my-3"}`
    : `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 ${isSoftStyle ? "mt-2 mb-16" : "my-3"}`;

  return (
    <div>
      {/* 非选择模式时显示筛选器和搜索框 */}
      {!selectMode && (
        <div className="bg-white">
          <div className="flex md:flex-row flex-col-reverse gap-5 items-stretch md:items-center justify-between bg-white py-1 mb-4">
            <div className="flex items-center gap-2 w-[200px]">
              <Select
                prefix={t("module.time") + "："}
                value={sort}
                onChange={setSort}
                className="flex-none"
              >
                {SORT_OPTIONS.map((opt) => (
                  <Select.Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Select.Option>
                ))}
              </Select>
            </div>
            <div className="w-full md:w-auto">
              <Search
                value={keyword}
                onDebouncedChange={setKeyword}
                className="hidden md:flex"
                placeholder={t("action.search") + t("module.agent")}
              />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                size="large"
                className="w-full md:hidden el-input--main"
                placeholder={t("action.search") + t("module.agent")}
                prefix={<SearchOutlined />}
              />
            </div>
          </div>
        </div>
      )}

      <AgentList
        type="my"
        keyword={keyword}
        sort={sort}
        selectMode={selectMode}
        flatMode={flatMode}
        className={listClassName}
        onRefresh={() => agentStore.loadMyAgentList(true)}
      />
    </div>
  );
}

export default MyList;
