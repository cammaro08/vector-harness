import { EnforcementReport } from '../../enforcementReport';
import { ValidationScenario } from '../types';
import { createReport, addCheck, addRetry, finalize } from '../../enforcementReport';

const scenario: ValidationScenario = {
  id: 'many-checks',
  description: 'Multiple checks with varied statuses - stress test for rendering',
  tags: ['fail', 'retry', 'stress'],
  buildReport(cwd: string): EnforcementReport {
    let report = createReport({
      id: 'many-checks-001',
      blueprintName: 'enforce-standards',
      taskDescription: 'Validate pull request standards',
      cwd,
      gitBranch: 'feature/comprehensive-check',
      gitCommit: 'pqr678stu901',
    });

    // 6 passing checks
    report = addCheck(report, {
      checkName: 'commit-message',
      status: 'passed',
      duration: 12,
    });

    report = addCheck(report, {
      checkName: 'code-style',
      status: 'passed',
      duration: 145,
    });

    report = addCheck(report, {
      checkName: 'tests-exist',
      status: 'passed',
      duration: 38,
    });

    report = addCheck(report, {
      checkName: 'coverage-threshold',
      status: 'passed',
      duration: 52,
    });

    report = addCheck(report, {
      checkName: 'security-scan',
      status: 'passed',
      duration: 234,
    });

    report = addCheck(report, {
      checkName: 'type-check',
      status: 'passed',
      duration: 87,
    });

    // 1 failing check
    report = addCheck(report, {
      checkName: 'docs-updated',
      status: 'failed',
      duration: 15,
      details: {
        message: 'Documentation out of sync',
        missing: ['docs/API.md'],
        issues: ['Missing endpoint documentation for POST /api/users'],
      },
    });

    // 1 skipped check
    report = addCheck(report, {
      checkName: 'performance-test',
      status: 'skipped',
      duration: 0,
      details: {
        message: 'Skipped: performance tests only run on release branches',
      },
    });

    // Add retries for 2 different checks
    report = addRetry(report, {
      checkName: 'code-style',
      totalAttempts: 2,
      succeededAtAttempt: 2,
      finalStatus: 'passed',
      attemptHistory: [
        {
          attemptNumber: 1,
          status: 'failed',
          duration: 180,
          error: 'Linter service temporarily unavailable',
        },
        {
          attemptNumber: 2,
          status: 'passed',
          duration: 145,
        },
      ],
    });

    report = addRetry(report, {
      checkName: 'security-scan',
      totalAttempts: 2,
      succeededAtAttempt: 2,
      finalStatus: 'passed',
      attemptHistory: [
        {
          attemptNumber: 1,
          status: 'failed',
          duration: 280,
          error: 'Network timeout connecting to vulnerability database',
        },
        {
          attemptNumber: 2,
          status: 'passed',
          duration: 234,
        },
      ],
    });

    return finalize(report);
  },
};

export default scenario;
