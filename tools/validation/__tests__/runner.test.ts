import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdir, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  runScenario,
  runAllScenarios,
  writeOutputArtifacts,
} from '../runner';
import {
  createReport,
  addCheck,
  finalize,
} from '../../enforcementReport';
import { ValidationScenario } from '../types';

describe('validation runner', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for this test
    const randomId = Math.random().toString(36).substring(7);
    tempDir = join(tmpdir(), `vector-validation-test-${randomId}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('runScenario', () => {
    it('should process a single scenario through all renderers', async () => {
      const mockScenario: ValidationScenario = {
        id: 'test-scenario',
        description: 'Test scenario for runner',
        tags: ['test'],
        buildReport: (cwd) => {
          let report = createReport({
            id: 'test-001',
            blueprintName: 'test-bp',
            taskDescription: 'test task',
            cwd,
          });
          report = addCheck(report, {
            checkName: 'check-1',
            status: 'passed',
            duration: 10,
          });
          return finalize(report);
        },
      };

      const output = await runScenario(mockScenario, tempDir);

      expect(output.scenarioId).toBe('test-scenario');
      expect(output.description).toBe('Test scenario for runner');
      expect(output.verdict).toBe('pass');
      expect(output.terminal).toBeTruthy();
      expect(output.terminal).not.toContain('\x1b[');
      expect(output.terminalColored).toBeTruthy();
      expect(output.json).toBeTruthy();
      expect(output.markdown).toBeTruthy();
      expect(output.markdown).toContain('Vector Enforcement Report');
    });

    it('should set verdict to fail when report has failed checks', async () => {
      const mockScenario: ValidationScenario = {
        id: 'fail-scenario',
        description: 'Failing scenario',
        tags: ['test'],
        buildReport: (cwd) => {
          let report = createReport({
            id: 'test-002',
            blueprintName: 'test-bp',
            taskDescription: 'test task',
            cwd,
          });
          report = addCheck(report, {
            checkName: 'check-1',
            status: 'failed',
            duration: 10,
          });
          return finalize(report);
        },
      };

      const output = await runScenario(mockScenario, tempDir);

      expect(output.verdict).toBe('fail');
    });

    it('should include colored ANSI codes in terminalColored output', async () => {
      const mockScenario: ValidationScenario = {
        id: 'test-scenario',
        description: 'Test scenario',
        tags: ['test'],
        buildReport: (cwd) => {
          let report = createReport({
            id: 'test-003',
            blueprintName: 'test-bp',
            taskDescription: 'test task',
            cwd,
          });
          report = addCheck(report, {
            checkName: 'check-1',
            status: 'passed',
            duration: 10,
          });
          return finalize(report);
        },
      };

      const output = await runScenario(mockScenario, tempDir);

      // terminalColored should have ANSI codes
      expect(output.terminalColored).toContain('\x1b[');
      // terminal should NOT have ANSI codes
      expect(output.terminal).not.toContain('\x1b[');
    });
  });

  describe('runAllScenarios', () => {
    it('should process multiple scenarios and return ValidationRunResult', async () => {
      const scenarios: ValidationScenario[] = [
        {
          id: 'scenario-1',
          description: 'Scenario 1',
          tags: ['smoke'],
          buildReport: (cwd) => {
            let report = createReport({
              id: 'test-1',
              blueprintName: 'bp-1',
              taskDescription: 'task 1',
              cwd,
            });
            report = addCheck(report, {
              checkName: 'check-1',
              status: 'passed',
              duration: 10,
            });
            return finalize(report);
          },
        },
        {
          id: 'scenario-2',
          description: 'Scenario 2',
          tags: ['smoke', 'integration'],
          buildReport: (cwd) => {
            let report = createReport({
              id: 'test-2',
              blueprintName: 'bp-2',
              taskDescription: 'task 2',
              cwd,
            });
            report = addCheck(report, {
              checkName: 'check-1',
              status: 'failed',
              duration: 20,
            });
            return finalize(report);
          },
        },
      ];

      const result = await runAllScenarios(scenarios, tempDir);

      expect(result.scenarios.length).toBe(2);
      expect(result.summary.total).toBe(2);
      expect(result.summary.passed).toBe(1);
      expect(result.summary.failed).toBe(1);
      expect(result.timestamp).toBeTruthy();
    });

    it('should aggregate tags correctly in summary', async () => {
      const scenarios: ValidationScenario[] = [
        {
          id: 'scenario-1',
          description: 'Scenario 1',
          tags: ['smoke'],
          buildReport: (cwd) => {
            let report = createReport({
              id: 'test-1',
              blueprintName: 'bp-1',
              taskDescription: 'task 1',
              cwd,
            });
            report = addCheck(report, {
              checkName: 'check-1',
              status: 'passed',
              duration: 10,
            });
            return finalize(report);
          },
        },
        {
          id: 'scenario-2',
          description: 'Scenario 2',
          tags: ['smoke', 'integration'],
          buildReport: (cwd) => {
            let report = createReport({
              id: 'test-2',
              blueprintName: 'bp-2',
              taskDescription: 'task 2',
              cwd,
            });
            report = addCheck(report, {
              checkName: 'check-1',
              status: 'passed',
              duration: 20,
            });
            return finalize(report);
          },
        },
      ];

      const result = await runAllScenarios(scenarios, tempDir);

      expect(result.summary.tags.smoke).toBe(2);
      expect(result.summary.tags.integration).toBe(1);
    });

    it('should handle empty scenarios array', async () => {
      const result = await runAllScenarios([], tempDir);

      expect(result.scenarios.length).toBe(0);
      expect(result.summary.total).toBe(0);
      expect(result.summary.passed).toBe(0);
      expect(result.summary.failed).toBe(0);
      expect(Object.keys(result.summary.tags).length).toBe(0);
    });
  });

  describe('writeOutputArtifacts', () => {
    it('should create all expected files in output directory', async () => {
      const scenarios: ValidationScenario[] = [
        {
          id: 'scenario-1',
          description: 'Scenario 1',
          tags: ['test'],
          buildReport: (cwd) => {
            let report = createReport({
              id: 'test-1',
              blueprintName: 'bp-1',
              taskDescription: 'task 1',
              cwd,
            });
            report = addCheck(report, {
              checkName: 'check-1',
              status: 'passed',
              duration: 10,
            });
            return finalize(report);
          },
        },
      ];

      const result = await runAllScenarios(scenarios, tempDir);
      const outputDir = join(tempDir, 'artifacts');

      await writeOutputArtifacts(result, outputDir);

      // Check for summary.txt
      const summaryPath = join(outputDir, 'summary.txt');
      const summaryContent = await readFile(summaryPath, 'utf-8');
      expect(summaryContent).toBeTruthy();
      expect(summaryContent).toContain('Validation Run Summary');

      // Check for validation-run.json
      const runJsonPath = join(outputDir, 'validation-run.json');
      const runJsonContent = await readFile(runJsonPath, 'utf-8');
      const runJson = JSON.parse(runJsonContent);
      expect(runJson.summary.total).toBe(1);
    });

    it('should create nested scenario directories', async () => {
      const scenarios: ValidationScenario[] = [
        {
          id: 'scenario-1',
          description: 'Scenario 1',
          tags: ['test'],
          buildReport: (cwd) => {
            let report = createReport({
              id: 'test-1',
              blueprintName: 'bp-1',
              taskDescription: 'task 1',
              cwd,
            });
            report = addCheck(report, {
              checkName: 'check-1',
              status: 'passed',
              duration: 10,
            });
            return finalize(report);
          },
        },
      ];

      const result = await runAllScenarios(scenarios, tempDir);
      const outputDir = join(tempDir, 'artifacts');

      await writeOutputArtifacts(result, outputDir);

      // Check for scenario files
      const scenarioDir = join(outputDir, 'scenarios', 'scenario-1');
      const terminalPath = join(scenarioDir, 'terminal.txt');
      const terminalColoredPath = join(scenarioDir, 'terminal-colored.txt');
      const reportJsonPath = join(scenarioDir, 'report.json');
      const prCommentPath = join(scenarioDir, 'pr-comment.md');

      const terminal = await readFile(terminalPath, 'utf-8');
      const terminalColored = await readFile(terminalColoredPath, 'utf-8');
      const reportJson = await readFile(reportJsonPath, 'utf-8');
      const prComment = await readFile(prCommentPath, 'utf-8');

      expect(terminal).toBeTruthy();
      expect(terminalColored).toBeTruthy();
      expect(reportJson).toBeTruthy();
      expect(prComment).toBeTruthy();
    });

    it('should write scenario outputs without ANSI codes in plain terminal file', async () => {
      const scenarios: ValidationScenario[] = [
        {
          id: 'test-scenario',
          description: 'Test Scenario',
          tags: ['test'],
          buildReport: (cwd) => {
            let report = createReport({
              id: 'test-1',
              blueprintName: 'bp-1',
              taskDescription: 'task 1',
              cwd,
            });
            report = addCheck(report, {
              checkName: 'check-1',
              status: 'passed',
              duration: 10,
            });
            return finalize(report);
          },
        },
      ];

      const result = await runAllScenarios(scenarios, tempDir);
      const outputDir = join(tempDir, 'artifacts');

      await writeOutputArtifacts(result, outputDir);

      const terminalPath = join(outputDir, 'scenarios', 'test-scenario', 'terminal.txt');
      const terminal = await readFile(terminalPath, 'utf-8');
      expect(terminal).not.toContain('\x1b[');
    });
  });
});
