export const COMMENT_SEND_SCENARIO_ID = 'comment-send-flight'

export type DevLabMotionMode = 'always' | 'never' | 'system'
export type DevLabOutcome = 'failure' | 'success'

export interface CommentSendScenarioParams {
  durationMs: number
  latencyMs: number
  lift: number
  message: string
  motion: DevLabMotionMode
  outcome: DevLabOutcome
  scene: typeof COMMENT_SEND_SCENARIO_ID
}

export interface DevLabValidationIssue {
  field: keyof CommentSendScenarioParams
  message: string
  value: string | undefined
}

export interface ParsedDevLabParams {
  issues: DevLabValidationIssue[]
  value: CommentSendScenarioParams
}

export type DevLabRouteParams = Record<string, string | string[] | undefined>

export const COMMENT_SEND_SCENARIO_DEFAULTS: CommentSendScenarioParams = {
  durationMs: 360,
  latencyMs: 650,
  lift: 8,
  message: 'A quiet moment, beautifully framed.',
  motion: 'system',
  outcome: 'success',
  scene: COMMENT_SEND_SCENARIO_ID,
}

function readSingle(
  field: keyof CommentSendScenarioParams,
  input: string | string[] | undefined,
  issues: DevLabValidationIssue[],
): string | undefined {
  if (!Array.isArray(input)) {
    return input
  }
  if (input.length > 1) {
    issues.push({ field, message: 'Provide this parameter only once.', value: input.join(', ') })
  }
  return input[0]
}

function parseInteger(
  field: 'durationMs' | 'latencyMs' | 'lift',
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
  issues: DevLabValidationIssue[],
): number {
  if (raw === undefined) {
    return fallback
  }
  if (!/^-?\d+$/.test(raw.trim())) {
    issues.push({ field, message: `Use a whole number from ${min} to ${max}.`, value: raw })
    return fallback
  }
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    issues.push({ field, message: `Value must be between ${min} and ${max}.`, value: raw })
    return fallback
  }
  return value
}

function parseChoice<T extends string>(
  field: 'motion' | 'outcome' | 'scene',
  raw: string | undefined,
  choices: readonly T[],
  fallback: T,
  issues: DevLabValidationIssue[],
): T {
  if (raw === undefined) {
    return fallback
  }
  if (!choices.includes(raw as T)) {
    issues.push({ field, message: `Expected one of: ${choices.join(', ')}.`, value: raw })
    return fallback
  }
  return raw as T
}

export function parseDevLabParams(input: DevLabRouteParams): ParsedDevLabParams {
  const issues: DevLabValidationIssue[] = []
  const duration = readSingle('durationMs', input.duration, issues)
  const latency = readSingle('latencyMs', input.latency, issues)
  const lift = readSingle('lift', input.lift, issues)
  const message = readSingle('message', input.message, issues)
  const motion = readSingle('motion', input.motion, issues)
  const outcome = readSingle('outcome', input.outcome, issues)
  const scene = readSingle('scene', input.scene, issues)
  const normalizedMessage = message?.trim()
  let validMessage = COMMENT_SEND_SCENARIO_DEFAULTS.message

  if (message !== undefined) {
    if (!normalizedMessage) {
      issues.push({ field: 'message', message: 'Message cannot be empty.', value: message })
    }
    else if (normalizedMessage.length > 280) {
      issues.push({ field: 'message', message: 'Message cannot exceed 280 characters.', value: message })
    }
    else {
      validMessage = normalizedMessage
    }
  }

  return {
    issues,
    value: {
      durationMs: parseInteger('durationMs', duration, COMMENT_SEND_SCENARIO_DEFAULTS.durationMs, 120, 1600, issues),
      latencyMs: parseInteger('latencyMs', latency, COMMENT_SEND_SCENARIO_DEFAULTS.latencyMs, 0, 5000, issues),
      lift: parseInteger('lift', lift, COMMENT_SEND_SCENARIO_DEFAULTS.lift, 0, 48, issues),
      message: validMessage,
      motion: parseChoice(
        'motion',
        motion,
        ['system', 'always', 'never'],
        COMMENT_SEND_SCENARIO_DEFAULTS.motion,
        issues,
      ),
      outcome: parseChoice('outcome', outcome, ['success', 'failure'], COMMENT_SEND_SCENARIO_DEFAULTS.outcome, issues),
      scene: parseChoice('scene', scene, [COMMENT_SEND_SCENARIO_ID], COMMENT_SEND_SCENARIO_DEFAULTS.scene, issues),
    },
  }
}

export function serializeDevLabParams(value: CommentSendScenarioParams): Record<string, string> {
  return {
    duration: String(value.durationMs),
    latency: String(value.latencyMs),
    lift: String(value.lift),
    message: value.message,
    motion: value.motion,
    outcome: value.outcome,
    scene: value.scene,
  }
}
