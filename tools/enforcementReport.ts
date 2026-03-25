import { OrchestratorResult, StepResult, Escalation } from '../blueprints/orchestrator';

export interface CheckResult {
  checkName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  details?: {
    message: string;
    issues?: readonly string[];
    missing?: readonly string[];
  };
}

export interface AttemptEntry {
  attemptNumber: number;
  status: 'passed' | 'failed';
  duration: number;
  error?: string;
}

export interface RetryInfo {
  checkName: string;
  totalAttempts: number;
  succeededAtAttempt?: number;
  finalStatus: 'passed' | 'failed';
  attemptHistory: readonly AttemptEntry[];
}

export interface EnvironmentInfo {
  cwd: string;
  gitBranch?: string;
  gitCommit?: string;
}

export interface EscalationInfo {
  reason: string;
  suggestion: string;
  failedCheckName: string;
}

export interface EnforcementReport {
  id: string;
  blueprintName: string;
  taskDescription: string;
  verdict: 'pass' | 'fail';
  checks: readonly CheckResult[];
  retries: readonly RetryInfo[];
  escalation?: EscalationInfo;
  timestamp: string;
  totalDuration: number;
  environment: EnvironmentInfo;
}

export interface CreateReportOptions {
  id: string;
  blueprintName: string;
  taskDescription: string;
  cwd: string;
  gitBranch?: string;
  gitCommit?: string;
}

export function createReport(opts: CreateReportOptions): EnforcementReport {
  return {
    id: opts.id,
    blueprintName: opts.blueprintName,
    taskDescription: opts.taskDescription,
    verdict: 'pass',
    checks: [],
    retries: [],
    escalation: undefined,
    timestamp: new Date().toISOString(),
    totalDuration: 0,
    environment: {
      cwd: opts.cwd,
      gitBranch: opts.gitBranch,
      gitCommit: opts.gitCommit,
    },
  };
}

export function addCheck(report: EnforcementReport, check: CheckResult): EnforcementReport {
  return {
    ...report,
    checks: [...report.checks, check],
  };
}

export function addRetry(report: EnforcementReport, retry: RetryInfo): EnforcementReport {
  return {
    ...report,
    retries: [...report.retries, retry],
  };
}

export function withEscalation(report: EnforcementReport, escalation: EscalationInfo): EnforcementReport {
  return {
    ...report,
    escalation,
    verdict: 'fail',
  };
}

export function finalize(report: EnforcementReport): EnforcementReport {
  // Compute verdict: fail if any check is 'failed', pass otherwise
  const hasFailedCheck = report.checks.some((check) => check.status === 'failed');
  const verdict = hasFailedCheck ? 'fail' : 'pass';

  // Compute totalDuration by summing all check durations
  const totalDuration = report.checks.reduce((sum, check) => sum + check.duration, 0);

  return {
    ...report,
    verdict,
    totalDuration,
  };
}

export function fromOrchestratorResult(result: OrchestratorResult, cwd: string): EnforcementReport {
  let report = createReport({
    id: `${result.blueprintName}-${Date.now()}`,
    blueprintName: result.blueprintName,
    taskDescription: result.escalation?.taskDescription || '',
    cwd,
  });

  // Map completedSteps to checks
  for (const step of result.completedSteps) {
    const check: CheckResult = {
      checkName: step.stepName,
      status: step.status === 'success' ? 'passed' : step.status === 'failed' ? 'failed' : 'skipped',
      duration: step.duration,
    };
    report = addCheck(report, check);
  }

  // Map steps with attemptNumber > 1 to retries
  for (const step of result.completedSteps) {
    if (step.attemptNumber > 1) {
      const retry: RetryInfo = {
        checkName: step.stepName,
        totalAttempts: step.attemptNumber,
        succeededAtAttempt: step.status === 'success' ? step.attemptNumber : undefined,
        finalStatus: step.status === 'success' ? 'passed' : 'failed',
        attemptHistory: [
          {
            attemptNumber: step.attemptNumber,
            status: step.status === 'success' ? 'passed' : 'failed',
            duration: step.duration,
            error: step.error,
          },
        ],
      };
      report = addRetry(report, retry);
    }
  }

  // Map escalation if present
  if (result.escalation) {
    const escalation: EscalationInfo = {
      reason: result.escalation.reason,
      suggestion: result.escalation.suggestion,
      failedCheckName: result.failedStep || '',
    };
    report = withEscalation(report, escalation);
  }

  // Set verdict based on result.success
  if (!result.success) {
    report = {
      ...report,
      verdict: 'fail',
    };
  } else {
    report = finalize(report);
  }

  return report;
}
