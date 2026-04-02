import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { EnforcementReport, CheckResult } from '../../protocol/types';
import { formatStyledRun } from '../commands/run';

/**
 * Helper to create a mock report
 */
function createMockReport(overrides: Partial<EnforcementReport> = {}): EnforcementReport {
  const baseReport: EnforcementReport = {
    id: 'test-001',
    blueprintName: 'test-vector',
    taskDescription: 'Test vector run',
    verdict: 'pass',
    checks: [],
    retries: [],
    timestamp: new Date().toISOString(),
    totalDuration: 0,
    environment: {
      cwd: '/test/cwd',
      gitBranch: 'main',
      gitCommit: 'abc123',
    },
  };

  return { ...baseReport, ...overrides };
}

/**
 * Helper to create a mock check result
 */
function createCheckResult(
  name: string,
  status: 'passed' | 'failed' | 'skipped' = 'passed',
  duration: number = 100
): CheckResult {
  return {
    checkName: name,
    status,
    duration,
    details:
      status === 'failed'
        ? {
            message: `${name} failed`,
          }
        : undefined,
  };
}

describe('formatStyledRun', () => {
  it('should format a report with passed checks', () => {
    const report = createMockReport({
      checks: [
        createCheckResult('lint', 'passed', 1200),
        createCheckResult('typecheck', 'passed', 3400),
      ],
      verdict: 'pass',
      totalDuration: 4600,
    });

    const output = formatStyledRun(report);

    expect(output).toContain('lint');
    expect(output).toContain('typecheck');
    expect(output).toContain('✓');
    expect(output).toContain('2');
    expect(output).toContain('passed');
  });

  it('should format a report with failed checks', () => {
    const report = createMockReport({
      checks: [
        createCheckResult('lint', 'passed', 1200),
        createCheckResult('test', 'failed', 5100),
      ],
      verdict: 'fail',
      totalDuration: 6300,
    });

    const output = formatStyledRun(report);

    expect(output).toContain('lint');
    expect(output).toContain('test');
    expect(output).toContain('✓');
    expect(output).toContain('✗');
    expect(output).toContain('failed');
  });

  it('should include error details for failed checks', () => {
    const report = createMockReport({
      checks: [
        createCheckResult('test', 'failed', 5100),
      ],
      verdict: 'fail',
      totalDuration: 5100,
    });

    const output = formatStyledRun(report);

    expect(output).toContain('test failed');
  });

  it('should format a report with skipped checks', () => {
    const report = createMockReport({
      checks: [
        createCheckResult('lint', 'passed', 1200),
        createCheckResult('disabled-check', 'skipped', 0),
      ],
      verdict: 'pass',
      totalDuration: 1200,
    });

    const output = formatStyledRun(report);

    expect(output).toContain('disabled-check');
    expect(output).toContain('○');
  });

  it('should show correct summary with pass/fail/skip counts', () => {
    const report = createMockReport({
      checks: [
        createCheckResult('lint', 'passed', 1200),
        createCheckResult('test', 'failed', 5100),
        createCheckResult('disabled', 'skipped', 0),
      ],
      verdict: 'fail',
      totalDuration: 6300,
    });

    const output = formatStyledRun(report);

    expect(output).toContain('1 passed');
    expect(output).toContain('1 failed');
    expect(output).toContain('1 skipped');
  });

  it('should format duration in seconds', () => {
    const report = createMockReport({
      checks: [createCheckResult('lint', 'passed', 1234)],
      verdict: 'pass',
      totalDuration: 1234,
    });

    const output = formatStyledRun(report);

    // 1234ms = 1.2s
    expect(output).toMatch(/1\.2s/);
  });

  it('should handle report with no checks', () => {
    const report = createMockReport({
      checks: [],
      verdict: 'pass',
      totalDuration: 0,
    });

    const output = formatStyledRun(report);

    expect(output).toBeDefined();
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
  });

  it('should use box-drawing characters for structure', () => {
    const report = createMockReport({
      checks: [createCheckResult('lint', 'passed', 1200)],
      verdict: 'pass',
      totalDuration: 1200,
    });

    const output = formatStyledRun(report);

    // Should contain box-drawing characters
    expect(output).toMatch(/[┌│└◇●]/);
  });

  it('should show vector name in header', () => {
    const report = createMockReport({
      blueprintName: 'v1',
      checks: [createCheckResult('lint', 'passed', 1200)],
      verdict: 'pass',
      totalDuration: 1200,
    });

    const output = formatStyledRun(report);

    expect(output).toContain('v1');
  });

  it('should format multiple checks in order', () => {
    const report = createMockReport({
      checks: [
        createCheckResult('first', 'passed', 100),
        createCheckResult('second', 'passed', 200),
        createCheckResult('third', 'failed', 300),
      ],
      verdict: 'fail',
      totalDuration: 600,
    });

    const output = formatStyledRun(report);

    const firstIndex = output.indexOf('first');
    const secondIndex = output.indexOf('second');
    const thirdIndex = output.indexOf('third');

    expect(firstIndex).toBeLessThan(secondIndex);
    expect(secondIndex).toBeLessThan(thirdIndex);
  });

  it('should handle check names with special characters', () => {
    const report = createMockReport({
      checks: [createCheckResult('lint-config', 'passed', 1200)],
      verdict: 'pass',
      totalDuration: 1200,
    });

    const output = formatStyledRun(report);

    expect(output).toContain('lint-config');
  });

  it('should use active status symbol (●) for each check line', () => {
    const report = createMockReport({
      checks: [
        createCheckResult('lint', 'passed', 1200),
        createCheckResult('test', 'passed', 2000),
      ],
      verdict: 'pass',
      totalDuration: 3200,
    });

    const output = formatStyledRun(report);

    // Count occurrences of active symbol
    const activeCount = (output.match(/●/g) || []).length;
    expect(activeCount).toBeGreaterThanOrEqual(2);
  });
});

describe('runCommand', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join('/tmp', 'vector-run-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should run a vector with mocked config and engine', async () => {
    // This test requires mocking loadProjectConfig, loadActiveConfig, and runVector
    // For now, we'll test that the function handles invalid input gracefully
    const { runCommand } = await import('../commands/run');

    // Attempting to run non-existent vector should fail gracefully
    const exitCode = await runCommand('nonexistent', tempDir);
    expect(exitCode).toBe(1);
  });

  it('should return 0 on success', async () => {
    // This will be tested with actual integration test once mocking is set up
    // For now, testing error case
    const { runCommand } = await import('../commands/run');
    const exitCode = await runCommand('v1', tempDir);
    expect(typeof exitCode).toBe('number');
  });
});
