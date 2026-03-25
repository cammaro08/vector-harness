import { EnforcementReport } from '../../enforcementReport';
import { ValidationScenario } from '../types';
import { createReport, addCheck, finalize } from '../../enforcementReport';

const scenario: ValidationScenario = {
  id: 'all-pass',
  description: 'All checks passing - basic happy path scenario',
  tags: ['pass', 'basic'],
  buildReport(cwd: string): EnforcementReport {
    let report = createReport({
      id: 'all-pass-001',
      blueprintName: 'enforce-standards',
      taskDescription: 'Validate pull request standards',
      cwd,
      gitBranch: 'main',
      gitCommit: 'abc123def456',
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

    return finalize(report);
  },
};

export default scenario;
