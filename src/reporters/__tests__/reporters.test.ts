import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  createReport,
  addCheck,
  finalize,
  EnforcementReport,
} from '../../../tools/enforcementReport';
import * as terminalReporter from '../terminal';
import * as jsonReporter from '../json';
import * as prCommentReporter from '../pr-comment';
import { formatWithReporter, writeWithReporter } from '../index';

describe('Reporters', () => {
  let mockReport: EnforcementReport;
  let tempDir: string;

  beforeEach(() => {
    // Create a test report
    tempDir = join(tmpdir(), `vector-test-${Date.now()}`);
    let report = createReport({
      id: 'test-001',
      blueprintName: 'TestBlueprint',
      taskDescription: 'Test Task',
      cwd: tempDir,
      gitBranch: 'main',
      gitCommit: 'abc123',
    });

    report = addCheck(report, {
      checkName: 'check-1',
      status: 'passed',
      duration: 100,
    });

    report = addCheck(report, {
      checkName: 'check-2',
      status: 'failed',
      duration: 200,
      details: {
        message: 'Something went wrong',
        issues: ['Issue 1', 'Issue 2'],
      },
    });

    mockReport = finalize(report);
  });

  afterEach(async () => {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Terminal Reporter', () => {
    it('should render report as string', () => {
      const output = terminalReporter.render(mockReport);
      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
    });

    it('should contain CHECKS section', () => {
      const output = terminalReporter.render(mockReport);
      expect(output).toContain('CHECKS');
    });

    it('should contain VERDICT section', () => {
      const output = terminalReporter.render(mockReport);
      expect(output).toContain('VERDICT');
    });

    it('should include check names in output', () => {
      const output = terminalReporter.render(mockReport);
      expect(output).toContain('check-1');
      expect(output).toContain('check-2');
    });

    it('should support color option', () => {
      const withColor = terminalReporter.render(mockReport, { color: true });
      const withoutColor = terminalReporter.render(mockReport, { color: false });
      expect(typeof withColor).toBe('string');
      expect(typeof withoutColor).toBe('string');
    });

    it('should write to terminal (mocked)', () => {
      const consoleSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any);
      terminalReporter.write(mockReport);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('JSON Reporter', () => {
    it('should write and read JSON correctly', async () => {
      const writeResult = await jsonReporter.writeJSON(mockReport, tempDir);
      expect(writeResult.success).toBe(true);
      expect(writeResult.filePath).toBeDefined();
      expect(writeResult.error).toBeUndefined();

      const filePath = (writeResult as any).filePath;
      const readResult = await jsonReporter.readJSON(filePath);
      expect(readResult.success).toBe(true);
      expect(readResult.report).toBeDefined();
      expect(readResult.error).toBeUndefined();
    });

    it('should include _meta envelope in JSON', async () => {
      const writeResult = await jsonReporter.writeJSON(mockReport, tempDir);
      expect(writeResult.success).toBe(true);

      const filePath = (writeResult as any).filePath;
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed._meta).toBeDefined();
      expect(parsed._meta.version).toBe('1.0.0');
      expect(parsed._meta.generatedAt).toBeDefined();
      expect(parsed._meta.generator).toBe('vector-enforcer');
      expect(parsed.report).toBeDefined();
    });

    it('should preserve report data on read', async () => {
      const writeResult = await jsonReporter.writeJSON(mockReport, tempDir);
      const filePath = (writeResult as any).filePath;
      const readResult = await jsonReporter.readJSON(filePath);

      const report = (readResult as any).report;
      expect(report.id).toBe('test-001');
      expect(report.blueprintName).toBe('TestBlueprint');
      expect(report.taskDescription).toBe('Test Task');
      expect(report.checks.length).toBe(2);
    });

    it('should handle read errors gracefully', async () => {
      const readResult = await jsonReporter.readJSON('/nonexistent/path.json');
      expect(readResult.success).toBe(false);
      expect(readResult.error).toBeDefined();
    });

    it('should handle write errors gracefully', async () => {
      const writeResult = await jsonReporter.writeJSON(mockReport, '/invalid/path/that/cannot/exist');
      expect(writeResult.success).toBe(false);
      expect(writeResult.error).toBeDefined();
    });
  });

  describe('PR Comment Reporter', () => {
    it('should render report as markdown', () => {
      const output = prCommentReporter.render(mockReport);
      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
    });

    it('should contain Checks heading in markdown', () => {
      const output = prCommentReporter.render(mockReport);
      expect(output).toContain('### Checks');
    });

    it('should contain Verdict in markdown', () => {
      const output = prCommentReporter.render(mockReport);
      expect(output).toContain('**Verdict:');
    });

    it('should include blueprint and task in markdown', () => {
      const output = prCommentReporter.render(mockReport);
      expect(output).toContain('TestBlueprint');
      expect(output).toContain('Test Task');
    });

    it('should detect PR context', () => {
      const context = prCommentReporter.detectPR();
      // May be null if not in a PR environment, that's ok
      expect(context === null || (context && typeof context.prNumber === 'number')).toBe(true);
    });

    it('should post with dryRun option', async () => {
      // When dryRun is true, we should not need a PR context
      // The test should pass regardless of PR context
      const result = await prCommentReporter.post(mockReport, { dryRun: true });
      // Either posted=false with error OR posted=false without error is acceptable for dryRun
      expect(result.posted).toBe(false);
      expect(result.markdown).toBeDefined();
    });
  });

  describe('Reporter Selection (formatWithReporter)', () => {
    it('should render with terminal reporter', () => {
      const output = formatWithReporter(mockReport, {
        type: 'terminal',
        color: false,
      });
      expect(output).toContain('CHECKS');
      expect(output).toContain('VERDICT');
    });

    it('should render with terminal reporter with color', () => {
      const output = formatWithReporter(mockReport, {
        type: 'terminal',
        color: true,
      });
      expect(output).toContain('CHECKS');
    });

    it('should render with json reporter', () => {
      const output = formatWithReporter(mockReport, {
        type: 'json',
      });
      const parsed = JSON.parse(output);
      expect(parsed._meta).toBeDefined();
      expect(parsed.report).toBeDefined();
    });

    it('should render with markdown reporter', () => {
      const output = formatWithReporter(mockReport, {
        type: 'markdown',
      });
      expect(output).toContain('### Checks');
      expect(output).toContain('**Verdict:');
    });
  });

  describe('Reporter Write (writeWithReporter)', () => {
    it('should write with terminal reporter', async () => {
      const consoleSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any);
      const result = await writeWithReporter(mockReport, {
        type: 'terminal',
      });
      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should write with json reporter', async () => {
      const result = await writeWithReporter(mockReport, {
        type: 'json',
        outputDir: tempDir,
      });
      expect(result.success).toBe(true);
      expect(result.output).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('should write with markdown reporter', async () => {
      vi.spyOn(prCommentReporter, 'detectPR').mockReturnValue({
        prNumber: 123,
        branch: 'main',
      });

      const result = await writeWithReporter(mockReport, {
        type: 'markdown',
        dryRun: true,
      });
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should handle write errors', async () => {
      const result = await writeWithReporter(mockReport, {
        type: 'json',
        outputDir: '/invalid/path/that/cannot/exist',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
