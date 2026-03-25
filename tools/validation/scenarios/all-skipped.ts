import { EnforcementReport } from '../../enforcementReport';
import { ValidationScenario } from '../types';
import { createReport, addCheck, finalize } from '../../enforcementReport';

const scenario: ValidationScenario = {
  id: 'all-skipped',
  description: 'All checks skipped - edge case with no pass/fail checks',
  tags: ['pass', 'edge-case'],
  buildReport(cwd: string): EnforcementReport {
    let report = createReport({
      id: 'all-skipped-001',
      blueprintName: 'enforce-standards',
      taskDescription: 'Validate pull request standards',
      cwd,
      gitBranch: 'main',
      gitCommit: 'mno345pqr678',
    });

    report = addCheck(report, {
      checkName: 'tests-exist',
      status: 'skipped',
      duration: 0,
      details: {
        message: 'Skipped: no test files in changeset',
      },
    });

    report = addCheck(report, {
      checkName: 'docs-updated',
      status: 'skipped',
      duration: 0,
      details: {
        message: 'Skipped: documentation not applicable for this change',
      },
    });

    return finalize(report);
  },
};

export default scenario;
