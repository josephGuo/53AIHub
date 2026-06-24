import service from "../../config";
import { handleError } from "../../errorHandler";

export interface OpenClawPaginationParams {
  limit?: number;
  offset?: number;
}

export interface OpenClawSession {
  id: string;
  title?: string;
  status?: string;
  hostKind?: string;
  runnerCommand?: string;
  createdAt?: string;
  updatedAt?: string;
  lastEventSeq?: number;
}

export interface OpenClawMessage {
  id: string;
  sessionId?: string;
  role: string;
  content?: string;
  createdAt?: string;
  reasoning?: string;
  reasoningText?: string;
  reasoning_content?: string;
  thinking?: string;
  thinkingText?: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

export interface OpenClawTimelineEvent {
  id: string;
  sessionId?: string;
  seq?: number;
  kind: string;
  payload?: Record<string, unknown>;
  createdAt?: string;
}

export interface OpenClawLedgerEvent {
  protocol_version: "openclaw.ledger.v1";
  seq: number;
  session_id: string;
  conversation_id: string;
  turn_id: string;
  run_id?: string;
  active_request_id: string;
  part_id: string;
  part_type: "answer" | "thinking" | "tool" | "output_file" | "status";
  event_type: "turn.started" | "part.delta" | "part.replace" | "part.done" | "turn.completed" | "turn.interrupted" | "turn.failed";
  operation: "append" | "replace" | "close" | "noop";
  visibility: "stream" | "final" | "hidden";
  text?: string;
  payload?: Record<string, unknown>;
  terminal_status?: "running" | "completed" | "interrupted" | "failed" | "cancelled";
  created_at: string;
  raw_event_ref?: string;
}

export interface OpenClawSessionSnapshot {
  session_id: string;
  conversation_id: string;
  last_seq: number;
  active_turns: Array<{
    turn_id: string;
    run_id?: string;
    active_request_id: string;
    status: "running" | "completed" | "interrupted" | "failed" | "cancelled";
    last_seq: number;
    part_ids: string[];
  }>;
  recent_events: OpenClawLedgerEvent[];
  ledger_events?: OpenClawLedgerEvent[];
  ledgerEvents?: OpenClawLedgerEvent[];
}

export interface OpenClawControlParams {
  action: "stop" | "respond_interruption" | "submit_answer" | "resolve_interruption";
  [key: string]: unknown;
}

function buildPaginationParams(params: OpenClawPaginationParams = {}) {
  const query: OpenClawPaginationParams = {};
  if (typeof params.limit === "number" && params.limit > 0) {
    query.limit = params.limit;
  }
  if (typeof params.offset === "number" && params.offset > 0) {
    query.offset = params.offset;
  }
  return query;
}

export const openclawApi = {
  conversations(agentId: string | number, params: OpenClawPaginationParams = {}) {
    return service
      .get(`/api/openclaw/agents/${agentId}/conversations`, {
        params: buildPaginationParams(params),
        requiresAuth: true,
      })
      .catch(handleError);
  },

  currentConversation(agentId: string | number, options?: { ignoreMessage?: boolean }) {
    return service
      .get(`/api/openclaw/agents/${agentId}/conversations/current`, {
        requiresAuth: true,
      })
      .catch((error) => handleError(error, { ignoreMessage: options?.ignoreMessage }));
  },

  messages(agentId: string | number, conversationId: string, params: OpenClawPaginationParams = {}) {
    return service
      .get(
        `/api/openclaw/agents/${agentId}/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          params: buildPaginationParams(params),
          requiresAuth: true,
        }
      )
      .catch(handleError);
  },

  events(agentId: string | number, conversationId: string, params: OpenClawPaginationParams & { after_seq?: number } = {}) {
    return service
      .get(
        `/api/openclaw/agents/${agentId}/conversations/${encodeURIComponent(conversationId)}/events`,
        {
          params: {
            ...buildPaginationParams(params),
            ...(typeof params.after_seq === "number" && params.after_seq > 0 ? { after_seq: params.after_seq } : {}),
          },
          requiresAuth: true,
        }
      )
      .catch(handleError);
  },

  snapshot(agentId: string | number, conversationId: string, params: { after_seq?: number } = {}) {
    return service
      .get(
        `/api/openclaw/agents/${agentId}/conversations/${encodeURIComponent(conversationId)}/snapshot`,
        {
          params: {
            ...(typeof params.after_seq === "number" && params.after_seq > 0 ? { after_seq: params.after_seq } : {}),
          },
          requiresAuth: true,
        }
      )
      .catch(handleError);
  },

  control(agentId: string | number, conversationId: string, params: OpenClawControlParams) {
    return service
      .post(
        `/api/openclaw/agents/${agentId}/conversations/${encodeURIComponent(conversationId)}/control`,
        params,
        { requiresAuth: true }
      )
      .catch(handleError);
  },

  status(agentId: string | number, options?: { ignoreMessage?: boolean }) {
    return service
      .get(`/api/openclaw/agents/${agentId}/status`, { requiresAuth: true })
      .catch((error) => handleError(error, { ignoreMessage: options?.ignoreMessage }));
  },

  config(agentId: string | number, options?: { ignoreMessage?: boolean }) {
    return service
      .get(`/api/openclaw/agents/${agentId}/config`, { requiresAuth: true })
      .catch((error) => handleError(error, { ignoreMessage: options?.ignoreMessage }));
  },

  skills(agentId: string | number, options?: { ignoreMessage?: boolean }) {
    return service
      .get(`/api/openclaw/agents/${agentId}/skills`, { requiresAuth: true })
      .catch((error) => handleError(error, { ignoreMessage: options?.ignoreMessage }));
  },

  cronTasks(agentId: string | number, params: OpenClawPaginationParams = {}, options?: { ignoreMessage?: boolean }) {
    return service
      .get(`/api/openclaw/agents/${agentId}/cron-tasks`, {
        params: buildPaginationParams(params),
        requiresAuth: true,
      })
      .catch((error) => handleError(error, { ignoreMessage: options?.ignoreMessage }));
  },
};

export default openclawApi;
