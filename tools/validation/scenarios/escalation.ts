import { EnforcementReport } from '../../enforcementReport';
import { ValidationScenario } from '../types';
import { createReport, addCheck, addRetry, withEscalation, finalize } from '../../enforcementReport';

const scenario: ValidationScenario = {
  id: 'escalation',
  description: 'Multiple retries fail and escalate - escalation scenario',
  tags: ['fail', 'retry', 'escalation'],
  buildReport(cwd: string): EnforcementReport {
    let report = createReport({
      id: 'escalation-001',
      blueprintName: 'enforce-standards',
      taskDescription: 'Validate pull request standards',
      cwd,
      gitBranch: 'feature/escalation-test',
      gitCommit: 'jkl012mno345',
    });

    report = addCheck(report, {
      checkName: 'commit-message',
      status: 'passed',
      duration: 12,
    });

    report = addCheck(report, {
      checkName: 'tests-exist',
      status: 'failed',
      duration: 50,
      details: {
        message: 'Test suite timeout',
      },
    });

    report = addRetry(report, {
      checkName: 'tests-exist',
      totalAttempts: 3,
      finalStatus: 'failed',
      attemptHistory: [
        {
          attemptNumber: 1,
          status: 'failed',
          duration: 30000,
          error: 'Timeout: test runner exceeded 30s limit',
        },
        {
          attemptNumber: 2,
          status: 'failed',
          duration: 30000,
          error: 'Timeout: test runner exceeded 30s limit',
        },
        {
          attemptNumber: 3,
          status: 'failed',
          duration: 50,
          error: 'Test suite crashed with exit code 1',
        },
      ],
    });

    report = withEscalation(report, {
      reason: 'tests-exist check failed after 3 retry attempts',
      suggestion: 'Review test suite for resource leaks or infinite loops. Check CI environment for sufficient memory and CPU.',
      failedCheckName: 'tests-exist',
    });

    return finalize(report);
  },
};

export default scenario;
