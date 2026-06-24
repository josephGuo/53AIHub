export type StrategyLogic = 1 | 2

export type MatcherType = 'extension' | 'filename' | 'foldername' | 'space_name'

export type MatcherOperator = 'in' | 'contains' | 'equals' | 'starts_with' | 'ends_with'

export interface Matcher {
  type: MatcherType
  operator: MatcherOperator
  value: string | string[]
}

export interface StrategyConditionsJson {
  matchers: Matcher[]
}

export interface Strategy {
  id: string
  name: string
  priority: number
  pipeline_id: string
  pipeline_name?: string
  logic: StrategyLogic
  enabled: boolean
  is_default: boolean
  conditions_json: string | StrategyConditionsJson
}

export interface CreateStrategyRequest {
  name: string
  priority: number
  pipeline_id: number
  logic: StrategyLogic
  enabled: boolean
  conditions_json: StrategyConditionsJson
}

export interface UpdateStrategyRequest {
  name?: string
  priority?: number
  pipeline_id?: number
  logic?: StrategyLogic
  enabled?: boolean
  conditions_json?: StrategyConditionsJson
}

export interface ReorderStrategyRequest {
  strategy_ids: string[]
}
