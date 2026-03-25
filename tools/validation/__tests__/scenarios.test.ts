import { describe, it, expect } from 'vitest';
import { allScenarios } from '../scenarios/index';

describe('ValidationScenarios', () => {
  it('should have 6 scenarios', () => {
    expect(allScenarios).toHaveLength(6);
  });

  it('should have unique IDs across all scenarios', () => {
    const ids = allScenarios.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(allScenarios.length);
  });

  it('should have expected scenario IDs', () => {
    const ids = allScenarios.map((s) => s.id).sort();
    const expected = [
      'all-pass',
      'all-skipped',
      'escalation',
      'many-checks',
      'retry-then-pass',
      'single-failure',
    ].sort();
    expect(ids).toEqual(expected);
  });

  describe('each scenario', () => {
    allScenarios.forEach((scenario) => {
      describe(`${scenario.id}`, () => {
        it('should have non-empty description', () => {
          expect(scenario.description).toBeTruthy();
          expect(typeof scenario.description).toBe('string');
        });

        it('should have non-empty tags array', () => {
          expect(scenario.tags.length).toBeGreaterThan(0);
          expect(Array.isArray(scenario.tags)).toBe(true);
        });

        it('should have valid id', () => {
          expect(scenario.id).toBeTruthy();
          expect(typeof scenario.id).toBe('string');
          expect(scenario.id.length).toBeGreaterThan(0);
        });

        it('should build a valid EnforcementReport', () => {
          const report = scenario.buildReport('/test/cwd');

          // Verify report structure
          expect(report).toBeDefined();
          expect(report.id).toBeTruthy();
          expect(report.blueprintName).toBeTruthy();
          expect(report.taskDescription).toBeTruthy();
          expect(['pass', 'fail']).toContain(report.verdict);
          expect(Array.isArray(report.checks)).toBe(true);
          expect(Array.isArray(report.retries)).toBe(true);
          expect(report.timestamp).toBeTruthy();
          expect(typeof report.totalDuration).toBe('number');
          expect(report.totalDuration).toBeGreaterThanOrEqual(0);
          expect(report.environment).toBeDefined();
          expect(report.environment.cwd).toBe('/test/cwd');
        });

        it('should compute verdict based on checks', () => {
          const report = scenario.buildReport('/test/cwd');
          const hasFailedCheck = report.checks.some((c) => c.status === 'failed');
          const expectedVerdict = hasFailedCheck ? 'fail' : 'pass';
          expect(report.verdict).toBe(expectedVerdict);
        });

        it('should compute totalDuration as sum of check durations', () => {
          const report = scenario.buildReport('/test/cwd');
          const summedDuration = report.checks.reduce((sum, check) => sum + check.duration, 0);
          expect(report.totalDuration).toBe(summedDuration);
        });

        it('should have all checks with valid status and duration', () => {
          const report = scenario.buildReport('/test/cwd');
          report.checks.forEach((check) => {
            expect(['passed', 'failed', 'skipped']).toContain(check.status);
            expect(typeof check.duration).toBe('number');
            expect(check.duration).toBeGreaterThanOrEqual(0);
            expect(check.checkName).toBeTruthy();
          });
        });

        it('should have all retries with valid attempt history', () => {
          const report = scenario.buildReport('/test/cwd');
          report.retries.forEach((retry) => {
            expect(retry.checkName).toBeTruthy();
            expect(retry.totalAttempts).toBeGreaterThan(0);
            expect(['passed', 'failed']).toContain(retry.finalStatus);
            expect(Array.isArray(retry.attemptHistory)).toBe(true);
            expect(retry.attemptHistory.length).toBeGreaterThan(0);

            retry.attemptHistory.forEach((attempt) => {
              expect(['passed', 'failed']).toContain(attempt.status);
              expect(typeof attempt.duration).toBe('number');
              expect(typeof attempt.attemptNumber).toBe('number');
            });
          });
        });

        it('should have escalation if verdict is fail and escalation is defined', () => {
          const report = scenario.buildReport('/test/cwd');
          if (report.escalation) {
            expect(report.verdict).toBe('fail');
            expect(report.escalation.reason).toBeTruthy();
            expect(report.escalation.suggestion).toBeTruthy();
            expect(report.escalation.failedCheckName).toBeTruthy();
          }
        });
      });
    });
  });

  describe('tags', () => {
    it('should have all tags used in at least one scenario', () => {
      const allTags = new Set<string>();
      allScenarios.forEach((scenario) => {
        scenario.tags.forEach((tag) => allTags.add(tag));
      });

      const expectedTags = ['pass', 'fail', 'basic', 'retry', 'escalation', 'edge-case', 'stress'];
      expectedTags.forEach((tag) => {
        const scenarioWithTag = allScenarios.some((s) => s.tags.includes(tag));
        expect(scenarioWithTag).toBe(true);
      });
    });

    it('should have scenarios with "pass" verdict tagged with "pass"', () => {
      allScenarios.forEach((scenario) => {
        const report = scenario.buildReport('/test/cwd');
        if (report.verdict === 'pass') {
          expect(scenario.tags.includes('pass')).toBe(true);
        }
      });
    });

    it('most scenarios with "fail" verdict should be tagged with "fail"', () => {
      allScenarios.forEach((scenario) => {
        const report = scenario.buildReport('/test/cwd');
        // Both single-failure and escalation fail, both should have 'fail' tag
        if (report.verdict === 'fail') {
          expect(scenario.tags.includes('fail')).toBe(true);
        }
      });
    });

    it('scenarios with retries should be tagged with "retry"', () => {
      allScenarios.forEach((scenario) => {
        const report = scenario.buildReport('/test/cwd');
        if (report.retries.length > 0) {
          expect(scenario.tags.includes('retry')).toBe(true);
        }
      });
    });

    it('should have scenarios with escalation tagged with "escalation"', () => {
      allScenarios.forEach((scenario) => {
        const report = scenario.buildReport('/test/cwd');
        if (report.escalation) {
          expect(scenario.tags.includes('escalation')).toBe(true);
        }
      });
    });
  });

  describe('specific scenarios', () => {
    it('all-pass should have all passed checks and no retries', () => {
      const scenario = allScenarios.find((s) => s.id === 'all-pass')!;
      const report = scenario.buildReport('/test/cwd');
      expect(report.verdict).toBe('pass');
      expect(report.checks.every((c) => c.status === 'passed')).toBe(true);
      expect(report.retries).toHaveLength(0);
      expect(report.escalation).toBeUndefined();
    });

    it('single-failure should have exactly one failed check', () => {
      const scenario = allScenarios.find((s) => s.id === 'single-failure')!;
      const report = scenario.buildReport('/test/cwd');
      expect(report.verdict).toBe('fail');
      const failedChecks = report.checks.filter((c) => c.status === 'failed');
      expect(failedChecks).toHaveLength(1);
      expect(failedChecks[0].checkName).toBe('tests-exist');
    });

    it('retry-then-pass should have retries and pass verdict', () => {
      const scenario = allScenarios.find((s) => s.id === 'retry-then-pass')!;
      const report = scenario.buildReport('/test/cwd');
      expect(report.verdict).toBe('pass');
      expect(report.retries.length).toBeGreaterThan(0);
      const testsExistRetry = report.retries.find((r) => r.checkName === 'tests-exist');
      expect(testsExistRetry).toBeDefined();
      expect(testsExistRetry?.succeededAtAttempt).toBe(2);
    });

    it('escalation should have escalation info and fail verdict', () => {
      const scenario = allScenarios.find((s) => s.id === 'escalation')!;
      const report = scenario.buildReport('/test/cwd');
      expect(report.verdict).toBe('fail');
      expect(report.escalation).toBeDefined();
      expect(report.escalation?.reason).toContain('failed after 3 retry');
    });

    it('all-skipped should have all skipped checks and pass verdict', () => {
      const scenario = allScenarios.find((s) => s.id === 'all-skipped')!;
      const report = scenario.buildReport('/test/cwd');
      expect(report.verdict).toBe('pass');
      expect(report.checks.every((c) => c.status === 'skipped')).toBe(true);
    });

    it('many-checks should have 8 checks with mixed statuses', () => {
      const scenario = allScenarios.find((s) => s.id === 'many-checks')!;
      const report = scenario.buildReport('/test/cwd');
      expect(report.checks).toHaveLength(8);
      const passed = report.checks.filter((c) => c.status === 'passed').length;
      const failed = report.checks.filter((c) => c.status === 'failed').length;
      const skipped = report.checks.filter((c) => c.status === 'skipped').length;
      expect(passed).toBe(6);
      expect(failed).toBe(1);
      expect(skipped).toBe(1);
    });

    it('many-checks should have 2 retries', () => {
      const scenario = allScenarios.find((s) => s.id === 'many-checks')!;
      const report = scenario.buildReport('/test/cwd');
      expect(report.retries).toHaveLength(2);
    });
  });
});
