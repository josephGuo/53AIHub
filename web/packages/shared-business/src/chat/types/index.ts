export * from './message';

/** 会话信息 */
export interface ConversationInfo {
  conversation_id: string | number;
  title?: string;
  created_time?: number | string;
  updated_time?: number | string;
  created_at?: string;
  updated_at?: string;
  agent_id?: string | number;
  virtual_id?: string;
  top?: number;
  is_valid?: number;
}
