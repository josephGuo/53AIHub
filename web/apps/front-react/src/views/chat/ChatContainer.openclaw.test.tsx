import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, forwardRef, StrictMode, useImperativeHandle } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChatContainer from "./ChatContainer";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const mocks = vi.hoisted(() => {
  const frontStore = {
    current_conversationid: 0,
    conversations: [] as any[],
    addConversation: vi.fn((conversation: any) => {
      frontStore.conversations = [...frontStore.conversations, conversation];
    }),
    setCurrentState: vi.fn((_agentId: string | number, conversationId: string | number) => {
      frontStore.current_conversationid = conversationId;
    }),
    setNextAgentPrepare: vi.fn(),
    next_agent_prepare: {},
  };
  const sharedStore = {
    current_conversationid: 0,
    conversations: [] as any[],
    addConversation: vi.fn((conversation: any) => {
      sharedStore.conversations = [...sharedStore.conversations, conversation];
    }),
    setCurrentState: vi.fn((_agentId: string | number, conversationId: string | number) => {
      sharedStore.current_conversationid = conversationId;
    }),
  };
  return {
    navigate: vi.fn(),
    frontStore,
    sharedStore,
    currentConversation: vi.fn(),
    status: vi.fn(),
    conversations: vi.fn(),
    checkPermission: vi.fn(() => true),
    searchParams: new URLSearchParams("type=openclaw"),
    currentAgent: {
      agent_id: 2,
      name: "OpenClaw",
      channel_type: 1014,
      custom_config_obj: { agent_type: "openclaw" },
      settings_obj: {},
      use_cases: [],
      user_group_ids: [] as number[],
      owner_id: 0,
    },
    chatViewProps: [] as any[],
    openClawPanelProps: [] as any[],
    fileViewerProps: null as any,
    addAnswerAsMdOpen: vi.fn(),
    buildOpenClawConversation: vi.fn((session: any, agentId: string | number) => ({
      conversation_id: session.id,
      agent_id: agentId,
      title: session.title,
      created_time: 1779871345,
      updated_time: 1779871346,
      is_valid: 1,
    })),
  };
});

vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [mocks.searchParams],
}));

