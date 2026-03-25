import { OrchestratorResult, StepResult } from '../../blueprints/orchestrator';
import {
  CheckResult,
  RetryInfo,
  EnforcementReport,
  createReport,
  addCheck,
  addRetry,
  withEscalation,
  finalize,
  fromOrchestratorResult,
} from '../enforcementReport';

describe('EnforcementReport', () => {
  describe('createReport', () => {
    it('should create a report with default metadata', () => {
      const opts = {
        id: 'test-123',
        blueprintName: 'TestBlueprint',
        taskDescription: 'Test task',
        cwd: '/test/path',
      };

      const report = createReport(opts);

      expect(report.id).toBe('test-123');
      expect(report.blueprintName).toBe('TestBlueprint');
      expect(report.taskDescription).toBe('Test task');
      expect(report.verdict).toBe('pass');
      expect(report.checks).toEqual([]);
      expect(report.retries).toEqual([]);
      expect(report.escalation).toBeUndefined();
      expect(report.environment.cwd).toBe('/test/path');
      expect(typeof report.timestamp).toBe('string');
      // Verify ISO format
      expect(() => new Date(report.timestamp)).not.toThrow();
    });

    it('should include optional environment fields', () => {
      const opts = {
        id: 'test-456',
        blueprintName: 'Blueprint2',
        taskDescription: 'Another task',
        cwd: '/another/path',
        gitBranch: 'main',
        gitCommit: 'abc123def456',
      };

      const report = createReport(opts);

      expect(report.environment.gitBranch).toBe('main');
      expect(report.environment.gitCommit).toBe('abc123def456');
    });
  });

  describe('addCheck', () => {
    it('should append check to report immutably', () => {
      const report = createReport({
        id: 'test-1',
        blueprintName: 'BP1',
        taskDescription: 'Task1',
        cwd: '/path1',
      });

      const check: CheckResult = {
        checkName: 'check-1',
        status: 'passed',
        duration: 100,
      };

      const newReport = addCheck(report, check);

      expect(newReport.checks).toHaveLength(1);
      expect(newReport.checks[0]).toEqual(check);
      expect(report.checks).toHaveLength(0);
      expect(report).not.toBe(newReport);
    });

    it('should not share array references between original and new report', () => {
      const report = createReport({
        id: 'test-2',
        blueprintName: 'BP2',
        taskDescription: 'Task2',
        cwd: '/path2',
      });

      const check1: CheckResult = {
        checkName: 'check-1',
        status: 'passed',
        duration: 50,
      };

      const report2 = addCheck(report, check1);
      const check2: CheckResult = {
        checkName: 'check-2',
        status: 'failed',
        duration: 75,
      };

      const report3 = addCheck(report2, check2);

      expect(report.checks).toHaveLength(0);
      expect(report2.checks).toHaveLength(1);
      expect(report3.checks).toHaveLength(2);
    });

    it('should preserve check details including optional fields', () => {
      const report = createReport({
        id: 'test-3',
        blueprintName: 'BP3',
        taskDescription: 'Task3',
        cwd: '/path3',
      });

      const checkWithDetails: CheckResult = {
        checkName: 'detailed-check',
        status: 'failed',
        duration: 200,
        details: {
          message: 'Test failed',
          issues: ['issue1', 'issue2'],
          missing: ['file1.ts'],
        },
      };

      const newReport = addCheck(report, checkWithDetails);

      expect(newReport.checks[0].details).toEqual({
        message: 'Test failed',
        issues: ['issue1', 'issue2'],
        missing: ['file1.ts'],
      });
    });
  });

  describe('addRetry', () => {
    it('should append retry to report immutably', () => {
      const report = createReport({
        id: 'test-4',
        blueprintName: 'BP4',
        taskDescription: 'Task4',
        cwd: '/path4',
      });

      const retry: RetryInfo = {
        checkName: 'flaky-check',
        totalAttempts: 3,
        succeededAtAttempt: 2,
        finalStatus: 'passed',
        attemptHistory: [
          { attemptNumber: 1, status: 'failed', error: 'timeout', duration: 100 },
          { attemptNumber: 2, status: 'passed', duration: 110 },
        ],
      };

      const newReport = addRetry(report, retry);

      expect(newReport.retries).toHaveLength(1);
      expect(newReport.retries[0]).toEqual(retry);
      expect(report.retries).toHaveLength(0);
    });

    it('should not share array references for retries', () => {
      const report = createReport({
        id: 'test-5',
        blueprintName: 'BP5',
        taskDescription: 'Task5',
        cwd: '/path5',
      });

      const retry1: RetryInfo = {
        checkName: 'check-1',
        totalAttempts: 2,
        finalStatus: 'passed',
        attemptHistory: [{ attemptNumber: 1, status: 'failed', duration: 50 }],
      };

      const report2 = addRetry(report, retry1);
      const retry2: RetryInfo = {
        checkName: 'check-2',
        totalAttempts: 1,
        finalStatus: 'passed',
        attemptHistory: [{ attemptNumber: 1, status: 'passed', duration: 60 }],
      };

      const report3 = addRetry(report2, retry2);

      expect(report.retries).toHaveLength(0);
      expect(report2.retries).toHaveLength(1);
      expect(report3.retries).toHaveLength(2);
    });
  });

  describe('withEscalation', () => {
    it('should set escalation and force verdict to fail', () => {
      const report = createReport({
        id: 'test-6',
        blueprintName: 'BP6',
        taskDescription: 'Task6',
        cwd: '/path6',
      });

      const escalation = {
        reason: 'Critical failure detected',
        suggestion: 'Manual review required',
        failedCheckName: 'security-check',
      };

      const newReport = withEscalation(report, escalation);

      expect(newReport.escalation).toEqual(escalation);
      expect(newReport.verdict).toBe('fail');
      expect(report.escalation).toBeUndefined();
      expect(report.verdict).toBe('pass');
    });

    it('should preserve escalation immutably', () => {
      const report = createReport({
        id: 'test-7',
        blueprintName: 'BP7',
        taskDescription: 'Task7',
        cwd: '/path7',
      });

      const esc1 = {
        reason: 'First failure',
        suggestion: 'Fix it',
        failedCheckName: 'check-1',
      };

      const report2 = withEscalation(report, esc1);

      expect(report2).not.toBe(report);
      expect(report.escalation).toBeUndefined();
    });
  });

  describe('finalize', () => {
    it('should set verdict to pass when all checks pass', () => {
      let report = createReport({
        id: 'test-8',
        blueprintName: 'BP8',
        taskDescription: 'Task8',
        cwd: '/path8',
      });

      report = addCheck(report, {
        checkName: 'check-1',
        status: 'passed',
        duration: 100,
      });

      report = addCheck(report, {
        checkName: 'check-2',
        status: 'passed',
        duration: 150,
      });

      const finalized = finalize(report);

      expect(finalized.verdict).toBe('pass');
    });

    it('should set verdict to fail when any check fails', () => {
      let report = createReport({
        id: 'test-9',
        blueprintName: 'BP9',
        taskDescription: 'Task9',
        cwd: '/path9',
      });

      report = addCheck(report, {
        checkName: 'check-1',
        status: 'passed',
        duration: 100,
      });

      report = addCheck(report, {
        checkName: 'check-2',
        status: 'failed',
        duration: 150,
      });

      const finalized = finalize(report);

      expect(finalized.verdict).toBe('fail');
    });

    it('should compute totalDuration from check durations', () => {
      let report = createReport({
        id: 'test-10',
        blueprintName: 'BP10',
        taskDescription: 'Task10',
        cwd: '/path10',
      });

      report = addCheck(report, {
        checkName: 'check-1',
        status: 'passed',
        duration: 100,
      });

      report = addCheck(report, {
        checkName: 'check-2',
        status: 'passed',
        duration: 250,
      });

      const finalized = finalize(report);

      expect(finalized.totalDuration).toBe(350);
    });

    it('should handle empty checks array', () => {
      const report = createReport({
        id: 'test-11',
        blueprintName: 'BP11',
        taskDescription: 'Task11',
        cwd: '/path11',
      });

      const finalized = finalize(report);

      expect(finalized.verdict).toBe('pass');
      expect(finalized.totalDuration).toBe(0);
    });

    it('should handle skipped checks (not counted as failures)', () => {
      let report = createReport({
        id: 'test-12',
        blueprintName: 'BP12',
        taskDescription: 'Task12',
        cwd: '/path12',
      });

      report = addCheck(report, {
        checkName: 'check-1',
        status: 'passed',
        duration: 50,
      });

      report = addCheck(report, {
        checkName: 'check-2',
        status: 'skipped',
        duration: 0,
      });

      const finalized = finalize(report);

      expect(finalized.verdict).toBe('pass');
    });
  });

  describe('fromOrchestratorResult', () => {
    it('should map successful orchestrator result', () => {
      const result: OrchestratorResult = {
        blueprintName: 'implement-feature',
        success: true,
        completedSteps: [
          { stepName: 'commit-check', type: 'deterministic', status: 'success', attemptNumber: 1, duration: 100 },
          { stepName: 'test-check', type: 'deterministic', status: 'success', attemptNumber: 1, duration: 200 },
        ],
        totalDuration: 300,
      };

      const report = fromOrchestratorResult(result, '/test/cwd');

      expect(report.verdict).toBe('pass');
      expect(report.blueprintName).toBe('implement-feature');
      expect(report.checks).toHaveLength(2);
      expect(report.checks[0].checkName).toBe('commit-check');
      expect(report.checks[0].status).toBe('passed');
      expect(report.environment.cwd).toBe('/test/cwd');
    });

    it('should map failed orchestrator result with escalation', () => {
      const result: OrchestratorResult = {
        blueprintName: 'implement-feature',
        success: false,
        completedSteps: [
          { stepName: 'test-check', type: 'deterministic', status: 'failed', attemptNumber: 2, duration: 100, error: 'Tests missing' },
        ],
        failedStep: 'test-check',
        escalation: {
          reason: 'Step test-check failed after 2 attempts',
          taskDescription: 'Add DELETE endpoint',
          attemptHistory: [
            { stepName: 'test-check', type: 'deterministic', status: 'failed', attemptNumber: 1, duration: 50, error: 'Tests missing' },
            { stepName: 'test-check', type: 'deterministic', status: 'failed', attemptNumber: 2, duration: 100, error: 'Tests missing' },
          ],
          suggestion: 'Review and fix test-check',
        },
        totalDuration: 150,
      };

      const report = fromOrchestratorResult(result, '/test/cwd');

      expect(report.verdict).toBe('fail');
      expect(report.escalation).toBeDefined();
      expect(report.escalation?.reason).toBe('Step test-check failed after 2 attempts');
      expect(report.escalation?.failedCheckName).toBe('test-check');
    });

    it('should map retries from steps with attemptNumber > 1', () => {
      const result: OrchestratorResult = {
        blueprintName: 'implement-feature',
        success: true,
        completedSteps: [
          { stepName: 'flaky-check', type: 'agent', status: 'success', attemptNumber: 3, duration: 100 },
        ],
        totalDuration: 100,
      };

      const report = fromOrchestratorResult(result, '/test/cwd');

      expect(report.retries).toHaveLength(1);
      expect(report.retries[0].checkName).toBe('flaky-check');
      expect(report.retries[0].totalAttempts).toBe(3);
      expect(report.retries[0].succeededAtAttempt).toBe(3);
    });

    it('should handle empty completedSteps array', () => {
      const result: OrchestratorResult = {
        blueprintName: 'empty-blueprint',
        success: true,
        completedSteps: [],
        totalDuration: 0,
      };

      const report = fromOrchestratorResult(result, '/test/cwd');

      expect(report.checks).toHaveLength(0);
      expect(report.retries).toHaveLength(0);
    });

    it('should preserve immutability when building from orchestrator result', () => {
      const result: OrchestratorResult = {
        blueprintName: 'bp',
        success: true,
        completedSteps: [
          { stepName: 's1', type: 'deterministic', status: 'success', attemptNumber: 1, duration: 50 },
        ],
        totalDuration: 50,
      };

      const report1 = fromOrchestratorResult(result, '/path1');
      const report2 = fromOrchestratorResult(result, '/path2');

      expect(report1).not.toBe(report2);
      expect(report1.checks).not.toBe(report2.checks);
      expect(report1.environment.cwd).toBe('/path1');
      expect(report2.environment.cwd).toBe('/path2');
    });
  });

  describe('Edge cases', () => {
    it('should handle check without details field', () => {
      const report = createReport({
        id: 'test-13',
        blueprintName: 'BP13',
        taskDescription: 'Task13',
        cwd: '/path13',
      });

      const check: CheckResult = {
        checkName: 'simple-check',
        status: 'passed',
        duration: 100,
      };

      const newReport = addCheck(report, check);

      expect(newReport.checks[0].details).toBeUndefined();
    });

    it('should handle retry without succeededAtAttempt', () => {
      const report = createReport({
        id: 'test-14',
        blueprintName: 'BP14',
        taskDescription: 'Task14',
        cwd: '/path14',
      });

      const retry: RetryInfo = {
        checkName: 'flaky-check',
        totalAttempts: 3,
        finalStatus: 'failed',
        attemptHistory: [
          { attemptNumber: 1, status: 'failed', duration: 100, error: 'timeout' },
          { attemptNumber: 2, status: 'failed', duration: 110, error: 'timeout' },
        ],
      };

      const newReport = addRetry(report, retry);

      expect(newReport.retries[0].succeededAtAttempt).toBeUndefined();
    });

    it('should allow undefined escalation initially', () => {
      const report = createReport({
        id: 'test-15',
        blueprintName: 'BP15',
        taskDescription: 'Task15',
        cwd: '/path15',
      });

      expect(report.escalation).toBeUndefined();
    });
  });
});
