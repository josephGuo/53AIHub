import { create } from "zustand";
import type { IConversationApi } from "../adapters/types";
import type { ConversationInfo } from "../types";

export interface ConversationState {
  conversations: ConversationInfo[];
  current_agentid: string | number;
  current_conversationid: string | number;
  next_agent_prepare: { agent_id?: string | number; parameters?: any; execution_rule?: string };
  currentVirtualId: string;
}

export interface ConversationActions {
  setNextAgentPrepare: (data: any) => void;
  loadConversations: (agent_id?: string | number) => Promise<ConversationInfo[]>;
  createConversation: (
    agent_id: string | number,
    title?: string,
    file_id?: string,
    conversation_type?: number
  ) => Promise<ConversationInfo>;
  addConversation: (conversation: ConversationInfo) => void;
  updateConversation: (conversation: Partial<ConversationInfo>) => void;
  editConversation: (
    conversation: Pick<ConversationInfo, "conversation_id" | "title">
  ) => Promise<void>;
  delConversation: (conversation: ConversationInfo) => Promise<void>;
  setCurrentState: (
    agent_id: string | number,
    conversation_id: string | number,
    isReplace?: boolean
  ) => void;
  clearCurrentState: () => void;
  currentConversation: () => ConversationInfo | undefined;
}

const initialState: ConversationState = {
  conversations: [],
  current_agentid: 0,
  current_conversationid: 0,
  next_agent_prepare: {},
  currentVirtualId: "",
};

export const DEFAULT_AGENT_IMG = "/images/default_agent.png";

// Store instance - will be initialized with API adapter
let conversationApi: IConversationApi | null = null;
/** 请求版本号：用于丢弃过期请求的响应 */
let loadConversationsRequestId = 0;

export const setConversationApi = (api: IConversationApi) => {
  conversationApi = api;
};

function getSimpleDateFormat(date: number | string, format: string): string {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return format
    .replace("YYYY", String(year))
    .replace("MM", month)
    .replace("DD", day)
    .replace("hh", hours)
    .replace("mm", minutes);
}

export const useConversationStore = create<ConversationState & ConversationActions>(
  (set, get) => ({
    ...initialState,

    currentConversation: () => {
      const state = get();
      const targetId = String(state.current_conversationid);
      const conversation = state.conversations.find(
        (item) => String(item.conversation_id) === targetId
      );

      if (conversation) {
        return conversation;
      }

      if (!state.currentVirtualId) {
        set({ currentVirtualId: Date.now().toString() });
      }

      return {
        conversation_id: 0,
        title: "",
        created_time: 0,
        updated_time: 0,
        top: 0,
        is_valid: 0,
        virtual_id: get().currentVirtualId,
      };
    },

    setNextAgentPrepare: (data) => {
      set({ next_agent_prepare: data });
    },

    loadConversations: async (agent_id) => {
      const requestId = ++loadConversationsRequestId;
      const targetAgentId = agent_id;

      if (!conversationApi) {
        console.warn("conversationApi not set, returning empty conversations");
        return [];
      }

      try {
        const res = await conversationApi.list(targetAgentId);

        // 丢弃过期请求的响应
        if (requestId !== loadConversationsRequestId) {
          return [];
        }

        const conversations = (res.data?.conversations || res.conversations || []).map(
          (item: any) => ({
            ...item,
            created_at: getSimpleDateFormat(item.created_time, "YYYY.MM.DD hh:mm"),
            updated_at: getSimpleDateFormat(item.updated_time, "YYYY.MM.DD hh:mm"),
          })
        );

        const currentId = get().current_conversationid;
        if (currentId && currentId !== 0) {
          const currentInNew = conversations.find(
            (c: ConversationInfo) => String(c.conversation_id) === String(currentId)
          );
          const oldCurrent = get().conversations.find(
            (c: ConversationInfo) => String(c.conversation_id) === String(currentId)
          );
          if (!currentInNew && oldCurrent) {
            conversations.unshift(oldCurrent);
          }
        }

        set({ conversations });
        return conversations;
      } catch (err) {
        console.error("Failed to load conversations:", err);
        return [];
      }
    },

    createConversation: async (agent_id, title = "", file_id = "", conversation_type) => {
      if (!conversationApi) {
        throw new Error("conversationApi not set");
      }

      const data: any = { agent_id, title };
      if (file_id) {
        data.file_id = file_id;
      }
      if (conversation_type !== undefined) {
        data.conversation_type = conversation_type;
      }

      const res = await conversationApi.create(agent_id, title, file_id, String(conversation_type || ""));
      return res.data || res;
    },

    addConversation: (conversation) => {
      const newConversation = {
        ...conversation,
        created_at: getSimpleDateFormat(conversation.created_time || 0, "YYYY.MM.DD hh:mm"),
        updated_at: getSimpleDateFormat(conversation.updated_time || 0, "YYYY.MM.DD hh:mm"),
      };
      set((state) => ({
        conversations: [newConversation, ...state.conversations],
      }));
    },

    updateConversation: (conversation) => {
      set((state) => ({
        conversations: state.conversations.map((item) =>
          item.conversation_id === conversation.conversation_id
            ? { ...item, ...conversation }
            : item
        ),
      }));
    },

    editConversation: async (conversation) => {
      if (!conversationApi) {
        throw new Error("conversationApi not set");
      }

      const data = { title: conversation.title };
      await conversationApi.edit(conversation.conversation_id, data);
      get().updateConversation(conversation);
    },

    delConversation: async (conversation) => {
      set((state) => ({
        conversations: state.conversations.filter(
          (item) => item.conversation_id !== conversation.conversation_id
        ),
      }));

      if (conversationApi) {
        await conversationApi.del(conversation.conversation_id);
      }

      if (get().current_conversationid === conversation.conversation_id) {
        get().setCurrentState(get().current_agentid, 0);
      }
    },

    setCurrentState: (agent_id: string | number, conversation_id: string | number, _isReplace = true) => {
      set((state) => {
        if (
          state.current_conversationid !== conversation_id ||
          state.current_agentid !== agent_id
        ) {
          return {
            current_agentid: agent_id,
            current_conversationid: conversation_id,
            currentVirtualId: "",
          };
        }
        return {
          current_agentid: agent_id,
          current_conversationid: conversation_id,
        };
      });
    },

    clearCurrentState: () => {
      set({
        current_agentid: 0,
        current_conversationid: 0,
        conversations: [],
      });
    },
  })
);

// Computed hook for current conversation
export const useCurrentConversation = () => {
  const currentConversationId = useConversationStore(
    (state) => state.current_conversationid
  );
  const conversations = useConversationStore((state) => state.conversations);

  const conversation = conversations.find(
    (item) => String(item.conversation_id) === String(currentConversationId)
  );

  return conversation;
};
