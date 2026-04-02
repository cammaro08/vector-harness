import { describe, it, expect, beforeEach } from 'vitest';
import { runVector } from '../engine';
import type { CheckDefinition } from '../../config/schema';
import type { EnforcementReport } from '../types';

describe('runVector', () => {
  describe('single passing check', () => {
    it('should produce passing verdict when all checks pass', async () => {
      const checks = [
        {
          name: 'check-1',
          definition: {
            run: 'exit 0',
            expect: 'exit-0' as const,
            enabled: true,
          } as CheckDefinition,
        },
      ];

      const report = await runVector({
        vectorName: 'v1',
        checks,
        maxRetries: 3,
        timeout: 5000,
        environment: {
          cwd: process.cwd(),
        },
      });

      expect(report.verdict).toBe('pass');
      expect(report.checks).toHaveLength(1);
      expect(report.checks[0].status).toBe('passed');
      expect(report.checks[0].checkName).toBe('check-1');
    });
  });

  describe('single failing check', () => {
    it('should produce failing verdict when a check fails', async () => {
      const checks = [
        {
          name: 'failing-check',
          definition: {
            run: 'exit 1',
            expect: 'exit-0' as const,
            enabled: true,
          } as CheckDefinition,
        },
      ];

      const report = await runVector({
        vectorName: 'v1',
        checks,
        maxRetries: 0,
        timeout: 5000,
        environment: {
          cwd: process.cwd(),
        },
      });

      expect(report.verdict).toBe('fail');
      expect(report.checks[0].status).toBe('failed');
    });
  });

  describe('multiple checks', () => {
    it('should run all checks sequentially', async () => {
      const checks = [
        {
          name: 'check-1',
          definition: {
            run: 'exit 0',
            expect: 'exit-0' as const,
            enabled: true,
          } as CheckDefinition,
        },
        {
          name: 'check-2',
          definition: {
            run: 'exit 0',
            expect: 'exit-0' as const,
            enabled: true,
          } as CheckDefinition,
        },
        {
          name: 'check-3',
          definition: {
            run: 'exit 0',
            expect: 'exit-0' as const,
            enabled: true,
          } as CheckDefinition,
        },
      ];

      const report = await runVector({
        vectorName: 'v1',
        checks,
        maxRetries: 0,
        timeout: 5000,
        environment: {
          cwd: process.cwd(),
        },
      });

      expect(report.verdict).toBe('pass');
      expect(report.checks).toHaveLength(3);
      expect(report.checks.every((c) => c.status === 'passed')).toBe(true);
    });

    it('should fail verdict if any check fails', async () => {
      const checks = [
        {
          name: 'check-1',
          definition: {
            run: 'exit 0',
            expect: 'exit-0' as const,
            enabled: true,
          } as CheckDefinition,
        },
        {
          name: 'failing-check',
          definition: {
            run: 'exit 1',
            expect: 'exit-0' as const,
            enabled: true,
          } as CheckDefinition,
        },
        {
          name: 'check-3',
          definition: {
            run: 'exit 0',
            expect: 'exit-0' as const,
            enabled: true,
          } as CheckDefinition,
        },
      ];

      const report = await runVector({
        vectorName: 'v1',
        checks,
        maxRetries: 0,
        timeout: 5000,
        environment: {
          cwd: process.cwd(),
        },
      });

      expect(report.verdict).toBe('fail');
      expect(report.checks[1].status).toBe('failed');
    });
  });

  describe('retry logic', () => {
    it('should retry failed check and succeed on second attempt', async () => {
      // This is a tricky test: we need a command that fails once then passes
      // We'll use a helper script approach: fail first time, pass second time
      const checks = [
        {
          name: 'retry-check',
          definition: {
            run: 'test -f /tmp/vector-test-retry && exit 0 || (touch /tmp/vector-test-retry && exit 1)',
            expect: 'exit-0' as const,
            enabled: true,
          } as CheckDefinition,
        },
      ];

      // Clean up before test
      try {
        require('fs').unlinkSync('/tmp/vector-test-retry');
      } catch {
        // File doesn't exist, that's fine
      }

      const report = await runVector({
        vectorName: 'v1',
        checks,
        maxRetries: 2,
        timeout: 5000,
        environment: {
          cwd: process.cwd(),
        },
      });

      expect(report.verdict).toBe('pass');
      expect(report.checks[0].status).toBe('passed');
      expect(report.retries).toHaveLength(1);
      expect(report.retries[0].checkName).toBe('retry-check');
      expect(report.retries[0].succeededAtAttempt).toBe(2);
      expect(report.retries[0].totalAttempts).toBe(2);
    });

    it('should exhaust retries and produce escalation info on failure', async () => {
      const checks = [
        {
          name: 'always-fails',
          definition: {
            run: 'exit 1',
            expect: 'exit-0' as const,
            enabled: true,
          } as CheckDefinition,
        },
      ];

      const report = await runVector({
        vectorName: 'v1',
        checks,
        maxRetries: 2,
        timeout: 5000,
        environment: {
          cwd: process.cwd(),
        },
      });

      expect(report.verdict).toBe('fail');
      expect(report.checks[0].status).toBe('failed');
      expect(report.retries).toHaveLength(1);
      expect(report.retries[0].finalStatus).toBe('failed');
      expect(report.retries[0].totalAttempts).toBe(3); // Initial + 2 retries
      expect(report.escalation).toBeDefined();
      expect(report.escalation?.failedCheckName).toBe('always-fails');
    });

    it('should track attempt history in retry info', async () => {
      const checks = [
        {
          name: 'retry-check',
          definition: {
            run: 'test -f /tmp/vector-test-retry2 && exit 0 || (touch /tmp/vector-test-retry2 && exit 1)',
            expect: 'exit-0' as const,
            enabled: true,
          } as CheckDefinition,
        },
      ];

      // Clean up before test
      try {
        require('fs').unlinkSync('/tmp/vector-test-retry2');
      } catch {
        // File doesn't exist, that's fine
      }

      const report = await runVector({
        vectorName: 'v1',
        checks,
        maxRetries: 2,
        timeout: 5000,
        environment: {
          cwd: process.cwd(),
        },
      });

      expect(report.retries[0].attemptHistory).toBeDefined();
      expect(report.retries[0].attemptHistory.length).toBeGreaterThan(0);
      expect(report.retries[0].attemptHistory[0].attemptNumber).toBe(1);
      expect(report.retries[0].attemptHistory[0].status).toBe('failed');
    });
  });

  describe('report shape', () => {
    it('should match EnforcementReport interface exactly', async () => {
      const checks = [
        {
          name: 'test-check',
          definition: {
            run: 'exit 0',
            expect: 'exit-0' as const,
            enabled: true,
          } as CheckDefinition,
        },
      ];

      const report = await runVector({
        vectorName: 'v1',
        checks,
        maxRetries: 0,
        timeout: 5000,
        environment: {
          cwd: process.cwd(),
          gitBranch: 'main',
          gitCommit: 'abc123',
        },
      });

      // Verify all required fields exist and have correct types
      expect(typeof report.id).toBe('string');
      expect(report.blueprintName).toBe('v1');
      expect(typeof report.taskDescription).toBe('string');
      expect(['pass', 'fail']).toContain(report.verdict);
      expect(Array.isArray(report.checks)).toBe(true);
      expect(Array.isArray(report.retries)).toBe(true);
      expect(typeof report.timestamp).toBe('string');
      expect(typeof report.totalDuration).toBe('number');
      expect(report.environment.cwd).toBe(process.cwd());
      expect(report.environment.gitBranch).toBe('main');
      expect(report.environment.gitCommit).toBe('abc123');
    });

    it('should calculate totalDuration as sum of check durations', async () => {
      const checks = [
        {
          name: 'check-1',
          definition: {
            run: 'exit 0',
            expect: 'exit-0' as const,
            enabled: true,
          } as CheckDefinition,
        },
        {
          name: 'check-2',
          definition: {
            run: 'exit 0',
            expect: 'exit-0' as const,
            enabled: true,
          } as CheckDefinition,
        },
      ];

      const report = await runVector({
        vectorName: 'v1',
        checks,
        maxRetries: 0,
        timeout: 5000,
        environment: {
          cwd: process.cwd(),
        },
      });

      const expectedTotal = report.checks.reduce((sum, c) => sum + c.duration, 0);
      expect(report.totalDuration).toBe(expectedTotal);
    });
  });

  describe('edge cases', () => {
    it('should handle empty check list', async () => {
      const report = await runVector({
        vectorName: 'v1',
        checks: [],
        maxRetries: 0,
        timeout: 5000,
        environment: {
          cwd: process.cwd(),
        },
      });

      expect(report.verdict).toBe('pass');
      expect(report.checks).toHaveLength(0);
    });

    it('should set timestamp in ISO format', async () => {
      const report = await runVector({
        vectorName: 'v1',
        checks: [],
        maxRetries: 0,
        timeout: 5000,
        environment: {
          cwd: process.cwd(),
        },
      });

      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      expect(report.timestamp).toMatch(isoRegex);
    });

    it('should generate unique report IDs', async () => {
      const report1 = await runVector({
        vectorName: 'v1',
        checks: [],
        maxRetries: 0,
        timeout: 5000,
        environment: {
          cwd: process.cwd(),
        },
      });

      const report2 = await runVector({
        vectorName: 'v1',
        checks: [],
        maxRetries: 0,
        timeout: 5000,
        environment: {
          cwd: process.cwd(),
        },
      });

      expect(report1.id).not.toBe(report2.id);
    });
  });

  describe('stdout/stderr capture', () => {
    it('should capture command stdout in check details', async () => {
      const checks = [
        {
          name: 'echo-check',
          definition: {
            run: 'echo "test output"',
            expect: 'exit-0' as const,
            enabled: true,
            capture: 'stdout' as const,
          } as CheckDefinition,
        },
      ];

      const report = await runVector({
        vectorName: 'v1',
        checks,
        maxRetries: 0,
        timeout: 5000,
        environment: {
          cwd: process.cwd(),
        },
      });

      expect(report.verdict).toBe('pass');
      expect(report.checks[0].status).toBe('passed');
      expect(report.checks[0].details?.message).toBeDefined();
    });

    it('should include maxRetries=0 in total attempts calculation', async () => {
      const checks = [
        {
          name: 'no-retry-check',
          definition: {
            run: 'exit 0',
            expect: 'exit-0' as const,
            enabled: true,
          } as CheckDefinition,
        },
      ];

      const report = await runVector({
        vectorName: 'v1',
        checks,
        maxRetries: 0,
        timeout: 5000,
        environment: {
          cwd: process.cwd(),
        },
      });

      expect(report.verdict).toBe('pass');
      expect(report.retries).toHaveLength(0);
    });
  });
});
