import type { CheckDefinition, VectorName } from '../config/schema';
import type {
  CheckResult,
  AttemptEntry,
  EnforcementReport,
  EnvironmentInfo,
} from './types';
import {
  createReport,
  addCheck,
  addRetry,
  withEscalation,
  finalize,
} from './types';
import { runCheck } from './runner';

export interface EngineOptions {
  vectorName: VectorName | string;
  checks: Array<{ name: string; definition: CheckDefinition }>;
  maxRetries: number;
  timeout: number; // ms
  environment: EnvironmentInfo;
}

/**
 * Run a vector (collection of checks) and produce an EnforcementReport.
 *
 * - Executes all checks sequentially
 * - On failure: retries up to maxRetries times
 * - Tracks attempt history for retries
 * - Produces EnforcementReport with retry and escalation info
 *
 * @param options Configuration for running the vector
 * @returns EnforcementReport with all results and metadata
 */
export async function runVector(options: EngineOptions): Promise<EnforcementReport> {
  const { vectorName, checks, maxRetries, timeout, environment } = options;

  // Create initial report
  let report = createReport({
    id: `${vectorName}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    blueprintName: vectorName as string,
    taskDescription: `Running vector ${vectorName}`,
    cwd: environment.cwd,
    gitBranch: environment.gitBranch,
    gitCommit: environment.gitCommit,
  });

  // Run each check with retry logic
  for (const { name, definition } of checks) {
    let lastResult: CheckResult | null = null;
    const attemptHistory: AttemptEntry[] = [];
    let succeededAtAttempt: number | undefined;

    // Initial attempt + up to maxRetries retries = totalAttempts
    const totalAttempts = 1 + maxRetries;

    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      const runResult = await runCheck({
        name,
        definition,
        timeout,
      });

      const { checkResult, stdout, stderr } = runResult;
      lastResult = checkResult;

      // Enrich with captured output if available
      if (stdout || stderr) {
        lastResult = {
          ...checkResult,
          details: {
            ...(checkResult.details || {}),
            message: `${checkResult.details?.message || checkResult.status}${
              stdout ? `\nStdout: ${stdout}` : ''
            }${stderr ? `\nStderr: ${stderr}` : ''}`,
          },
        };
      }

      // Track attempt
      attemptHistory.push({
        attemptNumber: attempt,
        status: checkResult.status,
        duration: checkResult.duration,
        error: checkResult.status === 'failed' ? checkResult.details?.message : undefined,
      });

      // If passed, break early
      if (checkResult.status === 'passed') {
        succeededAtAttempt = attempt;
        break;
      }

      // If last attempt failed, don't retry
      if (attempt === totalAttempts) {
        break;
      }
    }

    // Add check to report
    if (lastResult) {
      report = addCheck(report, lastResult);

      // If check was retried, add retry info
      if (attemptHistory.length > 1 || (lastResult.status === 'failed' && maxRetries > 0)) {
        report = addRetry(report, {
          checkName: name,
          totalAttempts: attemptHistory.length,
          succeededAtAttempt,
          finalStatus: lastResult.status,
          attemptHistory: attemptHistory,
        });

        // If exhausted all retries and still failed, add escalation
        if (lastResult.status === 'failed' && attemptHistory.length === totalAttempts) {
          report = withEscalation(report, {
            reason: `Check '${name}' failed after ${attemptHistory.length} attempts`,
            suggestion: `Review the check configuration or the underlying command: ${definition.run}`,
            failedCheckName: name,
          });
        }
      }
    }
  }

  // Finalize report (compute verdict and totalDuration)
  report = finalize(report);

  return report;
}
