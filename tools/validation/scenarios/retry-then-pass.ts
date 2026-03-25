import { EnforcementReport } from '../../enforcementReport';
import { ValidationScenario } from '../types';
import { createReport, addCheck, addRetry, finalize } from '../../enforcementReport';

const scenario: ValidationScenario = {
  id: 'retry-then-pass',
  description: 'Check passes after retry - demonstrates resilience',
  tags: ['pass', 'retry'],
  buildReport(cwd: string): EnforcementReport {
    let report = createReport({
      id: 'retry-then-pass-001',
      blueprintName: 'enforce-standards',
      taskDescription: 'Validate pull request standards',
      cwd,
      gitBranch: 'feature/retry-demo',
      gitCommit: 'ghi789jkl012',
    });

    report = addCheck(report, {
      checkName: 'commit-message',
      status: 'passed',
      duration: 12,
    });

    report = addCheck(report, {
      checkName: 'tests-exist',
      status: 'passed',
      duration: 38,
    });

    report = addCheck(report, {
      checkName: 'docs-updated',
      status: 'passed',
      duration: 8,
    });

    report = addRetry(report, {
      checkName: 'tests-exist',
      totalAttempts: 2,
      succeededAtAttempt: 2,
      finalStatus: 'passed',
      attemptHistory: [
        {
          attemptNumber: 1,
          status: 'failed',
          duration: 45,
          error: 'Timeout waiting for test runner',
        },
        {
          attemptNumber: 2,
          status: 'passed',
          duration: 38,
        },
      ],
    });

    return finalize(report);
  },
};

export default scenario;
