/**
 * Observability Validation Tests
 *
 * End-to-end validation of the full observability pipeline.
 * Each test scenario builds a realistic report and runs it through
 * ALL renderers (terminal, JSON, markdown), capturing and verifying output.
 *
 * Run with: npm run test -- observability-validation.test.ts
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  createReport,
  addCheck,
  addRetry,
  withEscalation,
  finalize,
  EnforcementReport,
} from '../enforcementReport';
import { formatReport, writeToTerminal } from '../terminalReporter';
import { writeReportToJSON, readReportFromJSON } from '../jsonLogger';
import { renderMarkdown, postPRComment } from '../ghPrCommenter';

// ── Helpers ──────────────────────────────────────────────────────────

function buildPassingReport(tmpDir: string): EnforcementReport {
  let report = createReport({
    id: 'validation-pass-001',
    blueprintName: 'implement-feature',
    taskDescription: 'Add DELETE /users/:id endpoint',
    cwd: tmpDir,
    gitBranch: 'feat/observability-validation',
    gitCommit: 'abc1234',
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
    details: { message: 'Found user-endpoints.test.ts' },
  });

  report = addCheck(report, {
    checkName: 'docs-updated',
    status: 'passed',
    duration: 8,
  });

  return finalize(report);
}

function buildFailingReport(tmpDir: string): EnforcementReport {
  let report = createReport({
    id: 'validation-fail-001',
    blueprintName: 'implement-feature',
    taskDescription: 'Add DELETE /users/:id endpoint',
    cwd: tmpDir,
    gitBranch: 'feat/observability-validation',
    gitCommit: 'def5678',
  });

  report = addCheck(report, {
    checkName: 'commit-message',
    status: 'passed',
    duration: 10,
  });

  report = addCheck(report, {
    checkName: 'tests-exist',
    status: 'failed',
    duration: 45,
    details: {
      message: 'Missing test file for user-endpoints.ts',
      missing: ['user-endpoints.test.ts'],
    },
  });

  report = addCheck(report, {
    checkName: 'docs-updated',
    status: 'passed',
    duration: 7,
  });

  return finalize(report);
}

function buildRetryReport(tmpDir: string): EnforcementReport {
  let report = createReport({
    id: 'validation-retry-001',
    blueprintName: 'implement-feature',
    taskDescription: 'Add DELETE /users/:id endpoint',
    cwd: tmpDir,
    gitBranch: 'feat/observability-validation',
    gitCommit: 'aaa9999',
  });

  report = addCheck(report, {
    checkName: 'commit-message',
    status: 'passed',
    duration: 12,
  });

  // Final check status after retry succeeded
  report = addCheck(report, {
    checkName: 'tests-exist',
    status: 'passed',
    duration: 38,
  });

  report = addRetry(report, {
    checkName: 'tests-exist',
    totalAttempts: 2,
    succeededAtAttempt: 2,
    finalStatus: 'passed',
    attemptHistory: [
      { attemptNumber: 1, status: 'failed', duration: 45, error: 'Missing test file for user-endpoints.ts' },
      { attemptNumber: 2, status: 'passed', duration: 38 },
    ],
  });

  report = addCheck(report, {
    checkName: 'docs-updated',
    status: 'passed',
    duration: 8,
  });

  return finalize(report);
}

function buildEscalationReport(tmpDir: string): EnforcementReport {
  let report = createReport({
    id: 'validation-escalation-001',
    blueprintName: 'implement-feature',
    taskDescription: 'Add DELETE /users/:id endpoint',
    cwd: tmpDir,
    gitBranch: 'feat/observability-validation',
    gitCommit: 'bbb0000',
  });

  report = addCheck(report, {
    checkName: 'commit-message',
    status: 'passed',
    duration: 10,
  });

  report = addCheck(report, {
    checkName: 'tests-exist',
    status: 'failed',
    duration: 50,
    details: {
      message: 'Test runner timed out after 3 attempts',
      issues: ['vitest process hung on worker allocation', 'timeout exceeded 30s'],
    },
  });

  report = addRetry(report, {
    checkName: 'tests-exist',
    totalAttempts: 3,
    finalStatus: 'failed',
    attemptHistory: [
      { attemptNumber: 1, status: 'failed', duration: 30000, error: 'Timeout after 30s' },
      { attemptNumber: 2, status: 'failed', duration: 30000, error: 'Timeout after 30s' },
      { attemptNumber: 3, status: 'failed', duration: 50, error: 'Aborted by enforcer' },
    ],
  });

  report = withEscalation(report, {
    reason: 'tests-exist check failed after 3 attempts with timeout errors',
    suggestion: 'Check if vitest workers are being starved. Try running tests manually with --pool=forks',
    failedCheckName: 'tests-exist',
  });

  return finalize(report);
}

// ── Test Scenarios ──────────────────────────────────────────────────

describe('Observability Validation — End-to-End Scenarios', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'vector-validation-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ── Scenario 1: All Checks Pass ─────────────────────────────────

  describe('Scenario 1: All checks pass', () => {
    it('terminal output contains PASS verdict and all 3 checks', () => {
      const report = buildPassingReport(tmpDir);
      const output = formatReport(report, { color: false });

      console.log('\n=== SCENARIO 1: ALL PASS (Terminal) ===');
      console.log(output);
      console.log('=== END SCENARIO 1 ===\n');

      expect(output).toContain('VECTOR ENFORCEMENT REPORT');
      expect(output).toContain('Blueprint: implement-feature');
      expect(output).toContain('[PASS] commit-message');
      expect(output).toContain('[PASS] tests-exist');
      expect(output).toContain('[PASS] docs-updated');
      expect(output).toContain('VERDICT:');
      expect(output).toContain('3 checks');
      expect(output).not.toContain('RETRIES');
      expect(output).not.toContain('ESCALATION');
    });

    it('JSON round-trip preserves all data', async () => {
      const report = buildPassingReport(tmpDir);
      const writeResult = await writeReportToJSON(report, { outputDir: tmpDir });

      expect(writeResult.success).toBe(true);
      if (!writeResult.success) return;

      const raw = await readFile(writeResult.filePath, 'utf-8');
      const envelope = JSON.parse(raw);

      console.log('\n=== SCENARIO 1: ALL PASS (JSON envelope) ===');
      console.log(JSON.stringify(envelope, null, 2).substring(0, 800) + '\n...(truncated)');
      console.log('=== END SCENARIO 1 JSON ===\n');

      expect(envelope._meta.version).toBe('1.0.0');
      expect(envelope._meta.generator).toBe('vector-enforcer');
      expect(envelope.report.verdict).toBe('pass');
      expect(envelope.report.checks).toHaveLength(3);

      // Read back and verify
      const readResult = await readReportFromJSON(writeResult.filePath);
      expect(readResult.success).toBe(true);
      if (readResult.success) {
        expect(readResult.report.verdict).toBe('pass');
        expect(readResult.report.checks).toHaveLength(3);
      }
    });

    it('markdown output has check table with all pass indicators', () => {
      const report = buildPassingReport(tmpDir);
      const md = renderMarkdown(report);

      console.log('\n=== SCENARIO 1: ALL PASS (Markdown) ===');
      console.log(md);
      console.log('=== END SCENARIO 1 MARKDOWN ===\n');

      expect(md).toContain('## Vector Enforcement Report');
      expect(md).toContain('**Blueprint:** implement-feature');
      expect(md).toContain(':white_check_mark: Pass');
      expect(md).toContain('**Verdict: PASS**');
      expect(md).not.toContain('<details>');
      expect(md).not.toContain('### Escalation');
    });
  });

  // ── Scenario 2: Check Failure ────────────────────────────────────

  describe('Scenario 2: Check failure (tests-exist fails)', () => {
    it('terminal output shows FAIL with details and missing files', () => {
      const report = buildFailingReport(tmpDir);
      const output = formatReport(report, { color: false });

      console.log('\n=== SCENARIO 2: FAILURE (Terminal) ===');
      console.log(output);
      console.log('=== END SCENARIO 2 ===\n');

      expect(output).toContain('[FAIL] tests-exist');
      expect(output).toContain('Missing test file for user-endpoints.ts');
      expect(output).toContain('Missing: user-endpoints.test.ts');
      expect(output).toContain('VERDICT:');
      expect(report.verdict).toBe('fail');
    });

    it('JSON captures failure details', async () => {
      const report = buildFailingReport(tmpDir);
      const writeResult = await writeReportToJSON(report, { outputDir: tmpDir });

      expect(writeResult.success).toBe(true);
      if (!writeResult.success) return;

      const readResult = await readReportFromJSON(writeResult.filePath);
      expect(readResult.success).toBe(true);
      if (!readResult.success) return;

      console.log('\n=== SCENARIO 2: FAILURE (JSON verdict + failed check) ===');
      console.log(`verdict: ${readResult.report.verdict}`);
      const failedCheck = readResult.report.checks.find(c => c.status === 'failed');
      console.log(`failed check: ${JSON.stringify(failedCheck, null, 2)}`);
      console.log('=== END SCENARIO 2 JSON ===\n');

      expect(readResult.report.verdict).toBe('fail');
      expect(failedCheck).toBeDefined();
      expect(failedCheck!.checkName).toBe('tests-exist');
      expect(failedCheck!.details?.missing).toContain('user-endpoints.test.ts');
    });

    it('markdown shows failure emoji and details', () => {
      const report = buildFailingReport(tmpDir);
      const md = renderMarkdown(report);

      console.log('\n=== SCENARIO 2: FAILURE (Markdown) ===');
      console.log(md);
      console.log('=== END SCENARIO 2 MARKDOWN ===\n');

      expect(md).toContain(':x: Fail');
      expect(md).toContain('**Verdict: FAIL**');
    });
  });

  // ── Scenario 3: Retry Then Pass ──────────────────────────────────

  describe('Scenario 3: Retry succeeds on 2nd attempt', () => {
    it('terminal output shows retry timeline', () => {
      const report = buildRetryReport(tmpDir);
      const output = formatReport(report, { color: false });

      console.log('\n=== SCENARIO 3: RETRY (Terminal) ===');
      console.log(output);
      console.log('=== END SCENARIO 3 ===\n');

      expect(output).toContain('RETRIES');
      expect(output).toContain('tests-exist: 2 attempts, succeeded at attempt 2');
      expect(output).toContain('#1 FAIL');
      expect(output).toContain('#2 PASS');
      expect(output).toContain('1 retry');
      expect(report.verdict).toBe('pass');
    });

    it('markdown shows collapsible retry details', () => {
      const report = buildRetryReport(tmpDir);
      const md = renderMarkdown(report);

      console.log('\n=== SCENARIO 3: RETRY (Markdown) ===');
      console.log(md);
      console.log('=== END SCENARIO 3 MARKDOWN ===\n');

      expect(md).toContain('<details>');
      expect(md).toContain('Retry Details (1 retry)');
      expect(md).toContain('</details>');
      expect(md).toContain('**Verdict: PASS**');
    });
  });

  // ── Scenario 4: Escalation ───────────────────────────────────────

  describe('Scenario 4: Escalation after exhausted retries', () => {
    it('terminal output shows escalation block with reason and suggestion', () => {
      const report = buildEscalationReport(tmpDir);
      const output = formatReport(report, { color: false });

      console.log('\n=== SCENARIO 4: ESCALATION (Terminal) ===');
      console.log(output);
      console.log('=== END SCENARIO 4 ===\n');

      expect(output).toContain('ESCALATION');
      expect(output).toContain('tests-exist check failed after 3 attempts');
      expect(output).toContain('Suggestion:');
      expect(output).toContain('--pool=forks');
      expect(output).toContain('RETRIES');
      expect(output).toContain('#1 FAIL');
      expect(output).toContain('#2 FAIL');
      expect(output).toContain('#3 FAIL');
      expect(report.verdict).toBe('fail');
    });

    it('JSON captures full escalation and retry history', async () => {
      const report = buildEscalationReport(tmpDir);
      const writeResult = await writeReportToJSON(report, { outputDir: tmpDir });

      expect(writeResult.success).toBe(true);
      if (!writeResult.success) return;

      const readResult = await readReportFromJSON(writeResult.filePath);
      expect(readResult.success).toBe(true);
      if (!readResult.success) return;

      const r = readResult.report;

      console.log('\n=== SCENARIO 4: ESCALATION (JSON summary) ===');
      console.log(`verdict: ${r.verdict}`);
      console.log(`escalation: ${JSON.stringify(r.escalation, null, 2)}`);
      console.log(`retries[0].attemptHistory length: ${r.retries[0]?.attemptHistory.length}`);
      console.log('=== END SCENARIO 4 JSON ===\n');

      expect(r.verdict).toBe('fail');
      expect(r.escalation).toBeDefined();
      expect(r.escalation!.reason).toContain('3 attempts');
      expect(r.retries[0].attemptHistory).toHaveLength(3);
    });

    it('markdown shows escalation section and collapsible retries', () => {
      const report = buildEscalationReport(tmpDir);
      const md = renderMarkdown(report);

      console.log('\n=== SCENARIO 4: ESCALATION (Markdown) ===');
      console.log(md);
      console.log('=== END SCENARIO 4 MARKDOWN ===\n');

      expect(md).toContain('### Escalation');
      expect(md).toContain('**Reason:**');
      expect(md).toContain('**Suggestion:**');
      expect(md).toContain('<details>');
      expect(md).toContain('**Verdict: FAIL**');
    });
  });

  // ── Scenario 5: PR Comment Dry Run ───────────────────────────────

  describe('Scenario 5: PR comment dry-run mode', () => {
    it('dry-run returns markdown without posting', async () => {
      const report = buildRetryReport(tmpDir);
      const md = renderMarkdown(report);

      const result = await postPRComment({
        prNumber: 999,
        body: md,
        dryRun: true,
      });

      console.log('\n=== SCENARIO 5: DRY RUN PR COMMENT ===');
      console.log(`posted: ${result.posted}`);
      console.log(`markdown length: ${result.markdown.length}`);
      console.log(`error: ${result.error ?? 'none'}`);
      console.log('--- markdown preview (first 500 chars) ---');
      console.log(result.markdown.substring(0, 500));
      console.log('=== END SCENARIO 5 ===\n');

      expect(result.posted).toBe(false);
      expect(result.markdown).toContain('## Vector Enforcement Report');
      expect(result.error).toBeUndefined();
    });
  });

  // ── Scenario 6: Color vs No-Color ───────────────────────────────

  describe('Scenario 6: Color vs no-color parity', () => {
    it('colored and plain outputs have same content, different codes', () => {
      const report = buildPassingReport(tmpDir);
      const plain = formatReport(report, { color: false });
      const colored = formatReport(report, { color: true });

      console.log('\n=== SCENARIO 6: COLOR COMPARISON ===');
      console.log('--- Plain (no ANSI) ---');
      console.log(plain);
      console.log('--- Colored (with ANSI) ---');
      console.log(colored);
      console.log('=== END SCENARIO 6 ===\n');

      // Strip ANSI codes from colored output
      const stripped = colored.replace(/\x1b\[[0-9;]*m/g, '');
      expect(stripped).toBe(plain);

      // Colored output should contain ANSI escape sequences
      expect(colored).toMatch(/\x1b\[/);
      expect(plain).not.toMatch(/\x1b\[/);
    });
  });

  // ── Scenario 7: Immutability Proof ───────────────────────────────

  describe('Scenario 7: Immutability guarantee', () => {
    it('builder operations never mutate the original report', () => {
      const original = createReport({
        id: 'immutability-test',
        blueprintName: 'test',
        taskDescription: 'verify immutability',
        cwd: tmpDir,
      });

      const originalCheckCount = original.checks.length;
      const originalRetryCount = original.retries.length;

      // All these operations should leave original unchanged
      const withCheck = addCheck(original, { checkName: 'x', status: 'passed', duration: 1 });
      const withRetryR = addRetry(original, {
        checkName: 'x', totalAttempts: 2, finalStatus: 'passed',
        attemptHistory: [{ attemptNumber: 1, status: 'passed', duration: 1 }],
      });
      const withEsc = withEscalation(original, {
        reason: 'test', suggestion: 'test', failedCheckName: 'x',
      });
      const finalized = finalize(withCheck);

      console.log('\n=== SCENARIO 7: IMMUTABILITY PROOF ===');
      console.log(`original.checks.length after addCheck: ${original.checks.length} (expected ${originalCheckCount})`);
      console.log(`original.retries.length after addRetry: ${original.retries.length} (expected ${originalRetryCount})`);
      console.log(`original.escalation after withEscalation: ${original.escalation} (expected undefined)`);
      console.log(`original.verdict after withEscalation: ${original.verdict} (expected pass)`);
      console.log(`withCheck !== original: ${withCheck !== original}`);
      console.log(`withCheck.checks !== original.checks: ${withCheck.checks !== original.checks}`);
      console.log('=== END SCENARIO 7 ===\n');

      expect(original.checks.length).toBe(originalCheckCount);
      expect(original.retries.length).toBe(originalRetryCount);
      expect(original.escalation).toBeUndefined();
      expect(original.verdict).toBe('pass');
      expect(withCheck).not.toBe(original);
      expect(withRetryR).not.toBe(original);
      expect(withEsc).not.toBe(original);
      expect(finalized).not.toBe(withCheck);
    });
  });
});