vi.mock("@km/shared-business/chat", () => ({
  ChatProvider: ({ children }: { children: any }) => createElement("div", null, children),
  ChatConfigProvider: ({ children }: { children: any }) => createElement("div", null, children),
  ChatView: forwardRef((props: any, _ref: any) => {
    mocks.chatViewProps.push(props);
    return createElement(
      "div",
      { "data-testid": "chat-view" },
      props.renderHeader ? props.renderHeader({ agentInfo: props.agentInfo, lang: "zh-cn", setLang: vi.fn() }) : null
    );
  }),
  UsageGuide: vi.fn(() => null),
  getOutputFileDownloadStrategy: vi.fn((file: any) => {
    if (file.signed_download_url) return { kind: "direct_url", url: file.signed_download_url };
    if (file.download_url) return { kind: "direct_url", url: file.download_url };
    if (typeof file.url === "string" && file.url.startsWith("data:")) return { kind: "data_url", url: file.url };
    if (typeof file.base64 === "string" && file.base64.trim()) {
      return {
        kind: "data_url",
        url: `data:${file.mime_type || "application/octet-stream"};base64,${file.base64.trim()}`,
      };
    }
    if (typeof file.url === "string" && /^https?:\/\//i.test(file.url)) return { kind: "direct_url", url: file.url };
    if (file.message_id) return { kind: "message_lookup" };
    if (typeof file.url === "string" && file.url.startsWith("/api/")) return { kind: "direct_url", url: file.url };
    return { kind: "none" };
  }),
  shouldUseOpenClawChatAdapter: vi.fn(() => true),
  useConversationStore: (selector?: any) => (selector ? selector(mocks.sharedStore) : mocks.sharedStore),
}));

vi.mock("@/stores/modules/agent", () => ({
  useAgentStore: () => ({ agentList: [] }),
  useCurrentAgent: () => mocks.currentAgent,
}));

vi.mock("@/stores/modules/conversation", () => ({
  useConversationStore: (selector?: any) => (selector ? selector(mocks.frontStore) : mocks.frontStore),
}));

vi.mock("@/stores/modules/user", () => ({
  useUserStore: (selector?: any) => {
    const state = { info: { access_token: "user-token-1" } };
    return selector ? selector(state) : state;
  },
}));

vi.mock("@/stores/modules/enterprise", () => ({
  useEnterpriseStore: () => ({ copyright: "false" }),
  useIsSoftStyle: () => false,
}));

vi.mock("@/stores/modules/shortcuts", () => ({
  useShortcutsStore: () => ({
    isShortcut: vi.fn(() => false),
    addShortcut: vi.fn(),
    removeShortcut: vi.fn(),
  }),
}));

vi.mock("@/adapters/chat", () => ({
  conversationApiAdapter: {},
  createOpenClawConversationApiAdapter: vi.fn(() => ({})),
  agentApiAdapter: {},
  buildOpenClawConversation: mocks.buildOpenClawConversation,
}));

vi.mock("@/api/modules/openclaw", () => ({
  default: {
    currentConversation: mocks.currentConversation,
    status: mocks.status,
    conversations: mocks.conversations,
  },
}));

vi.mock("@/api/modules/shares", () => ({
  sharesApi: { create: vi.fn() },
}));

vi.mock("@/api/modules/upload", () => ({
  default: { upload: vi.fn() },
}));

vi.mock("@/api/host", () => ({
  API_HOST: "",
}));

vi.mock("@/constants/platform/config", () => ({
  AGENT_TYPES: { OPENCLAW: "openclaw" },
}));

vi.mock("@/locales", () => ({
  t: (key: string) => key,
}));

vi.mock("@/utils/router", () => ({
  buildUrl: (path: string) => path,
}));

vi.mock("@/utils/permission", () => ({
  checkPermission: mocks.checkPermission,
}));

vi.mock("@/utils/config", () => ({
  getPublicPath: (path: string) => path,
}));

vi.mock("@/components/AuthTagGroup", () => ({
  default: vi.fn(() => null),
}));

vi.mock("@/components/Chat/AddAnswerAsMd", () => ({
  default: forwardRef((_props: any, ref: any) => {
    useImperativeHandle(ref, () => ({
      open: mocks.addAnswerAsMdOpen,
    }));
    return createElement("div", { "data-testid": "add-answer-as-md" });
  }),
}));

vi.mock("@/components/MoreDropdown", () => ({
  default: vi.fn(() => null),
}));

vi.mock("@/components/Layout/ExpandSidebarButton", () => ({
  ExpandSidebarButton: vi.fn(() => null),
}));

vi.mock("@/components/FileViewer", () => ({
  default: vi.fn((props: any) => {
    mocks.fileViewerProps = props;
    return createElement("div", { "data-testid": "file-viewer" }, props.content || props.url);
  }),
}));

vi.mock("@km/shared-components-react", () => ({
  SvgIcon: vi.fn(() => null),
}));

vi.mock("./chat/components/agent-tooltip", () => ({
  default: ({ children }: { children: any }) => createElement("div", null, children),
}));

vi.mock("./components/OpenClawPanel", () => ({
  default: vi.fn((props: any) => {
    mocks.openClawPanelProps.push(props);
    return props.open ? createElement("div", { "data-testid": "openclaw-panel" }, "Gateway 设置") : null;
  }),
}));

describe("ChatContainer OpenClaw bootstrap", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mocks.navigate.mockReset();
    mocks.currentConversation.mockReset();
    mocks.status.mockReset();
    mocks.conversations.mockReset().mockResolvedValue({ data: { sessions: [], pagination: { hasMore: false } } });
    mocks.checkPermission.mockClear();
    mocks.searchParams = new URLSearchParams("type=openclaw");
    mocks.currentAgent = {
      agent_id: 2,
      name: "OpenClaw",
      channel_type: 1014,
      custom_config_obj: { agent_type: "openclaw" },
      settings_obj: {},
      use_cases: [],
      user_group_ids: [],
      owner_id: 0,
    };
    mocks.chatViewProps = [];
    mocks.openClawPanelProps = [];
    mocks.fileViewerProps = null;
    mocks.addAnswerAsMdOpen.mockClear();
    mocks.buildOpenClawConversation.mockClear();
    mocks.frontStore.current_conversationid = 0;
    mocks.frontStore.conversations = [];
    mocks.frontStore.addConversation.mockClear();
    mocks.frontStore.setCurrentState.mockClear();
    mocks.frontStore.setNextAgentPrepare.mockClear();
    mocks.sharedStore.current_conversationid = 0;
    mocks.sharedStore.conversations = [];
    mocks.sharedStore.addConversation.mockClear();
    mocks.sharedStore.setCurrentState.mockClear();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:openclaw-output-file"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    window.history.replaceState(null, "", "/chat?agent_id=2&type=openclaw");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads the current OpenClaw session into both conversation stores and syncs the URL", async () => {
    mocks.currentConversation.mockResolvedValue({
      data: {
        id: "agent:main:dashboard:current",
        title: "53AI Hub-openclaw-local@example.com：当前 OpenClaw 会话",
      },
    });
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });

    render(createElement(ChatContainer, { agentId: 2 }));

    await waitFor(() => {
      expect(mocks.currentConversation).toHaveBeenCalledWith(2, { ignoreMessage: true });
      expect(mocks.sharedStore.addConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          conversation_id: "agent:main:dashboard:current",
          title: "53AI Hub-openclaw-local@example.com：当前 OpenClaw 会话",
        })
      );
      expect(mocks.frontStore.addConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          conversation_id: "agent:main:dashboard:current",
        })
      );
    });

    expect(mocks.sharedStore.setCurrentState).toHaveBeenCalledWith(2, "agent:main:dashboard:current");
    expect(mocks.frontStore.setCurrentState).toHaveBeenCalledWith("2", "agent:main:dashboard:current", false);
    expect(window.location.search).toContain("conversation_id=agent%3Amain%3Adashboard%3Acurrent");
  });

  it("locks embedded OpenClaw preview to the current agent without usage scope tags", async () => {
    mocks.currentAgent.user_group_ids = [12, 34];
    mocks.currentConversation.mockResolvedValue({
      data: {
        id: "agent:main:dashboard:current",
        title: "53AI Hub-openclaw-local@example.com：当前 OpenClaw 会话",
      },
    });
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });

    render(createElement(ChatContainer, {
      agentId: 2,
      embeddedOpenClawPreview: true,
    }));

    await waitFor(() => {
      expect(mocks.chatViewProps.length).toBeGreaterThan(0);
    });

    const latestProps = mocks.chatViewProps.at(-1);
    expect(latestProps?.features?.agentTooltip).toBe(false);
    expect(latestProps?.features?.showRecommend).toBe(false);
    expect(latestProps?.features?.showRelatedScene).toBe(false);
    expect(latestProps?.renderAgentSelector).toBeUndefined();
    expect(latestProps?.renderAuthTags).toBeUndefined();
  });

  it("syncs the current OpenClaw session on the index agent route without front-store navigation", async () => {
    window.history.replaceState(null, "", "/index/agent?agent_id=2&type=openclaw");
    mocks.searchParams = new URLSearchParams("type=openclaw");
    const replaceState = vi.spyOn(window.history, "replaceState");
    mocks.currentConversation.mockResolvedValue({
      data: {
        id: "agent:main:dashboard:index-current",
        title: "53AI Hub-openclaw-local@example.com：首页会话",
      },
    });
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });

    render(createElement(ChatContainer, { agentId: 2, isIndexRoute: true }));

    await waitFor(() => {
      expect(mocks.frontStore.setCurrentState).toHaveBeenCalledWith(
        "2",
        "agent:main:dashboard:index-current",
        false
      );
    });

    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      expect.stringContaining("/index/agent?agent_id=2&type=openclaw&conversation_id=agent%3Amain%3Adashboard%3Aindex-current")
    );
    expect(window.location.pathname).toBe("/index/agent");
    expect(window.location.search).toContain("conversation_id=agent%3Amain%3Adashboard%3Aindex-current");
    replaceState.mockRestore();
  });

  it("respects an explicit URL OpenClaw conversation id instead of replacing it with the default session", async () => {
    window.history.replaceState(
      null,
      "",
      "/chat?agent_id=2&type=openclaw&conversation_id=agent%3Amain%3Adashboard%3Acontrol"
    );
    mocks.searchParams = new URLSearchParams("type=openclaw&conversation_id=agent%3Amain%3Adashboard%3Acontrol");
    mocks.currentConversation.mockResolvedValue({
      data: {
        id: "agent:main:dashboard:hub-latest",
        title: "53AI Hub-openclaw-local@example.com：最近会话",
      },
    });
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });

    render(createElement(ChatContainer, {
      agentId: 2,
      conversationId: "agent:main:dashboard:control",
    }));

    await waitFor(() => {
      expect(mocks.sharedStore.setCurrentState).toHaveBeenCalledWith(2, "agent:main:dashboard:control");
    });

    expect(mocks.currentConversation).not.toHaveBeenCalled();
    expect(mocks.chatViewProps.some((props) => props.initialConversationId === "agent:main:dashboard:control")).toBe(true);
    expect(window.location.search).toContain("conversation_id=agent%3Amain%3Adashboard%3Acontrol");
  });

  it("does not bind a current OpenClaw session that belongs to the control center", async () => {
    mocks.currentConversation.mockResolvedValue({
      data: {
        id: "agent:main:dashboard:control",
        title: "Claw Control Center",
      },
    });
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });

    render(createElement(ChatContainer, { agentId: 2 }));

    await waitFor(() => {
      expect(mocks.currentConversation).toHaveBeenCalledWith(2, { ignoreMessage: true });
    });

    await waitFor(() => {
      expect(mocks.sharedStore.setCurrentState).toHaveBeenCalledWith(2, 0);
      expect(mocks.frontStore.setCurrentState).toHaveBeenCalledWith("2", 0, false);
    });
    expect(mocks.sharedStore.addConversation).not.toHaveBeenCalled();
    expect(mocks.frontStore.addConversation).not.toHaveBeenCalled();
    expect(window.location.search).not.toContain("conversation_id=agent%3Amain%3Adashboard%3Acontrol");
  });

  it("keeps ChatView in initial resolving state without publishing a blank conversation while current session is pending", async () => {
    const currentConversation = deferred<any>();
    mocks.currentConversation.mockReturnValue(currentConversation.promise);
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });

    render(createElement(ChatContainer, { agentId: 2 }));

    await waitFor(() => {
      expect(mocks.currentConversation).toHaveBeenCalledWith(2, { ignoreMessage: true });
    });

    const latestProps = mocks.chatViewProps.at(-1);
    expect(latestProps?.features?.initialConversationResolving).toBe(true);
    expect(mocks.sharedStore.setCurrentState).not.toHaveBeenCalledWith(2, 0);
    expect(mocks.frontStore.setCurrentState).not.toHaveBeenCalledWith("2", 0, false);

    await act(async () => {
      currentConversation.resolve({
        data: {
          id: "agent:main:dashboard:resolved",
          title: "53AI Hub-openclaw-local@example.com：解析后的 OpenClaw 会话",
        },
      });
      await currentConversation.promise;
    });

    await waitFor(() => {
      expect(mocks.sharedStore.setCurrentState).toHaveBeenCalledWith(2, "agent:main:dashboard:resolved");
    });
  });

  it("does not block ChatView on default-session resolving when an explicit OpenClaw URL conversation is present", async () => {
    window.history.replaceState(
      null,
      "",
      "/chat?agent_id=2&type=openclaw&conversation_id=agent%3Amain%3Adashboard%3Astale"
    );
    mocks.searchParams = new URLSearchParams("type=openclaw&conversation_id=agent%3Amain%3Adashboard%3Astale");
    const currentConversation = deferred<any>();
    mocks.currentConversation.mockReturnValue(currentConversation.promise);
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });

    render(createElement(ChatContainer, {
      agentId: 2,
      conversationId: "agent:main:dashboard:stale",
    }));

    await waitFor(() => {
      expect(mocks.sharedStore.setCurrentState).toHaveBeenCalledWith(2, "agent:main:dashboard:stale");
    });

    const latestProps = mocks.chatViewProps.at(-1);
    expect(mocks.currentConversation).not.toHaveBeenCalled();
    expect(latestProps?.features?.initialConversationResolving).toBe(false);
    expect(latestProps?.initialConversationId).toBe("agent:main:dashboard:stale");
  });

  it("skips group permission checks for my agents from the personal route", async () => {
    mocks.searchParams = new URLSearchParams("type=openclaw&from=my");
    mocks.currentAgent.user_group_ids = [12, 34];
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });
    mocks.currentConversation.mockResolvedValue({ data: {} });

    render(createElement(ChatContainer, { agentId: 2 }));

    await waitFor(() => {
      expect(mocks.chatViewProps.length).toBeGreaterThan(0);
    });

    expect(mocks.chatViewProps.at(-1).checkPermission([12, 34])).toBe(true);
    expect(mocks.checkPermission).toHaveBeenCalledWith({ groupIds: [] });
  });

  it("skips group permission checks for owned personal agents", async () => {
    mocks.currentAgent.owner_id = 1001;
    mocks.currentAgent.user_group_ids = [12, 34];
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });
    mocks.currentConversation.mockResolvedValue({ data: {} });

    render(createElement(ChatContainer, { agentId: 2 }));

    await waitFor(() => {
      expect(mocks.chatViewProps.length).toBeGreaterThan(0);
    });

    expect(mocks.chatViewProps.at(-1).checkPermission([12, 34])).toBe(true);
    expect(mocks.checkPermission).toHaveBeenCalledWith({ groupIds: [] });
  });

  it("keeps enterprise agent group permission checks unchanged", async () => {
    mocks.currentAgent.owner_id = 0;
    mocks.currentAgent.user_group_ids = [12, 34];
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });
    mocks.currentConversation.mockResolvedValue({ data: {} });

    render(createElement(ChatContainer, { agentId: 2 }));

    await waitFor(() => {
      expect(mocks.chatViewProps.length).toBeGreaterThan(0);
    });

    expect(mocks.chatViewProps.at(-1).checkPermission([12, 34])).toBe(true);
    expect(mocks.checkPermission).toHaveBeenCalledWith({ groupIds: [12, 34] });
  });

  it("keeps ChatView in initial resolving state while OpenClaw status is still pending", async () => {
    const status = deferred<any>();
    mocks.currentAgent = {
      ...mocks.currentAgent,
      name: "QClaw",
      custom_config_obj: { agent_type: "qclaw", hostKind: "qclaw" },
    };
    mocks.status.mockReturnValue(status.promise);

    render(createElement(ChatContainer, { agentId: 2 }));

    await waitFor(() => {
      expect(mocks.status).toHaveBeenCalledWith(2, { ignoreMessage: true });
    });

    const latestProps = mocks.chatViewProps.at(-1);
    expect(latestProps?.features?.initialConversationResolving).toBe(true);
    expect(latestProps?.features?.openclawInputDisabledReason).toBe("正在检测 QClaw 连接...");
    expect(mocks.sharedStore.setCurrentState).not.toHaveBeenCalledWith(2, 0);
    expect(mocks.frontStore.setCurrentState).not.toHaveBeenCalledWith("2", 0, false);

    await act(async () => {
      status.resolve({ data: { connectionHealthy: false, hub53ai: { connectionStatus: "disconnected" } } });
      await status.promise;
    });
  });

  it("deduplicates OpenClaw status probing during StrictMode initialization", async () => {
    const status = deferred<any>();
    mocks.status.mockReturnValue(status.promise);

    render(createElement(StrictMode, null, createElement(ChatContainer, { agentId: 2 })));

    await waitFor(() => {
      expect(mocks.status).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      status.resolve({ data: { connectionHealthy: false, hub53ai: { connectionStatus: "disconnected" } } });
      await status.promise;
    });
  });

  it("publishes a blank OpenClaw conversation only after current session resolves empty", async () => {
    mocks.currentConversation.mockResolvedValue({ data: {} });
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });

    render(createElement(ChatContainer, { agentId: 2 }));

    await waitFor(() => {
      expect(mocks.currentConversation).toHaveBeenCalledWith(2, { ignoreMessage: true });
    });

    await waitFor(() => {
      expect(mocks.sharedStore.setCurrentState).toHaveBeenCalledWith(2, 0);
      expect(mocks.frontStore.setCurrentState).toHaveBeenCalledWith("2", 0, false);
    });

    const latestProps = mocks.chatViewProps.at(-1);
    expect(latestProps?.features?.initialConversationResolving).toBe(false);
  });

  it("disables the OpenClaw input and skips current-session loading while the plugin is offline", async () => {
    mocks.sharedStore.current_conversationid = "agent:main:dashboard:stale-qclaw" as any;
    mocks.frontStore.current_conversationid = "agent:main:dashboard:stale-qclaw" as any;
    mocks.currentAgent = {
      ...mocks.currentAgent,
      name: "QClaw",
      custom_config_obj: { agent_type: "qclaw", hostKind: "qclaw" },
    };
    mocks.status.mockResolvedValue({
      data: {
        healthy: true,
        gatewayHealth: { ok: true, status: "ok" },
        connectionHealthy: false,
        hub53ai: { connectionStatus: "disconnected" },
      },
    });
    mocks.currentConversation.mockResolvedValue({
      data: {
        id: "agent:main:dashboard:should-not-load",
        title: "不应加载",
      },
    });

    render(createElement(ChatContainer, { agentId: 2 }));

    await waitFor(() => {
      expect(mocks.status).toHaveBeenCalledWith(2, { ignoreMessage: true });
    });

    expect(mocks.currentConversation).not.toHaveBeenCalled();
    expect(mocks.conversations).not.toHaveBeenCalled();
    expect(mocks.sharedStore.setCurrentState).toHaveBeenCalledWith(2, 0);
    expect(mocks.frontStore.setCurrentState).toHaveBeenCalledWith("2", 0, false);
    const latestProps = mocks.chatViewProps.at(-1);
    expect(latestProps?.initialConversationId).toBeUndefined();
    expect(latestProps?.features).toMatchObject({
      openclaw: true,
      openclawInputDisabled: true,
      openclawInputDisabledReason: "QClaw 插件未连接，正在重连...",
    });
  });

  it("loads the current OpenClaw session after status polling reports the plugin is connected", async () => {
    vi.useFakeTimers();
    mocks.status
      .mockResolvedValueOnce({
        data: {
          healthy: true,
          gatewayHealth: { ok: true, status: "ok" },
          connectionHealthy: false,
          hub53ai: { connectionStatus: "disconnected" },
        },
      })
      .mockResolvedValueOnce({
        data: {
          connectionHealthy: true,
          hub53ai: { connectionStatus: "connected" },
        },
      });
    mocks.currentConversation.mockResolvedValue({
      data: {
        id: "agent:main:dashboard:recovered",
        title: "53AI Hub-openclaw-local@example.com：恢复后的会话",
      },
    });

    render(createElement(ChatContainer, { agentId: 2 }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.status).toHaveBeenCalledTimes(1);
    expect(mocks.currentConversation).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(mocks.currentConversation).toHaveBeenCalledWith(2, { ignoreMessage: true });
    });
    expect(mocks.sharedStore.setCurrentState).toHaveBeenCalledWith(2, "agent:main:dashboard:recovered");
  });

  it("ignores a stale disconnected status response after switching OpenClaw agents", async () => {
    const staleStatus = deferred<any>();
    const activeStatus = deferred<any>();
    mocks.status.mockImplementation((targetAgentId: string | number) =>
      String(targetAgentId) === "2" ? staleStatus.promise : activeStatus.promise
    );
    mocks.currentConversation.mockResolvedValue({
      data: {
        id: "agent:main:dashboard:agent-3-current",
        title: "53AI Hub-openclaw-local@example.com：A 智能体会话",
      },
    });

    const { rerender } = render(createElement(ChatContainer, { agentId: 2 }));

    await waitFor(() => {
      expect(mocks.status).toHaveBeenCalledWith(2, { ignoreMessage: true });
    });

    mocks.currentAgent = {
      ...mocks.currentAgent,
      agent_id: 3,
      name: "QClaw",
    };
    rerender(createElement(ChatContainer, { agentId: 3 }));

    await waitFor(() => {
      expect(mocks.status).toHaveBeenCalledWith(3, { ignoreMessage: true });
    });

    await act(async () => {
      activeStatus.resolve({
        data: {
          connectionHealthy: true,
          hub53ai: { connectionStatus: "connected" },
        },
      });
      await activeStatus.promise;
    });

    await waitFor(() => {
      expect(mocks.currentConversation).toHaveBeenCalledWith(3, { ignoreMessage: true });
    });

    await act(async () => {
      staleStatus.resolve({
        data: {
          connectionHealthy: false,
          hub53ai: { connectionStatus: "disconnected" },
        },
      });
      await staleStatus.promise;
    });

    const latestProps = mocks.chatViewProps.at(-1);
    expect(latestProps?.features?.openclawInputDisabled).toBe(false);
    expect(mocks.currentConversation).not.toHaveBeenCalledWith(2, { ignoreMessage: true });
  });

  it("renders Gateway settings as a right side panel that takes chat layout space", async () => {
    mocks.currentConversation.mockResolvedValue({
      data: {
        id: "agent:main:dashboard:current",
        title: "53AI Hub-openclaw-local@example.com：当前 OpenClaw 会话",
      },
    });
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });

    render(createElement(ChatContainer, { agentId: 2 }));

    const gatewayButton = await screen.findByRole("button", { name: "Gateway 设置" });
    fireEvent.click(gatewayButton);

    const sidePanel = await screen.findByTestId("openclaw-side-panel");
    expect(sidePanel).toContainElement(screen.getByTestId("openclaw-panel"));
    expect(sidePanel.className).toContain("flex-none");
    expect(sidePanel.className).toContain("w-[450px]");
    expect(sidePanel.className).toContain("border-l");
  });

  it("closes the usage guide when opening the Gateway settings panel", async () => {
    mocks.currentConversation.mockResolvedValue({
      data: {
        id: "agent:main:dashboard:current",
        title: "53AI Hub-openclaw-local@example.com：当前 OpenClaw 会话",
      },
    });
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });

    render(createElement(ChatContainer, { agentId: 2 }));

    const guideButton = await screen.findByRole("button", { name: "chat.usage_guide" });
    fireEvent.click(guideButton);
    expect(screen.getByText("chat.usage_guide")).toBeInTheDocument();

    const gatewayButton = await screen.findByRole("button", { name: "Gateway 设置" });
    fireEvent.click(gatewayButton);

    expect(await screen.findByTestId("openclaw-side-panel")).toBeInTheDocument();
    expect(screen.queryByText("chat.usage_guide")).not.toBeInTheDocument();
  });

  it("opens generated OpenClaw files in the right preview pane instead of downloading immediately", async () => {
    mocks.currentConversation.mockResolvedValue({ data: {} });
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });

    render(createElement(ChatContainer, { agentId: 2 }));

    const gatewayButton = await screen.findByRole("button", { name: "Gateway 设置" });
    fireEvent.click(gatewayButton);
    expect(await screen.findByTestId("openclaw-side-panel")).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.chatViewProps.at(-1)?.onOutputFilePreview).toEqual(expect.any(Function));
    });

    act(() => {
      mocks.chatViewProps.at(-1).onOutputFilePreview(
        {
          id: "file-1",
          file_name: "report.md",
          url: "/api/upload-files/file-1/download/report.md",
        },
        { id: "assistant-1" }
      );
    });

    expect(screen.queryByTestId("openclaw-side-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("openclaw-output-file-preview-pane")).toBeInTheDocument();
    expect(screen.getByText("report.md")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "action.download" })).toBeInTheDocument();
    expect(mocks.fileViewerProps.extension).toBe("md");
    expect(mocks.fileViewerProps.url).toContain("/api/upload-files/file-1/download/report.md");
    expect(mocks.fileViewerProps.url).toContain("token=user-token-1");

    fireEvent.click(screen.getByRole("button", { name: "关闭文件预览" }));
    expect(screen.queryByTestId("openclaw-output-file-preview-pane")).not.toBeInTheDocument();
  });

  it("prefers generated file download urls over transient realtime file urls", async () => {
    mocks.currentConversation.mockResolvedValue({ data: {} });
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });

    render(createElement(ChatContainer, { agentId: 2 }));

    await waitFor(() => {
      expect(mocks.chatViewProps.at(-1)?.onOutputFilePreview).toEqual(expect.any(Function));
    });

    act(() => {
      mocks.chatViewProps.at(-1).onOutputFilePreview(
        {
          id: "file-1",
          file_name: "live-report.md",
          url: "http://127.0.0.1:1/unavailable/live-report.md",
          download_url: "/api/upload-files/file-1/download/live-report.md",
        },
        { id: "assistant-1" }
      );
    });

    expect(screen.getByTestId("openclaw-output-file-preview-pane")).toBeInTheDocument();
    expect(mocks.fileViewerProps.url).toContain("/api/upload-files/file-1/download/live-report.md");
    expect(mocks.fileViewerProps.url).toContain("token=user-token-1");
    expect(mocks.fileViewerProps.url).not.toContain("127.0.0.1:1");
  });

  it("opens content-only OpenClaw local files in the right preview pane", async () => {
    mocks.currentConversation.mockResolvedValue({ data: {} });
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });

    render(createElement(ChatContainer, { agentId: 2 }));

    await waitFor(() => {
      expect(mocks.chatViewProps.at(-1)?.onOutputFilePreview).toEqual(expect.any(Function));
    });

    act(() => {
      mocks.chatViewProps.at(-1).onOutputFilePreview(
        {
          id: "local:/Users/y65ng/.qclaw/workspace/test_document.txt",
          file_name: "test_document.txt",
          mime_type: "text/plain",
          content: "这是一个十五字测试文档",
          source_kind: "tool.write",
        },
        { id: "assistant-1" }
      );
    });

    expect(screen.getByTestId("openclaw-output-file-preview-pane")).toBeInTheDocument();
    expect(screen.getByText("test_document.txt")).toBeInTheDocument();
    expect(mocks.fileViewerProps.url).toBe("blob:openclaw-output-file");
    expect(mocks.fileViewerProps.content).toBe("这是一个十五字测试文档");
    expect(mocks.fileViewerProps.extension).toBe("txt");
  });

  it("opens base64-only OpenClaw files in the right preview pane", async () => {
    mocks.currentConversation.mockResolvedValue({ data: {} });
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });

    render(createElement(ChatContainer, { agentId: 2 }));

    await waitFor(() => {
      expect(mocks.chatViewProps.at(-1)?.onOutputFilePreview).toEqual(expect.any(Function));
    });

    act(() => {
      mocks.chatViewProps.at(-1).onOutputFilePreview(
        {
          id: "output-test-12",
          file_name: "test_12words_v3.txt",
          mime_type: "text/plain",
          base64: "56ys5LiJ5Liq5Y2B5LqM5Liq5rGJ5a2X5rWL6K+V5paH5qGj",
          source_kind: "tool.write",
        },
        { id: "assistant-1" }
      );
    });

    expect(screen.getByTestId("openclaw-output-file-preview-pane")).toBeInTheDocument();
    expect(screen.getByText("test_12words_v3.txt")).toBeInTheDocument();
    expect(mocks.fileViewerProps.url).toBe(
      "data:text/plain;base64,56ys5LiJ5Liq5Y2B5LqM5Liq5rGJ5a2X5rWL6K+V5paH5qGj"
    );
    expect(mocks.fileViewerProps.extension).toBe("txt");
  });

  it("opens the add-to-knowledge dialog with the OpenClaw assistant answer", async () => {
    mocks.currentConversation.mockResolvedValue({ data: {} });
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });

    render(createElement(ChatContainer, { agentId: 2 }));

    await waitFor(() => {
      expect(mocks.chatViewProps.at(-1)?.onAddAsMd).toEqual(expect.any(Function));
    });

    act(() => {
      mocks.chatViewProps.at(-1).onAddAsMd({
        id: "assistant-1",
        question: "生成一份迁移报告",
        answer: "",
        openclawProjection: {
          visibleAnswer: "这是 OpenClaw 生成的最终报告。",
          timelineItems: [],
          outputFiles: [],
          activities: [],
        },
      });
    });

    expect(mocks.addAnswerAsMdOpen).toHaveBeenCalledWith({
      answer: "这是 OpenClaw 生成的最终报告。",
      question: "生成一份迁移报告",
    });
  });

  it("lets the OpenClaw history selector shrink with the available toolbar space", async () => {
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });
    mocks.currentConversation.mockResolvedValue({ data: {} });
    mocks.sharedStore.current_conversationid = "agent:main:dashboard:history";
    mocks.sharedStore.conversations = [
      {
        conversation_id: "agent:main:dashboard:history",
        title: "A very long OpenClaw conversation title that should stay truncated inside the selector",
        created_time: 1779871345,
        updated_time: 1779871346,
        is_valid: 1,
      },
    ];

    render(createElement(ChatContainer, { agentId: 2 }));

    const selector = screen.getByTestId("openclaw-history-selector");
    const selectorClasses = selector.className.split(/\s+/);
    expect(selectorClasses).toEqual(expect.arrayContaining(["min-w-0", "flex-1", "max-w-[520px]"]));
    expect(selectorClasses).not.toContain("w-[520px]");
    expect(selectorClasses).not.toContain("max-w-[45vw]");
    expect(selectorClasses).not.toContain("flex-none");

    const label = selector.querySelector(".openclaw-history-trigger > span");
    expect(label?.className.split(/\s+/)).toEqual(expect.arrayContaining(["min-w-0", "flex-1", "truncate"]));
  });

  it("renders OpenClaw history in the plugin order without pinning the current conversation", async () => {
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });
    mocks.currentConversation.mockResolvedValue({ data: {} });
    mocks.sharedStore.current_conversationid = "agent:main:dashboard:current";
    mocks.sharedStore.conversations = [
      {
        conversation_id: "agent:main:dashboard:current",
        title: "53AI Hub-Y65NG：当前",
        created_time: 1779871345,
        updated_time: 1779871346,
        is_valid: 1,
      },
    ];
    mocks.conversations.mockResolvedValue({
      data: {
        sessions: [
          { id: "agent:main:dashboard:control", title: "Claw Control Center" },
          { id: "agent:main:dashboard:current", title: "53AI Hub-Y65NG：当前" },
          { id: "agent:main:dashboard:other", title: "53AI Hub-Y65NG：其他" },
        ],
        pagination: { hasMore: false },
      },
    });

    render(createElement(ChatContainer, { agentId: 2 }));

    const selector = screen.getByTestId("openclaw-history-selector");
    const trigger = selector.querySelector(".openclaw-history-trigger") as HTMLElement;
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(mocks.conversations).toHaveBeenCalledWith(2, {
        limit: 30,
        offset: 0,
      });
    });

    await waitFor(() => {
      const rows = Array.from(document.querySelectorAll(".openclaw-history-row"));
      expect(rows.map((row) => row.textContent)).toEqual([
        "Claw Control Center",
        "53AI Hub-Y65NG：当前",
        "53AI Hub-Y65NG：其他",
      ]);
    });
  });

  it("selects OpenClaw history on the index agent route without front-store navigation", async () => {
    window.history.replaceState(null, "", "/index/agent?agent_id=2&type=openclaw");
    mocks.searchParams = new URLSearchParams("type=openclaw");
    const replaceState = vi.spyOn(window.history, "replaceState");
    mocks.status.mockResolvedValue({ data: { connectionHealthy: true, hub53ai: { connectionStatus: "connected" } } });
    mocks.currentConversation.mockResolvedValue({ data: {} });
    mocks.sharedStore.current_conversationid = "agent:main:dashboard:current";
    mocks.sharedStore.conversations = [
      {
        conversation_id: "agent:main:dashboard:current",
        title: "53AI Hub-Y65NG：当前",
        created_time: 1779871345,
        updated_time: 1779871346,
        is_valid: 1,
      },
    ];
    mocks.conversations.mockResolvedValue({
      data: {
        sessions: [
          { id: "agent:main:dashboard:current", title: "53AI Hub-Y65NG：当前" },
          { id: "agent:main:dashboard:other", title: "53AI Hub-Y65NG：其他" },
        ],
        pagination: { hasMore: false },
      },
    });

    render(createElement(ChatContainer, { agentId: 2, isIndexRoute: true }));

    const selector = screen.getByTestId("openclaw-history-selector");
    const trigger = selector.querySelector(".openclaw-history-trigger") as HTMLElement;
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(document.querySelector('[data-conversation-id="agent:main:dashboard:other"]')).toBeInTheDocument();
    });

    fireEvent.click(document.querySelector('[data-conversation-id="agent:main:dashboard:other"]') as HTMLElement);

    expect(mocks.sharedStore.setCurrentState).toHaveBeenCalledWith(2, "agent:main:dashboard:other");
    expect(mocks.frontStore.setCurrentState).toHaveBeenCalledWith(2, "agent:main:dashboard:other", false);
    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      expect.stringContaining("/index/agent?agent_id=2&type=openclaw&conversation_id=agent%3Amain%3Adashboard%3Aother")
    );
    expect(window.location.pathname).toBe("/index/agent");
    expect(window.location.search).toContain("conversation_id=agent%3Amain%3Adashboard%3Aother");
    replaceState.mockRestore();
  });
});
