import {
  getOpenClawCompatibleChannelType,
  isOpenClawCompatibleAgentType,
  isOpenClawCompatibleChannelType,
} from "@km/shared-business/agent-create";
import type { AgentPlatformOption } from "@km/shared-business/agent-create";

export interface AgentListFilterFormLike {
  group_id: number;  // 单选
  platform: string;
  type: string;
  keyword: string;
  page: number;
  page_size: number;
}

export interface AgentListParams {
  group_id: string;
  channel_types?: string;
  agent_types: string;
  keyword: string;
  offset: number;
  limit: number;
}

export interface PlatformFilterChannelOption {
  label: string;
  channelType: number;
}

export interface PlatformFilterOption {
  label: string;
  value: string;
}

export function resolveAgentPlatformFilter(platform?: string): Pick<AgentListParams, "channel_types"> {
  const platformValue = String(platform || "").trim();
  if (!platformValue) return {};
  if (isOpenClawCompatibleAgentType(platformValue)) {
    return { channel_types: String(getOpenClawCompatibleChannelType(platformValue)) };
  }
  return { channel_types: platformValue };
}

export function buildAgentListParams(currentFilter: AgentListFilterFormLike): AgentListParams {
  return {
    group_id: currentFilter.group_id ? String(currentFilter.group_id) : "",
    ...resolveAgentPlatformFilter(currentFilter.platform),
    agent_types: currentFilter.type,
    keyword: currentFilter.keyword,
    offset: (currentFilter.page - 1) * currentFilter.page_size,
    limit: currentFilter.page_size,
  };
}

export function createAgentPlatformFilterOptions(
  channelOptions: PlatformFilterChannelOption[],
  platforms: AgentPlatformOption[],
): PlatformFilterOption[] {
  const legacyChannelOptions = channelOptions
    .filter((item) => !isOpenClawCompatibleChannelType(item.channelType))
    .map((item) => ({
      label: item.label,
      value: item.channelType === 0 ? "1,3,44,36" : String(item.channelType),
    }));

  const openClawCompatibleOptions = platforms
    .filter((platform) => isOpenClawCompatibleChannelType(platform.channel_type))
    .map((platform) => ({
      label: platform.label,
      value: String(platform.channel_type),
    }));

  return [...legacyChannelOptions, ...openClawCompatibleOptions];
}
