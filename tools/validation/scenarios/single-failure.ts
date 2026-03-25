import { EnforcementReport } from '../../enforcementReport';
import { ValidationScenario } from '../types';
import { createReport, addCheck, finalize } from '../../enforcementReport';

const scenario: ValidationScenario = {
  id: 'single-failure',
  description: 'Single failing check - basic failure scenario',
  tags: ['fail'],
  buildReport(cwd: string): EnforcementReport {
    let report = createReport({
      id: 'single-failure-001',
      blueprintName: 'enforce-standards',
      taskDescription: 'Validate pull request standards',
      cwd,
      gitBranch: 'feature/new-feature',
      gitCommit: 'def456ghi789',
    });

    report = addCheck(report, {
      checkName: 'commit-message',
      status: 'passed',
      duration: 12,
    });

    report = addCheck(report, {
      checkName: 'tests-exist',
      status: 'failed',
      duration: 45,
      details: {
        message: 'Test file not found',
        missing: ['tests/new-feature.test.ts'],
      },
    });

    report = addCheck(report, {
      checkName: 'docs-updated',
      status: 'passed',
      duration: 8,
    });

    return finalize(report);
  },
};

export default scenario;
