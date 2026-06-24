import { Suspense, lazy } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Spin } from "antd";
import { LayoutShell } from "@/layout/Layout";
import { RequireAuth } from "./guards";

// 懒加载页面组件 - 减少首屏 JS 体积
const LoginPage = lazy(() =>
  import("@/views/login/index").then((m) => ({ default: m.LoginPage })),
);
const RegisterForm = lazy(() =>
  import("@/views/login/components/RegisterForm").then((m) => ({
    default: m.RegisterForm,
  })),
);
const ApplyForm = lazy(() =>
  import("@/views/login/components/ApplyForm").then((m) => ({
    default: m.ApplyForm,
  })),
);
const HomePage = lazy(() =>
  import("@/views/index/index").then((m) => ({ default: m.HomePage })),
);
const InfoPage = lazy(() =>
  import("@/views/info/index").then((m) => ({ default: m.InfoPage })),
);
const ConfigPage = lazy(() =>
  import("@/views/config/index").then((m) => ({ default: m.ConfigPage })),
);
const SystemLogRefactoredPage = lazy(() =>
  import("@/views/system-log-refactored/index").then((m) => ({
    default: m.SystemLogRefactoredPage,
  })),
);
const ToolboxRefactoredPage = lazy(() =>
  import("@/views/toolbox-refactored/index").then((m) => ({
    default: m.ToolboxRefactoredPage,
  })),
);
const ToolkitCreatePage = lazy(() =>
  import("@/views/toolbox-refactored/create/index").then((m) => ({
    default: m.ToolboxCreatePage,
  })),
);
const SMTPPage = lazy(() =>
  import("@/views/smtp/index").then((m) => ({ default: m.SMTPPage })),
);
const DomainPage = lazy(() =>
  import("@/views/domain/index").then((m) => ({ default: m.DomainPage })),
);
const NavigationPage = lazy(() =>
  import("@/views/navigation/index").then((m) => ({
    default: m.NavigationPage,
  })),
);
const WebSettingPage = lazy(() =>
  import("@/views/navigation/WebSetting").then((m) => ({
    default: m.WebSettingPage,
  })),
);
const OrderPage = lazy(() =>
  import("@/views/order/index").then((m) => ({ default: m.OrderPage })),
);
const PaymentPage = lazy(() =>
  import("@/views/payment/index").then((m) => ({ default: m.PaymentPage })),
);
const StatisticsPage = lazy(() =>
  import("@/views/statistics/index").then((m) => ({
    default: m.StatisticsPage,
  })),
);
const SubscriptionPage = lazy(() =>
  import("@/views/subscription/index").then((m) => ({
    default: m.SubscriptionPage,
  })),
);
const KnowledgePage = lazy(() =>
  import("@/views/knowledge/index").then((m) => ({ default: m.KnowledgePage })),
);
const PromptPage = lazy(() =>
  import("@/views/prompt/index").then((m) => ({ default: m.PromptPage })),
);
const PromptCreatePage = lazy(() =>
  import("@/views/prompt/create/index").then((m) => ({
    default: m.PromptCreatePage,
  })),
);
const SearchPage = lazy(() =>
  import("@/views/search/index").then((m) => ({ default: m.SearchPage })),
);
const PlatformPage = lazy(() =>
  import("@/views/platform/index").then((m) => ({ default: m.PlatformPage })),
);
const UserAdminPage = lazy(() =>
  import("@/views/user/admin/index").then((m) => ({
    default: m.UserAdminPage,
  })),
);
const UserInternalPage = lazy(() =>
  import("@/views/user/internal/index").then((m) => ({
    default: m.UserInternalPage,
  })),
);
const UserRegisterPage = lazy(() =>
  import("@/views/user/register/register").then((m) => ({
    default: m.UserRegisterPage,
  })),
);
const AgentPage = lazy(() =>
  import("@/views/agent/index").then((m) => ({ default: m.AgentPage })),
);
const AgentCreatePage = lazy(() =>
  import("@/views/agent/create/index").then((m) => ({
    default: m.AgentCreatePage,
  })),
);
const AgentCreateV2Page = lazy(() =>
  import("@/views/agent/create-v2/index").then((m) => ({
    default: m.AgentCreatePageV2,
  })),
);
const AssistantPage = lazy(() =>
  import("@/views/assistant/index").then((m) => ({ default: m.AssistantPage })),
);
const AssistantMapPage = lazy(() =>
  import("@/views/assistant/map/index").then((m) => ({
    default: m.AssistantMapPage,
  })),
);
const AppSettingPage = lazy(() =>
  import("@/views/assistant/AppSetting").then((m) => ({
    default: m.AppSettingPage,
  })),
);
const ChatPage = lazy(() =>
  import("@/views/assistant/chat/index").then((m) => ({ default: m.ChatPage })),
);
const RecordingPage = lazy(() =>
  import("@/views/recording/index").then((m) => ({ default: m.RecordingPage })),
);
const SkillsPage = lazy(() => import("@/views/skills/index"));
const SkillDetailPage = lazy(() => import("@/views/skills/Detail"));
const TemplateStylePage = lazy(() =>
  import("@/views/template-style/index").then((m) => ({
    default: m.TemplateStylePage,
  })),
);
const WorkAIPage = lazy(() => import("@/views/work-ai/index"));
const SvgPage = lazy(() =>
  import("@/views/svg/index").then((m) => ({ default: m.SvgPage })),
);
const NotFound = lazy(() =>
  import("@/views/exception/404").then((m) => ({ default: m.NotFound })),
);
const ServerError = lazy(() =>
  import("@/views/exception/500").then((m) => ({ default: m.ServerError })),
);
const MobileTip = lazy(() =>
  import("@/views/exception/MobileTip").then((m) => ({ default: m.MobileTip })),
);

