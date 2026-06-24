/**
 * Agent 数据 Tab
 *
 * 引入 work-ai 统计组件
 */

import WorkAIStatistic from '@/views/work-ai/Statistic'

interface AgentDataTabProps {
  agentId?: string | number
}

export function AgentDataTab({ agentId }: AgentDataTabProps) {
  return <div className="h-full p-6 bg-white overflow-hidden">
    <WorkAIStatistic agentId={agentId} showSourceFilter showStatusFilter={false} />
  </div>
}

export default AgentDataTab