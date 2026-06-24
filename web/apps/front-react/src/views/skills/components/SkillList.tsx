import { useMemo, useState } from "react";
import { Empty } from "antd";
import type { Skill } from "@/api/modules/skill/types";
import SkillCard from "./Card";
import SkillEnvVarsDrawer from "./SkillEnvVarsDrawer";
import { t } from "@/locales";

interface SkillListProps {
  list: Skill[];
  loading?: boolean;
  keyword?: string;
  type: "my" | "explore";
  sort?: "created_time" | "updated_time";
  className?: string;
  groupId?: number;
  onAdd?: (id: string) => void;
}

const SkillList: React.FC<SkillListProps> = ({
  list,
  loading = false,
  keyword = "",
  type,
  sort = "created_time",
  className,
  groupId,
  onAdd,
}) => {
  const [envDrawerState, setEnvDrawerState] = useState<{
    open: boolean;
    skillId: string;
    skillDisplayName: string;
  }>({ open: false, skillId: "", skillDisplayName: "" });

  const handleOpenEnvDrawer = (skillId: string, skillDisplayName: string) => {
    setEnvDrawerState({ open: true, skillId, skillDisplayName });
  };

  const handleCloseEnvDrawer = () => {
    setEnvDrawerState((prev) => ({ ...prev, open: false }));
  };

  const showList = useMemo(() => {
    let result = [...list];

    // 按排序字段降序排列
    if (sort) {
      result.sort((a, b) => (b[sort] ?? 0) - (a[sort] ?? 0));
    }

    if (groupId) {
      result = result.filter(item => {
        return item.group_ids.includes(groupId)
      })
    }

    // 关键词筛选
    const kw = keyword.trim().toLowerCase();
    if (kw) {
      result = result.filter((item) => {
        return (
          item.display_name.toLowerCase().includes(kw) ||
          item.skill_name.toLowerCase().includes(kw) ||
          item.description.toLowerCase().includes(kw)
        );
      });
    }

    return result;
  }, [list, keyword, sort, groupId]);

  if (loading) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 ${className || ""}`}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-white border border-[#ECECEC] rounded-xl p-5 animate-pulse"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-gray-200 rounded-lg shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="h-5 bg-gray-200 rounded w-1/2" />
                  <div className="h-5 bg-gray-200 rounded w-16" />
                </div>
                <div className="h-3 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
            <div className="flex-1 mb-5">
              <div className="h-4 bg-gray-200 rounded w-full mb-2" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </div>
            <div className="flex items-center gap-2 border-t border-gray-50 pt-4">
              <div className="h-8 bg-gray-200 rounded flex-1" />
              <div className="h-8 bg-gray-200 rounded w-8" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (showList.length === 0) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center min-h-[600px]">
        <Empty
          description={t("common.no_data")}
          image={window.$getPublicPath("/images/chat/completion_empty.png")}
        />
      </div>
    );
  }

  return (
    <>
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 ${className || ""}`}
      >
        {showList.map((skill) => (
          <SkillCard
            key={skill.id}
            skill={skill}
            type={type}
            groupId={groupId}
            onAdd={onAdd}
            onOpenEnvSettings={() => handleOpenEnvDrawer(skill.id, skill.display_name)}
          />
        ))}
      </div>

      <SkillEnvVarsDrawer
        open={envDrawerState.open}
        skillId={envDrawerState.skillId}
        skillDisplayName={envDrawerState.skillDisplayName}
        onClose={handleCloseEnvDrawer}
      />
    </>
  );
}

export default SkillList;
