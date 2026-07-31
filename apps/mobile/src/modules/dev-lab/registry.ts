import { COMMENT_SEND_SCENARIO_ID } from './params'

export interface DevLabScenarioDefinition {
  description: string
  id: typeof COMMENT_SEND_SCENARIO_ID
  parameterCount: number
  title: string
}

export const DEV_LAB_SCENARIOS: readonly DevLabScenarioDefinition[] = [
  {
    description: 'Composer-to-comment trajectory, optimistic delivery, rollback, and reduced-motion behavior.',
    id: COMMENT_SEND_SCENARIO_ID,
    parameterCount: 6,
    title: 'Comment send flight',
  },
]