// 页面加载中的 Loading 组件
const PageLoading = () => (
  <div className="w-full h-full flex items-center justify-center">
    <Spin size="large" />
  </div>
);

export function AppRouter() {
  return (
    <HashRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Login routes */}
          <Route
            path="/login"
            element={
              <RequireAuth>
                <LoginPage />
              </RequireAuth>
            }
          />
          <Route
            path="/register"
            element={
              <RequireAuth>
                <RegisterForm />
              </RequireAuth>
            }
          />
          <Route
            path="/apply"
            element={
              <RequireAuth>
                <ApplyForm />
              </RequireAuth>
            }
          />

          {/* Main layout routes */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <LayoutShell />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/index" replace />} />

            {/* Home */}
            <Route path="index" element={<HomePage />} />

            {/* Config */}
            <Route path="config" element={<ConfigPage />} />
            <Route path="info" element={<InfoPage />} />
            <Route path="domain" element={<DomainPage />} />
            <Route path="template-style" element={<TemplateStylePage />} />
            <Route path="statistics" element={<StatisticsPage />} />

            {/* System */}
            <Route path="system-log" element={<SystemLogRefactoredPage />} />
            <Route path="smtp" element={<SMTPPage />} />

            {/* Navigation */}
            <Route path="navigation" element={<NavigationPage />} />
            <Route
              path="navigation/web-setting/:navigation_id"
              element={<WebSettingPage />}
            />

            {/* Order & Payment */}
            <Route path="order" element={<OrderPage />} />
            <Route path="payment" element={<PaymentPage />} />
            <Route path="subscription" element={<SubscriptionPage />} />

            {/* Knowledge */}
            <Route path="knowledge" element={<KnowledgePage />} />

            {/* Prompt */}
            <Route path="prompt" element={<PromptPage />} />
            <Route path="prompt/create" element={<PromptCreatePage />} />

            {/* Search */}
            <Route path="search" element={<SearchPage />} />
            {/* <Route path="search/feedback" element={<SearchFeedbackPage />} />
            <Route path="search/record" element={<SearchRecordPage />} /> */}

            {/* Platform */}
            <Route path="platform" element={<PlatformPage />} />

            {/* User */}
            <Route path="user">
              <Route index element={<Navigate to="/user/admin" replace />} />
              <Route path="admin" element={<UserAdminPage />} />
              <Route path="internal" element={<UserInternalPage />} />
              <Route path="register" element={<UserRegisterPage />} />
            </Route>

            {/* Agent */}
            <Route path="agent" element={<AgentPage />} />
            <Route path="agent/create" element={<AgentCreatePage />} />
            <Route path="agent/create-v2" element={<AgentCreateV2Page />} />

            {/* Work AI */}
            <Route path="work-ai" element={<WorkAIPage />} />

            {/* Skills */}
            <Route path="skills" element={<SkillsPage />} />
            <Route path="skill-detail" element={<SkillDetailPage />} />

            {/* Toolbox */}
            <Route path="toolbox" element={<ToolboxRefactoredPage />} />
            <Route path="toolbox/create" element={<ToolkitCreatePage />} />

            {/* Assistant */}
            <Route path="assistant" element={<AssistantPage />} />
            <Route path="assistant/chat" element={<ChatPage />} />
            <Route path="assistant/map" element={<AssistantMapPage />} />
            <Route path="assistant/app-setting" element={<AppSettingPage />} />

            {/* Recording */}
            <Route path="recording" element={<RecordingPage />} />
          </Route>

          {/* SvgPage */}
          <Route path="/svglist" element={<SvgPage />} />

          {/* Exception pages */}
          <Route path="/404" element={<NotFound />} />
          <Route path="/500" element={<ServerError />} />
          <Route path="/mobile-tip" element={<MobileTip />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

export default AppRouter;
