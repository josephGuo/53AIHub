import type {
  IConversationApi,
  IAgentApi,
  ChatCompletionParams,
} from "@km/shared-business/chat/adapters/types";
import {
  buildOpenClawConversation as buildSharedOpenClawConversation,
  buildOpenClawMessages as buildSharedOpenClawMessages,
  createOpenClawConversationApiAdapter as createSharedOpenClawConversationApiAdapter,
} from "@km/shared-business/chat";
import conversationApi from "@/api/modules/conversation";
import agentsApi from "@/api/modules/agents";
import chatApi from "@/api/modules/chat";
import openclawApi, { type OpenClawSession } from "@/api/modules/openclaw";

/**
 * front-react Conversation API Adapter
 * 桥接 shared-business 的 IConversationApi 和 front-react 的 API
 */
export const conversationApiAdapter: IConversationApi = {
  create: async (agentId: string, question: string, title?: string, type?: string) => {
    const conversationType = type ? Number(type) : undefined;
    return conversationApi.create({
      agent_id: agentId,
      title: title || question.slice(0, 20),
      conversation_type: conversationType,
    });
  },

  list: async (agentId: string, params?: { conversation_type?: string }) => {
    const result = await conversationApi.list({
      agent_id: agentId,
      conversation_type: params?.conversation_type ? Number(params.conversation_type) : undefined,
    });
    return result;
  },

  messages: async (conversationId: string, params?: { offset?: number; limit?: number }) => {
    return conversationApi.messasges(conversationId, {
      offset: params?.offset ?? 0,
      limit: params?.limit ?? 20,
    });
  },

  edit: async (conversationId: string , data: { title: string }) => {
    return conversationApi.edit(conversationId, {
      title: data.title,
      file_id: "",
    });
  },

  del: async (conversationId: string ) => {
    return conversationApi.del(conversationId);
  },

  completions: async (
    params: ChatCompletionParams,
    options: {
      responseType: "stream";
      onDownloadProgress: (e: any) => void;
      signal?: AbortSignal;
    }
  ) => {
    return chatApi.completions({ ...params, source: "web" } as any, {
      responseType: "stream",
      onDownloadProgress: options.onDownloadProgress,
      signal: options.signal,
    });
  },
};

export function buildOpenClawConversation(session: OpenClawSession, agentId: string | number) {
  return buildSharedOpenClawConversation(session as any, agentId);
}

export const buildOpenClawMessages = buildSharedOpenClawMessages;

/**
 * OpenClaw Conversation API Adapter
 * OpenClaw 会话与消息来自插件侧，不走 53AIHub 平台会话接口。
 */
export function createOpenClawConversationApiAdapter(agentId: string | number): IConversationApi {
  return createSharedOpenClawConversationApiAdapter({
    agentId,
    openclawApi,
    completions: (params, options) =>
      chatApi.completions(params as any, {
        responseType: "stream",
        onDownloadProgress: options.onDownloadProgress,
        signal: options.signal,
      }),
    requestSource: "web",
    canonicalOnly: true,
  });
}

/**
 * front-react Agent API Adapter
 * 桥接 shared-business 的 IAgentApi 和 front-react 的 API
 */
export const agentApiAdapter: IAgentApi = {
  detail: async (agentId: string) => {
    const res = await agentsApi.explore.detail(agentId);
    return transformAgentInfo(res.data);
  },

  list: async () => {
    const res = await agentsApi.explore.list({});
    return (res.data?.agents || []).map(transformAgentInfo);
  },

  myDetail: async (agentId: string) => {
    const res = await agentsApi.my.detail(agentId);
    return transformAgentInfo(res.data);
  },

  myList: async () => {
    const res = await agentsApi.my.list({});
    return (res.data?.agents || []).map(transformAgentInfo);
  },
};

/**
 * 转换 Agent 信息格式
 */
function transformAgentInfo(raw: any): any {
  if (!raw) return null;
  return {
    ...raw,
    custom_config_obj: raw.custom_config
      ? JSON.parse(raw.custom_config)
      : {},
    settings_obj: raw.settings
      ? JSON.parse(raw.settings)
      : {},
    configs: raw.configs
      ? JSON.parse(raw.configs)
      : {},
    use_cases: raw.use_cases
      ? JSON.parse(raw.use_cases)
      : [],
  };
}
