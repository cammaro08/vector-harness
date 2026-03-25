import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  reportEnforcementResults,
  ReporterOptions,
} from '../reporter';
import {
  EnforcementReport,
  createReport,
  addCheck,
  finalize,
} from '../../../../tools/enforcementReport';
import * as terminalReporter from '../../../../tools/terminalReporter';
import * as jsonLogger from '../../../../tools/jsonLogger';
import * as ghPrCommenter from '../../../../tools/ghPrCommenter';

// Mock the individual renderer modules
vi.mock('../../../../tools/terminalReporter', () => ({
  writeToTerminal: vi.fn(),
}));

vi.mock('../../../../tools/jsonLogger', () => ({
  writeReportToJSON: vi.fn(),
}));

vi.mock('../../../../tools/ghPrCommenter', () => ({
  detectPRContext: vi.fn(),
  renderMarkdown: vi.fn(),
  postPRComment: vi.fn(),
}));

describe('Reporter Integration', () => {
  let mockReport: EnforcementReport;

  beforeEach(() => {
    // Create a sample report
    mockReport = createReport({
      id: 'test-report-1',
      blueprintName: 'test-blueprint',
      taskDescription: 'Test task',
      cwd: '/test/project',
      gitBranch: 'main',
      gitCommit: 'abc123',
    });

    // Add a passing check
    mockReport = addCheck(mockReport, {
      checkName: 'validation-check',
      status: 'passed',
      duration: 100,
      details: {
        message: 'All good',
      },
    });

    // Finalize the report
    mockReport = finalize(mockReport);

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('Integration Flow: All Renderers', () => {
    it('should call all three renderers when all are enabled', async () => {
      // Mock successful responses
      (terminalReporter.writeToTerminal as any).mockReturnValue(undefined);
      (jsonLogger.writeReportToJSON as any).mockResolvedValue({
        success: true,
        filePath: '/test/project/docs/enforcement-report.json',
      });
      (ghPrCommenter.detectPRContext as any).mockReturnValue({
        prNumber: 42,
        branch: 'refs/pull/42/merge',
      });
      (ghPrCommenter.renderMarkdown as any).mockReturnValue('## Report');
      (ghPrCommenter.postPRComment as any).mockResolvedValue({
        posted: true,
        markdown: '## Report',
      });

      const result = await reportEnforcementResults(mockReport, {
        cwd: '/test/project',
        enableTerminal: true,
        enableJSON: true,
        enablePRComment: true,
      });

      expect(result.terminal).toBe(true);
      expect(result.jsonPath).toBe('/test/project/docs/enforcement-report.json');
      expect(result.prComment?.posted).toBe(true);
      expect(terminalReporter.writeToTerminal).toHaveBeenCalledWith(mockReport);
      expect(jsonLogger.writeReportToJSON).toHaveBeenCalledWith(mockReport, {
        outputDir: 'docs',
      });
    });

    it('should have terminal default to true', async () => {
      (terminalReporter.writeToTerminal as any).mockReturnValue(undefined);
      (jsonLogger.writeReportToJSON as any).mockResolvedValue({
        success: true,
        filePath: '/test/project/docs/enforcement-report.json',
      });
      (ghPrCommenter.detectPRContext as any).mockReturnValue(null);

      await reportEnforcementResults(mockReport, {
        cwd: '/test/project',
      });

      expect(terminalReporter.writeToTerminal).toHaveBeenCalled();
    });

    it('should have JSON default to true', async () => {
      (terminalReporter.writeToTerminal as any).mockReturnValue(undefined);
      (jsonLogger.writeReportToJSON as any).mockResolvedValue({
        success: true,
        filePath: '/test/project/docs/enforcement-report.json',
      });
      (ghPrCommenter.detectPRContext as any).mockReturnValue(null);

      await reportEnforcementResults(mockReport, {
        cwd: '/test/project',
      });

      expect(jsonLogger.writeReportToJSON).toHaveBeenCalled();
    });

    it('should have PR comment default to true but skip if no PR context', async () => {
      (terminalReporter.writeToTerminal as any).mockReturnValue(undefined);
      (jsonLogger.writeReportToJSON as any).mockResolvedValue({
        success: true,
        filePath: '/test/project/docs/enforcement-report.json',
      });
      (ghPrCommenter.detectPRContext as any).mockReturnValue(null);

      const result = await reportEnforcementResults(mockReport, {
        cwd: '/test/project',
      });

      expect(result.prComment).toBeNull();
      expect(ghPrCommenter.postPRComment).not.toHaveBeenCalled();
    });
  });

  describe('Renderer Isolation: Failures', () => {
    it('should continue if terminal fails (non-blocking)', async () => {
      (terminalReporter.writeToTerminal as any).mockImplementation(() => {
        throw new Error('Terminal write failed');
      });
      (jsonLogger.writeReportToJSON as any).mockResolvedValue({
        success: true,
        filePath: '/test/project/docs/enforcement-report.json',
      });
      (ghPrCommenter.detectPRContext as any).mockReturnValue(null);

      const result = await reportEnforcementResults(mockReport, {
        cwd: '/test/project',
        enableTerminal: true,
        enableJSON: true,
      });

      expect(result.terminal).toBe(false);
      expect(result.jsonPath).toBe('/test/project/docs/enforcement-report.json');
    });

    it('should continue if JSON fails (non-blocking)', async () => {
      (terminalReporter.writeToTerminal as any).mockReturnValue(undefined);
      (jsonLogger.writeReportToJSON as any).mockResolvedValue({
        success: false,
        error: 'Failed to write file',
      });
      (ghPrCommenter.detectPRContext as any).mockReturnValue(null);

      const result = await reportEnforcementResults(mockReport, {
        cwd: '/test/project',
        enableTerminal: true,
        enableJSON: true,
      });

      expect(result.terminal).toBe(true);
      expect(result.jsonPath).toBeNull();
    });

    it('should continue if PR comment fails (non-blocking)', async () => {
      (terminalReporter.writeToTerminal as any).mockReturnValue(undefined);
      (jsonLogger.writeReportToJSON as any).mockResolvedValue({
        success: true,
        filePath: '/test/project/docs/enforcement-report.json',
      });
      (ghPrCommenter.detectPRContext as any).mockReturnValue({
        prNumber: 42,
        branch: 'refs/pull/42/merge',
      });
      (ghPrCommenter.renderMarkdown as any).mockReturnValue('## Report');
      (ghPrCommenter.postPRComment as any).mockResolvedValue({
        posted: false,
        markdown: '## Report',
        error: 'API rate limit exceeded',
      });

      const result = await reportEnforcementResults(mockReport, {
        cwd: '/test/project',
        enablePRComment: true,
      });

      expect(result.terminal).toBe(true);
      expect(result.prComment?.posted).toBe(false);
      expect(result.prComment?.error).toBe('API rate limit exceeded');
    });

    it('should handle multiple failures independently', async () => {
      (terminalReporter.writeToTerminal as any).mockImplementation(() => {
        throw new Error('Terminal failed');
      });
      (jsonLogger.writeReportToJSON as any).mockResolvedValue({
        success: false,
        error: 'JSON failed',
      });
      (ghPrCommenter.detectPRContext as any).mockReturnValue({
        prNumber: 42,
        branch: 'refs/pull/42/merge',
      });
      (ghPrCommenter.renderMarkdown as any).mockReturnValue('## Report');
      (ghPrCommenter.postPRComment as any).mockResolvedValue({
        posted: true,
        markdown: '## Report',
      });

      const result = await reportEnforcementResults(mockReport, {
        cwd: '/test/project',
        enableTerminal: true,
        enableJSON: true,
        enablePRComment: true,
      });

      // All three independently succeed or fail
      expect(result.terminal).toBe(false);
      expect(result.jsonPath).toBeNull();
      expect(result.prComment?.posted).toBe(true);
    });
  });

  describe('Configuration: Disabling Renderers', () => {
    it('should skip terminal when disabled', async () => {
      (jsonLogger.writeReportToJSON as any).mockResolvedValue({
        success: true,
        filePath: '/test/project/docs/enforcement-report.json',
      });
      (ghPrCommenter.detectPRContext as any).mockReturnValue(null);

      const result = await reportEnforcementResults(mockReport, {
        cwd: '/test/project',
        enableTerminal: false,
        enableJSON: true,
      });

      expect(terminalReporter.writeToTerminal).not.toHaveBeenCalled();
      expect(result.terminal).toBe(false);
      expect(result.jsonPath).toBe('/test/project/docs/enforcement-report.json');
    });

    it('should skip JSON when disabled', async () => {
      (terminalReporter.writeToTerminal as any).mockReturnValue(undefined);
      (ghPrCommenter.detectPRContext as any).mockReturnValue(null);

      const result = await reportEnforcementResults(mockReport, {
        cwd: '/test/project',
        enableTerminal: true,
        enableJSON: false,
      });

      expect(jsonLogger.writeReportToJSON).not.toHaveBeenCalled();
      expect(result.jsonPath).toBeNull();
      expect(result.terminal).toBe(true);
    });

    it('should skip PR comment when disabled', async () => {
      (terminalReporter.writeToTerminal as any).mockReturnValue(undefined);
      (jsonLogger.writeReportToJSON as any).mockResolvedValue({
        success: true,
        filePath: '/test/project/docs/enforcement-report.json',
      });
      (ghPrCommenter.detectPRContext as any).mockReturnValue({
        prNumber: 42,
        branch: 'refs/pull/42/merge',
      });

      const result = await reportEnforcementResults(mockReport, {
        cwd: '/test/project',
        enablePRComment: false,
      });

      expect(ghPrCommenter.postPRComment).not.toHaveBeenCalled();
      expect(result.prComment).toBeNull();
    });

    it('should respect custom jsonOutputDir', async () => {
      (terminalReporter.writeToTerminal as any).mockReturnValue(undefined);
      (jsonLogger.writeReportToJSON as any).mockResolvedValue({
        success: true,
        filePath: '/custom/dir/enforcement-report.json',
      });
      (ghPrCommenter.detectPRContext as any).mockReturnValue(null);

      await reportEnforcementResults(mockReport, {
        cwd: '/test/project',
        jsonOutputDir: '/custom/dir',
      });

      expect(jsonLogger.writeReportToJSON).toHaveBeenCalledWith(mockReport, {
        outputDir: '/custom/dir',
      });
    });
  });

  describe('PR Comment Configuration', () => {
    it('should use dryRun mode for PR comment', async () => {
      (terminalReporter.writeToTerminal as any).mockReturnValue(undefined);
      (jsonLogger.writeReportToJSON as any).mockResolvedValue({
        success: true,
        filePath: '/test/project/docs/enforcement-report.json',
      });
      (ghPrCommenter.detectPRContext as any).mockReturnValue({
        prNumber: 42,
        branch: 'refs/pull/42/merge',
      });
      (ghPrCommenter.renderMarkdown as any).mockReturnValue('## Report');
      (ghPrCommenter.postPRComment as any).mockResolvedValue({
        posted: false,
        markdown: '## Report',
      });

      await reportEnforcementResults(mockReport, {
        cwd: '/test/project',
        dryRun: true,
        enablePRComment: true,
      });

      expect(ghPrCommenter.postPRComment).toHaveBeenCalledWith({
        prNumber: 42,
        body: '## Report',
        dryRun: true,
      });
    });

    it('should not use dryRun mode when not set', async () => {
      (terminalReporter.writeToTerminal as any).mockReturnValue(undefined);
      (jsonLogger.writeReportToJSON as any).mockResolvedValue({
        success: true,
        filePath: '/test/project/docs/enforcement-report.json',
      });
      (ghPrCommenter.detectPRContext as any).mockReturnValue({
        prNumber: 42,
        branch: 'refs/pull/42/merge',
      });
      (ghPrCommenter.renderMarkdown as any).mockReturnValue('## Report');
      (ghPrCommenter.postPRComment as any).mockResolvedValue({
        posted: true,
        markdown: '## Report',
      });

      await reportEnforcementResults(mockReport, {
        cwd: '/test/project',
        dryRun: false,
        enablePRComment: true,
      });

      expect(ghPrCommenter.postPRComment).toHaveBeenCalledWith({
        prNumber: 42,
        body: '## Report',
        dryRun: false,
      });
    });
  });

  describe('Full Pipeline: Report Building and Reporting', () => {
    it('should handle full pipeline from report creation to reporting', async () => {
      // Build a report from scratch
      let report = createReport({
        id: 'full-test',
        blueprintName: 'end-to-end',
        taskDescription: 'Test full pipeline',
        cwd: '/test/project',
        gitBranch: 'feature/test',
        gitCommit: 'def456',
      });

      // Add multiple checks
      report = addCheck(report, {
        checkName: 'unit-tests',
        status: 'passed',
        duration: 150,
      });

      report = addCheck(report, {
        checkName: 'integration-tests',
        status: 'passed',
        duration: 300,
      });

      report = addCheck(report, {
        checkName: 'linting',
        status: 'failed',
        duration: 50,
        details: {
          message: 'Found linting issues',
          issues: ['unused variable', 'trailing space'],
        },
      });

      // Finalize
      report = finalize(report);

      expect(report.verdict).toBe('fail');
      expect(report.checks).toHaveLength(3);
      expect(report.totalDuration).toBe(500);

      // Mock renderers
      (terminalReporter.writeToTerminal as any).mockReturnValue(undefined);
      (jsonLogger.writeReportToJSON as any).mockResolvedValue({
        success: true,
        filePath: '/test/project/docs/enforcement-report.json',
      });
      (ghPrCommenter.detectPRContext as any).mockReturnValue({
        prNumber: 99,
        branch: 'refs/pull/99/merge',
      });
      (ghPrCommenter.renderMarkdown as any).mockReturnValue('## Enforcement Report');
      (ghPrCommenter.postPRComment as any).mockResolvedValue({
        posted: true,
        markdown: '## Enforcement Report',
      });

      // Report the results
      const result = await reportEnforcementResults(report, {
        cwd: '/test/project',
        enableTerminal: true,
        enableJSON: true,
        enablePRComment: true,
      });

      // Verify all three were called
      expect(terminalReporter.writeToTerminal).toHaveBeenCalledWith(report);
      expect(jsonLogger.writeReportToJSON).toHaveBeenCalledWith(report, {
        outputDir: 'docs',
      });
      expect(ghPrCommenter.postPRComment).toHaveBeenCalled();
      expect(result.terminal).toBe(true);
      expect(result.jsonPath).toBe('/test/project/docs/enforcement-report.json');
      expect(result.prComment?.posted).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('should provide sensible defaults for all options', async () => {
      (terminalReporter.writeToTerminal as any).mockReturnValue(undefined);
      (jsonLogger.writeReportToJSON as any).mockResolvedValue({
        success: true,
        filePath: '/test/project/docs/enforcement-report.json',
      });
      (ghPrCommenter.detectPRContext as any).mockReturnValue(null);

      const result = await reportEnforcementResults(mockReport, {
        cwd: '/test/project',
      });

      // Verify defaults are applied
      expect(result.terminal).toBe(true); // enableTerminal defaults to true
      expect(result.jsonPath).toBe('/test/project/docs/enforcement-report.json'); // enableJSON defaults to true
      expect(result.prComment).toBeNull(); // enablePRComment defaults to true but no PR context
    });

    it('should return result object with expected structure', async () => {
      (terminalReporter.writeToTerminal as any).mockReturnValue(undefined);
      (jsonLogger.writeReportToJSON as any).mockResolvedValue({
        success: false,
        error: 'Write failed',
      });
      (ghPrCommenter.detectPRContext as any).mockReturnValue(null);

      const result = await reportEnforcementResults(mockReport, {
        cwd: '/test/project',
      });

      expect(result).toHaveProperty('terminal');
      expect(result).toHaveProperty('jsonPath');
      expect(result).toHaveProperty('prComment');
      expect(typeof result.terminal).toBe('boolean');
      expect(result.jsonPath === null || typeof result.jsonPath === 'string').toBe(true);
      expect(result.prComment === null || typeof result.prComment === 'object').toBe(true);
    });
  });
});
