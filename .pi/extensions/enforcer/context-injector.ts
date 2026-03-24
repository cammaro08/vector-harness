import type { EventType, LogEntry } from '../../../tools/progressLog'

export interface AttemptRecord {
  attemptNumber: number
  timestamp: string
  stepName: string
  agentName: string
  result: 'success' | 'failed'
  errorDetails?: string
}

export interface RetryContext {
  currentAttempt: number
  maxAttempts: number
  previousAttempts: AttemptRecord[]
  isLastAttempt: boolean
}

// In-memory store (per session)
const attemptHistory = new Map<string, AttemptRecord[]>()

export function recordAttempt(taskId: string, record: AttemptRecord): void {
  const history = attemptHistory.get(taskId) ?? []
  attemptHistory.set(taskId, [...history, record])
}

export function getRetryContext(taskId: string, maxAttempts: number = 3): RetryContext {
  const history = attemptHistory.get(taskId) ?? []
  const currentAttempt = history.length + 1
  return {
    currentAttempt,
    maxAttempts,
    previousAttempts: history,
    isLastAttempt: currentAttempt >= maxAttempts
  }
}

export function formatContextBanner(context: RetryContext): string {
  const lines = [
    '=== ENFORCEMENT CONTEXT ===',
    `Attempt: ${context.currentAttempt} of ${context.maxAttempts}`,
  ]

  if (context.previousAttempts.length > 0) {
    lines.push('', 'Previous attempts:')
    for (const attempt of context.previousAttempts) {
      lines.push(`  [${attempt.attemptNumber}] ${attempt.stepName} → ${attempt.result}`)
      if (attempt.errorDetails) {
        lines.push(`       Error: ${attempt.errorDetails}`)
      }
    }
  }

  if (context.isLastAttempt) {
    lines.push('', '⚠️  LAST ATTEMPT — if this fails, escalation will occur')
  }

  lines.push('===========================')
  return lines.join('\n')
}

export function clearHistory(taskId: string): void {
  attemptHistory.delete(taskId)
}
