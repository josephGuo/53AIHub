import { useEffect, lazy, Suspense } from "react";
import { Spin, message } from "antd";
import { useUserStore } from "@/stores/modules/user";
import { useEnterpriseStore } from "@/stores/modules/enterprise";
import { useIsSoftStyle } from "@/stores/modules/enterprise";
import { t } from "@/locales";
import "./profile.css";

// 懒加载大型组件 UserInfo
const UserInfo = lazy(() => import("./userinfo"));

export function ProfileView() {
  const enterpriseStore = useEnterpriseStore();
  const userStore = useUserStore();
  const isSoftStyle = useIsSoftStyle();

  const handleLogout = () => {
    userStore.logout();
    message.success(t("status.logout_success"));
  };

  useEffect(() => {
    enterpriseStore.loadInfo();
  }, []);

  return (
    <div className="h-full bg-white">
      {/* 内容区域 */}
      <div
        className={`flex-1 w-full lg:w-4/5 lg:w-3/5 max-w-[600px] mx-auto box-border flex flex-col ${isSoftStyle ? "" : "pt-4"}`}
      >
        <div
          className={`flex-1 py-4 px-3 md:p-6 bg-[#FFFFFF] box-border overflow-y-auto ${isSoftStyle ? "" : "pt-16"}`}
        >
          <Suspense
            fallback={
              <div className="flex justify-center py-8">
                <Spin />
              </div>
            }
          >
            <UserInfo />
          </Suspense>
          <div
            className="h-11 mt-8 flex items-center justify-center bg-[#F8F8F9] gap-2 px-6 mb-2 rounded text-[#F84E55] cursor-pointer"
            onClick={handleLogout}
          >
            <span className="text-sm">{t("action.logout")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileView;
