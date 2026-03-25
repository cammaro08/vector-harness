import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeReportToJSON, readReportFromJSON } from '../jsonLogger';
import { EnforcementReport, createReport, addCheck } from '../enforcementReport';
import { mkdir, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('jsonLogger', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = join(tmpdir(), `json-logger-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory after each test
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('writeReportToJSON', () => {
    it('should write valid JSON file with correct structure', async () => {
      const report = createReport({
        id: 'test-001',
        blueprintName: 'test-blueprint',
        taskDescription: 'Test task',
        cwd: tempDir,
      });

      const result = await writeReportToJSON(report);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.filePath).toContain('enforcement-report.json');

        // Verify file exists and is valid JSON
        const content = await readFile(result.filePath, 'utf-8');
        const parsed = JSON.parse(content);

        expect(parsed).toHaveProperty('_meta');
        expect(parsed).toHaveProperty('report');
      }
    });

    it('should create default output dir at {cwd}/docs/enforcement-report.json', async () => {
      const report = createReport({
        id: 'test-001',
        blueprintName: 'test-blueprint',
        taskDescription: 'Test task',
        cwd: tempDir,
      });

      const result = await writeReportToJSON(report);

      expect(result.success).toBe(true);
      if (result.success) {
        const expectedPath = join(tempDir, 'docs', 'enforcement-report.json');
        expect(result.filePath).toBe(expectedPath);
      }
    });

    it('should create nested directories if they do not exist', async () => {
      const report = createReport({
        id: 'test-001',
        blueprintName: 'test-blueprint',
        taskDescription: 'Test task',
        cwd: tempDir,
      });

      const result = await writeReportToJSON(report);

      expect(result.success).toBe(true);
      if (result.success) {
        // Verify the directory structure was created
        const content = await readFile(result.filePath, 'utf-8');
        expect(content).toBeTruthy();
      }
    });

    it('should return absolute path', async () => {
      const report = createReport({
        id: 'test-001',
        blueprintName: 'test-blueprint',
        taskDescription: 'Test task',
        cwd: tempDir,
      });

      const result = await writeReportToJSON(report);

      expect(result.success).toBe(true);
      if (result.success) {
        // Absolute path should start with /
        expect(result.filePath).toMatch(/^\//);
      }
    });

    it('should overwrite previous report', async () => {
      const report1 = createReport({
        id: 'test-001',
        blueprintName: 'first-blueprint',
        taskDescription: 'First task',
        cwd: tempDir,
      });

      const result1 = await writeReportToJSON(report1);
      expect(result1.success).toBe(true);

      if (result1.success) {
        // Read first file
        const content1 = await readFile(result1.filePath, 'utf-8');
        const parsed1 = JSON.parse(content1);
        expect(parsed1.report.blueprintName).toBe('first-blueprint');

        // Write second report
        const report2 = createReport({
          id: 'test-002',
          blueprintName: 'second-blueprint',
          taskDescription: 'Second task',
          cwd: tempDir,
        });

        const result2 = await writeReportToJSON(report2);
        expect(result2.success).toBe(true);

        if (result2.success) {
          // Verify same path was used
          expect(result2.filePath).toBe(result1.filePath);

          // Verify content was overwritten
          const content2 = await readFile(result2.filePath, 'utf-8');
          const parsed2 = JSON.parse(content2);
          expect(parsed2.report.blueprintName).toBe('second-blueprint');
          expect(parsed2.report.id).toBe('test-002');
        }
      }
    });

    it('should include _meta with version 1.0.0', async () => {
      const report = createReport({
        id: 'test-001',
        blueprintName: 'test-blueprint',
        taskDescription: 'Test task',
        cwd: tempDir,
      });

      const result = await writeReportToJSON(report);

      expect(result.success).toBe(true);
      if (result.success) {
        const content = await readFile(result.filePath, 'utf-8');
        const parsed = JSON.parse(content);

        expect(parsed._meta.version).toBe('1.0.0');
        expect(parsed._meta.generator).toBe('vector-enforcer');
      }
    });

    it('should include generatedAt timestamp in _meta', async () => {
      const report = createReport({
        id: 'test-001',
        blueprintName: 'test-blueprint',
        taskDescription: 'Test task',
        cwd: tempDir,
      });

      const before = new Date().toISOString();
      const result = await writeReportToJSON(report);
      const after = new Date().toISOString();

      expect(result.success).toBe(true);
      if (result.success) {
        const content = await readFile(result.filePath, 'utf-8');
        const parsed = JSON.parse(content);

        expect(parsed._meta.generatedAt).toBeDefined();
        const generatedAt = parsed._meta.generatedAt;
        expect(generatedAt >= before).toBe(true);
        expect(generatedAt <= after).toBe(true);
      }
    });

    it('should use 2-space indentation', async () => {
      const report = createReport({
        id: 'test-001',
        blueprintName: 'test-blueprint',
        taskDescription: 'Test task',
        cwd: tempDir,
      });

      const result = await writeReportToJSON(report);

      expect(result.success).toBe(true);
      if (result.success) {
        const content = await readFile(result.filePath, 'utf-8');
        // Check for 2-space indentation pattern
        expect(content).toMatch(/\n  "/);
      }
    });

    it('should preserve all report fields in JSON', async () => {
      let report = createReport({
        id: 'test-001',
        blueprintName: 'test-blueprint',
        taskDescription: 'Test task',
        cwd: tempDir,
        gitBranch: 'main',
        gitCommit: 'abc123',
      });

      report = addCheck(report, {
        checkName: 'test-check',
        status: 'passed',
        duration: 100,
        details: {
          message: 'Check passed',
          issues: [],
        },
      });

      const result = await writeReportToJSON(report);

      expect(result.success).toBe(true);
      if (result.success) {
        const content = await readFile(result.filePath, 'utf-8');
        const parsed = JSON.parse(content);

        expect(parsed.report.id).toBe('test-001');
        expect(parsed.report.blueprintName).toBe('test-blueprint');
        expect(parsed.report.taskDescription).toBe('Test task');
        expect(parsed.report.environment.cwd).toBe(tempDir);
        expect(parsed.report.environment.gitBranch).toBe('main');
        expect(parsed.report.environment.gitCommit).toBe('abc123');
        expect(parsed.report.checks).toHaveLength(1);
        expect(parsed.report.checks[0].checkName).toBe('test-check');
      }
    });

    it('should write empty report without errors', async () => {
      const report = createReport({
        id: 'test-001',
        blueprintName: 'test-blueprint',
        taskDescription: 'Test task',
        cwd: tempDir,
      });

      const result = await writeReportToJSON(report);

      expect(result.success).toBe(true);
      if (result.success) {
        const content = await readFile(result.filePath, 'utf-8');
        const parsed = JSON.parse(content);

        expect(parsed.report.checks).toEqual([]);
        expect(parsed.report.retries).toEqual([]);
        expect(parsed.report.escalation).toBeUndefined();
      }
    });

    it('should accept custom outputDir option', async () => {
      const customDir = join(tempDir, 'custom', 'reports');
      const report = createReport({
        id: 'test-001',
        blueprintName: 'test-blueprint',
        taskDescription: 'Test task',
        cwd: tempDir,
      });

      const result = await writeReportToJSON(report, { outputDir: customDir });

      expect(result.success).toBe(true);
      if (result.success) {
        const expectedPath = join(customDir, 'enforcement-report.json');
        expect(result.filePath).toBe(expectedPath);

        // Verify file exists at custom location
        const content = await readFile(result.filePath, 'utf-8');
        expect(content).toBeTruthy();
      }
    });

    it('should return error result without throwing on permission error', async () => {
      const report = createReport({
        id: 'test-001',
        blueprintName: 'test-blueprint',
        taskDescription: 'Test task',
        cwd: '/nonexistent/path/that/cannot/be/created',
      });

      const result = await writeReportToJSON(report);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });
  });

  describe('readReportFromJSON', () => {
    it('should read previously written report', async () => {
      const report = createReport({
        id: 'test-001',
        blueprintName: 'test-blueprint',
        taskDescription: 'Test task',
        cwd: tempDir,
      });

      const writeResult = await writeReportToJSON(report);
      expect(writeResult.success).toBe(true);

      if (writeResult.success) {
        const readResult = await readReportFromJSON(writeResult.filePath);

        expect(readResult.success).toBe(true);
        if (readResult.success) {
          expect(readResult.report.id).toBe('test-001');
          expect(readResult.report.blueprintName).toBe('test-blueprint');
          expect(readResult.report.taskDescription).toBe('Test task');
        }
      }
    });

    it('should return error result for non-existent file', async () => {
      const nonExistentPath = join(tempDir, 'non-existent.json');

      const result = await readReportFromJSON(nonExistentPath);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should return error result for invalid JSON', async () => {
      const invalidJsonPath = join(tempDir, 'invalid.json');
      await mkdir(tempDir, { recursive: true });

      // Write invalid JSON
      const fs = await import('fs/promises');
      await fs.writeFile(invalidJsonPath, 'not valid json {]');

      const result = await readReportFromJSON(invalidJsonPath);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should extract report from envelope with _meta', async () => {
      const report = createReport({
        id: 'test-001',
        blueprintName: 'test-blueprint',
        taskDescription: 'Test task',
        cwd: tempDir,
      });

      const writeResult = await writeReportToJSON(report);
      expect(writeResult.success).toBe(true);

      if (writeResult.success) {
        const readResult = await readReportFromJSON(writeResult.filePath);

        expect(readResult.success).toBe(true);
        if (readResult.success) {
          // Verify it's an EnforcementReport, not the envelope
          expect(readResult.report).toHaveProperty('id');
          expect(readResult.report).toHaveProperty('blueprintName');
          expect(readResult.report).toHaveProperty('checks');
          expect(readResult.report).toHaveProperty('environment');
          expect((readResult.report as any)._meta).toBeUndefined();
        }
      }
    });

    it('should preserve report fields on read', async () => {
      let report = createReport({
        id: 'test-123',
        blueprintName: 'complex-blueprint',
        taskDescription: 'Complex task',
        cwd: tempDir,
        gitBranch: 'feature-branch',
        gitCommit: 'def456',
      });

      report = addCheck(report, {
        checkName: 'important-check',
        status: 'passed',
        duration: 250,
        details: {
          message: 'Check passed successfully',
          issues: [],
        },
      });

      const writeResult = await writeReportToJSON(report);
      expect(writeResult.success).toBe(true);

      if (writeResult.success) {
        const readResult = await readReportFromJSON(writeResult.filePath);

        expect(readResult.success).toBe(true);
        if (readResult.success) {
          const readReport = readResult.report;
          expect(readReport.id).toBe('test-123');
          expect(readReport.blueprintName).toBe('complex-blueprint');
          expect(readReport.taskDescription).toBe('Complex task');
          expect(readReport.environment.cwd).toBe(tempDir);
          expect(readReport.environment.gitBranch).toBe('feature-branch');
          expect(readReport.environment.gitCommit).toBe('def456');
          expect(readReport.checks).toHaveLength(1);
          expect(readReport.checks[0].checkName).toBe('important-check');
          expect(readReport.checks[0].status).toBe('passed');
          expect(readReport.checks[0].duration).toBe(250);
        }
      }
    });

    it('should return error without throwing on permission error', async () => {
      const readResult = await readReportFromJSON('/root/restricted.json');

      expect(readResult.success).toBe(false);
      if (!readResult.success) {
        expect(typeof readResult.error).toBe('string');
      }
    });
  });
});
