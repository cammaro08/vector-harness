import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  writeToTerminal,
  formatReport,
  formatHeader,
  formatChecks,
  formatRetries,
  formatEscalation,
  formatVerdict,
  formatDuration,
  colorize,
} from '../terminalReporter';
import { EnforcementReport, CheckResult, RetryInfo, EscalationInfo } from '../enforcementReport';

describe('terminalReporter', () => {
  let mockReport: EnforcementReport;

  beforeEach(() => {
    mockReport = {
      id: 'test-123',
      blueprintName: 'implement-feature',
      taskDescription: 'Add DELETE /users/:id endpoint',
      verdict: 'pass',
      checks: [],
      retries: [],
      escalation: undefined,
      timestamp: '2026-03-25T10:00:00Z',
      totalDuration: 0,
      environment: {
        cwd: '/test/project',
        gitBranch: 'main',
        gitCommit: 'abc123',
      },
    };
  });

  describe('colorize', () => {
    it('should add ANSI codes when colorEnabled is true', () => {
      const result = colorize('PASS', '\x1b[32m', true);
      expect(result).toContain('\x1b[32m');
      expect(result).toContain('\x1b[0m');
      expect(result).toMatch(/\x1b\[32mPASS\x1b\[0m/);
    });

    it('should return plain text when colorEnabled is false', () => {
      const result = colorize('PASS', '\x1b[32m', false);
      expect(result).toBe('PASS');
      expect(result).not.toContain('\x1b');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds for values < 1000ms', () => {
      expect(formatDuration(0)).toBe('0ms');
      expect(formatDuration(12)).toBe('12ms');
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('should format seconds for values >= 1000ms', () => {
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(1200)).toBe('1.2s');
      expect(formatDuration(5000)).toBe('5.0s');
    });

    it('should format minutes and seconds for values >= 60000ms', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(65000)).toBe('1m 5s');
      expect(formatDuration(123000)).toBe('2m 3s');
      expect(formatDuration(3661000)).toBe('61m 1s');
    });
  });

  describe('formatHeader', () => {
    it('should include blueprint name and task description', () => {
      const result = formatHeader(mockReport);
      expect(result).toContain('implement-feature');
      expect(result).toContain('Add DELETE /users/:id endpoint');
    });

    it('should format header with Blueprint and Task labels', () => {
      const result = formatHeader(mockReport);
      expect(result).toMatch(/Blueprint:\s+implement-feature/);
      expect(result).toMatch(/Task:\s+Add DELETE \/users\/:id endpoint/);
    });
  });

  describe('formatChecks', () => {
    it('should format all passed checks without details section', () => {
      const checks: CheckResult[] = [
        { checkName: 'commit-message', status: 'passed', duration: 12 },
        { checkName: 'docs-updated', status: 'passed', duration: 8 },
      ];
      mockReport.checks = checks;

      const result = formatChecks(checks, false);
      expect(result).toContain('[PASS]');
      expect(result).toContain('commit-message');
      expect(result).toContain('docs-updated');
      expect(result).toContain('12ms');
      expect(result).toContain('8ms');
    });

    it('should format failed checks with details', () => {
      const checks: CheckResult[] = [
        {
          checkName: 'tests-exist',
          status: 'failed',
          duration: 45,
          details: {
            message: 'Missing test file',
            missing: ['user-endpoints.test.ts'],
          },
        },
      ];

      const result = formatChecks(checks, false);
      expect(result).toContain('[FAIL]');
      expect(result).toContain('tests-exist');
      expect(result).toContain('Missing test file');
      expect(result).toContain('user-endpoints.test.ts');
    });

    it('should include dot leaders between check name and duration', () => {
      const checks: CheckResult[] = [
        { checkName: 'short', status: 'passed', duration: 10 },
        { checkName: 'very-long-check-name-here', status: 'passed', duration: 20 },
      ];

      const result = formatChecks(checks, false);
      expect(result).toMatch(/short\s+\.+\s+10ms/);
      expect(result).toMatch(/very-long-check-name-here\s+\.+\s+20ms/);
    });

    it('should apply colors when colorEnabled is true', () => {
      const checks: CheckResult[] = [
        { checkName: 'commit-message', status: 'passed', duration: 12 },
        {
          checkName: 'tests-exist',
          status: 'failed',
          duration: 45,
          details: { message: 'Failed test' },
        },
      ];

      const result = formatChecks(checks, true);
      expect(result).toContain('\x1b[');
    });

    it('should handle skipped checks', () => {
      const checks: CheckResult[] = [
        { checkName: 'optional-check', status: 'skipped', duration: 0 },
      ];

      const result = formatChecks(checks, false);
      expect(result).toContain('optional-check');
    });

    it('should handle details with multiple missing items', () => {
      const checks: CheckResult[] = [
        {
          checkName: 'files-complete',
          status: 'failed',
          duration: 30,
          details: {
            message: 'Missing files',
            missing: ['file1.ts', 'file2.ts', 'file3.ts'],
          },
        },
      ];

      const result = formatChecks(checks, false);
      expect(result).toContain('file1.ts');
      expect(result).toContain('file2.ts');
      expect(result).toContain('file3.ts');
    });

    it('should handle details with issues array', () => {
      const checks: CheckResult[] = [
        {
          checkName: 'code-quality',
          status: 'failed',
          duration: 50,
          details: {
            message: 'Code quality issues',
            issues: ['Line 10: too complex', 'Line 25: unused variable'],
          },
        },
      ];

      const result = formatChecks(checks, false);
      expect(result).toContain('Line 10: too complex');
      expect(result).toContain('Line 25: unused variable');
    });
  });

  describe('formatRetries', () => {
    it('should return empty string when no retries', () => {
      const result = formatRetries([], false);
      expect(result).toBe('');
    });

    it('should format retry timeline with multiple attempts', () => {
      const retries: RetryInfo[] = [
        {
          checkName: 'tests-exist',
          totalAttempts: 2,
          succeededAtAttempt: 2,
          finalStatus: 'passed',
          attemptHistory: [
            { attemptNumber: 1, status: 'failed', duration: 45, error: 'Missing test file' },
            { attemptNumber: 2, status: 'passed', duration: 38 },
          ],
        },
      ];

      const result = formatRetries(retries, false);
      expect(result).toContain('RETRIES');
      expect(result).toContain('tests-exist');
      expect(result).toContain('2 attempts');
      expect(result).toContain('succeeded at attempt 2');
      expect(result).toContain('#1 FAIL');
      expect(result).toContain('#2 PASS');
      expect(result).toContain('45ms');
      expect(result).toContain('38ms');
    });

    it('should include error message for failed attempts', () => {
      const retries: RetryInfo[] = [
        {
          checkName: 'build-check',
          totalAttempts: 3,
          finalStatus: 'failed',
          attemptHistory: [
            { attemptNumber: 1, status: 'failed', duration: 100, error: 'Syntax error' },
            { attemptNumber: 2, status: 'failed', duration: 110, error: 'Still broken' },
            { attemptNumber: 3, status: 'failed', duration: 120 },
          ],
        },
      ];

      const result = formatRetries(retries, false);
      expect(result).toContain('Syntax error');
      expect(result).toContain('Still broken');
    });

    it('should apply colors when colorEnabled is true', () => {
      const retries: RetryInfo[] = [
        {
          checkName: 'test-check',
          totalAttempts: 2,
          succeededAtAttempt: 2,
          finalStatus: 'passed',
          attemptHistory: [
            { attemptNumber: 1, status: 'failed', duration: 50 },
            { attemptNumber: 2, status: 'passed', duration: 40 },
          ],
        },
      ];

      const result = formatRetries(retries, true);
      expect(result).toContain('\x1b[');
    });

    it('should handle multiple retry entries', () => {
      const retries: RetryInfo[] = [
        {
          checkName: 'first-check',
          totalAttempts: 2,
          succeededAtAttempt: 2,
          finalStatus: 'passed',
          attemptHistory: [
            { attemptNumber: 1, status: 'failed', duration: 30 },
            { attemptNumber: 2, status: 'passed', duration: 25 },
          ],
        },
        {
          checkName: 'second-check',
          totalAttempts: 2,
          succeededAtAttempt: 2,
          finalStatus: 'passed',
          attemptHistory: [
            { attemptNumber: 1, status: 'failed', duration: 40 },
            { attemptNumber: 2, status: 'passed', duration: 35 },
          ],
        },
      ];

      const result = formatRetries(retries, false);
      expect(result).toContain('first-check');
      expect(result).toContain('second-check');
    });
  });

  describe('formatEscalation', () => {
    it('should return empty string when no escalation', () => {
      const result = formatEscalation(undefined, false);
      expect(result).toBe('');
    });

    it('should format escalation reason and suggestion', () => {
      const escalation: EscalationInfo = {
        reason: 'Tests are failing in production',
        suggestion: 'Review test mocks and integration points',
        failedCheckName: 'tests-exist',
      };

      const result = formatEscalation(escalation, false);
      expect(result).toContain('ESCALATION');
      expect(result).toContain('Tests are failing in production');
      expect(result).toContain('Review test mocks and integration points');
    });

    it('should apply colors when colorEnabled is true', () => {
      const escalation: EscalationInfo = {
        reason: 'Test failure',
        suggestion: 'Fix the tests',
        failedCheckName: 'tests',
      };

      const result = formatEscalation(escalation, true);
      expect(result).toContain('\x1b[');
    });
  });

  describe('formatVerdict', () => {
    it('should format passing verdict with check count', () => {
      mockReport.checks = [
        { checkName: 'check1', status: 'passed', duration: 10 },
        { checkName: 'check2', status: 'passed', duration: 20 },
        { checkName: 'check3', status: 'passed', duration: 30 },
      ];
      mockReport.verdict = 'pass';
      mockReport.totalDuration = 60;

      const result = formatVerdict(mockReport, false);
      expect(result).toContain('PASS');
      expect(result).toContain('3 checks');
      expect(result).toContain('60ms');
    });

    it('should format failing verdict with check count', () => {
      mockReport.checks = [
        { checkName: 'check1', status: 'passed', duration: 10 },
        { checkName: 'check2', status: 'failed', duration: 20 },
      ];
      mockReport.verdict = 'fail';
      mockReport.totalDuration = 30;

      const result = formatVerdict(mockReport, false);
      expect(result).toContain('FAIL');
      expect(result).toContain('2 checks');
    });

    it('should include retry count when retries exist', () => {
      mockReport.checks = [{ checkName: 'test', status: 'passed', duration: 50 }];
      mockReport.retries = [
        {
          checkName: 'test',
          totalAttempts: 2,
          succeededAtAttempt: 2,
          finalStatus: 'passed',
          attemptHistory: [
            { attemptNumber: 1, status: 'failed', duration: 30 },
            { attemptNumber: 2, status: 'passed', duration: 20 },
          ],
        },
      ];
      mockReport.verdict = 'pass';
      mockReport.totalDuration = 70;

      const result = formatVerdict(mockReport, false);
      expect(result).toContain('1 retry');
    });

    it('should format duration in verdict', () => {
      mockReport.checks = [{ checkName: 'test', status: 'passed', duration: 65000 }];
      mockReport.verdict = 'pass';
      mockReport.totalDuration = 65000;

      const result = formatVerdict(mockReport, false);
      expect(result).toContain('1m 5s');
    });

    it('should apply colors when colorEnabled is true', () => {
      mockReport.checks = [{ checkName: 'test', status: 'passed', duration: 10 }];
      mockReport.verdict = 'pass';
      mockReport.totalDuration = 10;

      const result = formatVerdict(mockReport, true);
      expect(result).toContain('\x1b[');
    });
  });

  describe('formatReport', () => {
    it('should format complete report with all sections', () => {
      mockReport.checks = [
        { checkName: 'commit-message', status: 'passed', duration: 12 },
        { checkName: 'tests-exist', status: 'failed', duration: 45, details: { message: 'Missing test' } },
        { checkName: 'docs-updated', status: 'passed', duration: 8 },
      ];
      mockReport.totalDuration = 65;
      mockReport.verdict = 'pass';

      const result = formatReport(mockReport, { color: false });
      expect(result).toContain('implement-feature');
      expect(result).toContain('Add DELETE /users/:id endpoint');
      expect(result).toContain('commit-message');
      expect(result).toContain('tests-exist');
      expect(result).toContain('docs-updated');
      expect(result).toContain('PASS');
    });

    it('should include retries section when retries exist', () => {
      mockReport.checks = [{ checkName: 'test', status: 'passed', duration: 30 }];
      mockReport.retries = [
        {
          checkName: 'test',
          totalAttempts: 2,
          succeededAtAttempt: 2,
          finalStatus: 'passed',
          attemptHistory: [
            { attemptNumber: 1, status: 'failed', duration: 20 },
            { attemptNumber: 2, status: 'passed', duration: 10 },
          ],
        },
      ];
      mockReport.verdict = 'pass';
      mockReport.totalDuration = 50;

      const result = formatReport(mockReport, { color: false });
      expect(result).toContain('RETRIES');
    });

    it('should include escalation section when escalation exists', () => {
      mockReport.checks = [
        { checkName: 'test', status: 'failed', duration: 30, details: { message: 'Test failed' } },
      ];
      mockReport.escalation = {
        reason: 'Critical test failure',
        suggestion: 'Review test implementation',
        failedCheckName: 'test',
      };
      mockReport.verdict = 'fail';
      mockReport.totalDuration = 30;

      const result = formatReport(mockReport, { color: false });
      expect(result).toContain('ESCALATION');
      expect(result).toContain('Critical test failure');
    });

    it('should apply colors when color option is true', () => {
      mockReport.checks = [{ checkName: 'test', status: 'passed', duration: 10 }];
      mockReport.verdict = 'pass';
      mockReport.totalDuration = 10;

      const result = formatReport(mockReport, { color: true });
      expect(result).toContain('\x1b[');
    });

    it('should include decorative lines at top and bottom', () => {
      mockReport.checks = [{ checkName: 'test', status: 'passed', duration: 10 }];
      mockReport.verdict = 'pass';
      mockReport.totalDuration = 10;

      const result = formatReport(mockReport, { color: false });
      expect(result).toMatch(/━+/);
    });

    it('should not include empty retries or escalation sections', () => {
      mockReport.checks = [{ checkName: 'test', status: 'passed', duration: 10 }];
      mockReport.retries = [];
      mockReport.escalation = undefined;
      mockReport.verdict = 'pass';
      mockReport.totalDuration = 10;

      const result = formatReport(mockReport, { color: false });
      expect(result).not.toContain('RETRIES');
      expect(result).not.toContain('ESCALATION');
    });
  });

  describe('writeToTerminal', () => {
    let stdoutSpy: any;

    beforeEach(() => {
      stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
    });

    it('should detect TTY and format with colors', () => {
      const originalIsTTY = process.stdout.isTTY;
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
      });

      mockReport.checks = [{ checkName: 'test', status: 'passed', duration: 10 }];
      mockReport.verdict = 'pass';
      mockReport.totalDuration = 10;

      writeToTerminal(mockReport);

      const output = stdoutSpy.mock.calls[0]?.[0] || '';
      expect(output).toContain('implement-feature');

      Object.defineProperty(process.stdout, 'isTTY', {
        value: originalIsTTY,
        writable: true,
      });
    });

    it('should format without colors for non-TTY output', () => {
      const originalIsTTY = process.stdout.isTTY;
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        writable: true,
      });

      mockReport.checks = [{ checkName: 'test', status: 'passed', duration: 10 }];
      mockReport.verdict = 'pass';
      mockReport.totalDuration = 10;

      writeToTerminal(mockReport);

      const output = stdoutSpy.mock.calls[0]?.[0] || '';
      expect(output).toContain('implement-feature');
      expect(output).not.toContain('\x1b[');

      Object.defineProperty(process.stdout, 'isTTY', {
        value: originalIsTTY,
        writable: true,
      });
    });

    it('should write to stdout', () => {
      mockReport.checks = [{ checkName: 'test', status: 'passed', duration: 10 }];
      mockReport.verdict = 'pass';
      mockReport.totalDuration = 10;

      writeToTerminal(mockReport);

      expect(stdoutSpy).toHaveBeenCalled();
    });
  });
});
