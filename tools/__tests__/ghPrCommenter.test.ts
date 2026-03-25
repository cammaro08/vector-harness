import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'child_process';
import {
  detectPRContext,
  renderMarkdown,
  postPRComment,
} from '../ghPrCommenter';
import { EnforcementReport } from '../enforcementReport';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('ghPrCommenter', () => {
  describe('detectPRContext', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      vi.clearAllMocks();
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should detect PR from GITHUB_REF environment variable', () => {
      process.env.GITHUB_REF = 'refs/pull/123/merge';

      const result = detectPRContext();

      expect(result).not.toBeNull();
      expect(result?.prNumber).toBe(123);
      expect(result?.branch).toBeDefined();
    });

    it('should detect PR from gh CLI when GITHUB_REF is not set', () => {
      delete process.env.GITHUB_REF;
      vi.mocked(execSync).mockReturnValue('456');

      const result = detectPRContext();

      expect(result).not.toBeNull();
      expect(result?.prNumber).toBe(456);
      expect(execSync).toHaveBeenCalledWith(
        "gh pr view --json number --jq '.number'",
        { encoding: 'utf-8' }
      );
    });

    it('should return null when both GITHUB_REF and gh CLI fail', () => {
      delete process.env.GITHUB_REF;
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('gh not found');
      });

      const result = detectPRContext();

      expect(result).toBeNull();
    });

    it('should return null when GITHUB_REF does not match PR pattern', () => {
      process.env.GITHUB_REF = 'refs/heads/main';
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Not in a PR');
      });

      const result = detectPRContext();

      expect(result).toBeNull();
    });

    it('should parse PR number correctly from refs/pull/789/merge', () => {
      process.env.GITHUB_REF = 'refs/pull/789/merge';

      const result = detectPRContext();

      expect(result?.prNumber).toBe(789);
    });
  });

  describe('renderMarkdown', () => {
    it('should render a basic passing report', () => {
      const report: EnforcementReport = {
        id: 'test-1',
        blueprintName: 'implement-feature',
        taskDescription: 'Add DELETE /users/:id endpoint',
        verdict: 'pass',
        checks: [
          {
            checkName: 'commit-message',
            status: 'passed',
            duration: 12,
          },
          {
            checkName: 'tests-exist',
            status: 'passed',
            duration: 38,
          },
        ],
        retries: [],
        timestamp: '2024-01-15T10:30:00Z',
        totalDuration: 50,
        environment: {
          cwd: '/project',
          gitBranch: 'feat/delete-endpoint',
        },
      };

      const markdown = renderMarkdown(report);

      expect(markdown).toContain('## Vector Enforcement Report');
      expect(markdown).toContain('**Blueprint:** implement-feature');
      expect(markdown).toContain('**Task:** Add DELETE /users/:id endpoint');
      expect(markdown).toContain('commit-message');
      expect(markdown).toContain('tests-exist');
      expect(markdown).toContain(':white_check_mark:');
      expect(markdown).toContain('**Verdict: PASS**');
      expect(markdown).toContain('50ms total');
    });

    it('should render a failing report with escalation', () => {
      const report: EnforcementReport = {
        id: 'test-2',
        blueprintName: 'implement-feature',
        taskDescription: 'Add feature',
        verdict: 'fail',
        checks: [
          {
            checkName: 'linter',
            status: 'failed',
            duration: 100,
            details: {
              message: 'Linting failed',
              issues: ['Unused variable on line 42', 'Missing semicolon on line 57'],
            },
          },
        ],
        retries: [],
        escalation: {
          reason: 'Critical linting issues found',
          suggestion: 'Fix all linting errors and try again',
          failedCheckName: 'linter',
        },
        timestamp: '2024-01-15T10:30:00Z',
        totalDuration: 100,
        environment: {
          cwd: '/project',
        },
      };

      const markdown = renderMarkdown(report);

      expect(markdown).toContain('**Verdict: FAIL**');
      expect(markdown).toContain(':x:');
      expect(markdown).toContain('Critical linting issues found');
      expect(markdown).toContain('Fix all linting errors and try again');
    });

    it('should render retry details in collapsible section', () => {
      const report: EnforcementReport = {
        id: 'test-3',
        blueprintName: 'implement-feature',
        taskDescription: 'Add feature',
        verdict: 'pass',
        checks: [
          {
            checkName: 'tests-exist',
            status: 'passed',
            duration: 38,
            details: {
              message: 'Retry #2',
            },
          },
        ],
        retries: [
          {
            checkName: 'tests-exist',
            totalAttempts: 2,
            succeededAtAttempt: 2,
            finalStatus: 'passed',
            attemptHistory: [
              {
                attemptNumber: 1,
                status: 'failed',
                duration: 45,
                error: 'Missing test file',
              },
              {
                attemptNumber: 2,
                status: 'passed',
                duration: 38,
              },
            ],
          },
        ],
        timestamp: '2024-01-15T10:30:00Z',
        totalDuration: 83,
        environment: {
          cwd: '/project',
        },
      };

      const markdown = renderMarkdown(report);

      expect(markdown).toContain('<details>');
      expect(markdown).toContain('<summary>Retry Details');
      expect(markdown).toContain('1 retry');
      expect(markdown).toContain('tests-exist');
      expect(markdown).toContain('Missing test file');
      expect(markdown).toContain('</details>');
    });

    it('should render multiple retries', () => {
      const report: EnforcementReport = {
        id: 'test-4',
        blueprintName: 'implement-feature',
        taskDescription: 'Add feature',
        verdict: 'pass',
        checks: [
          {
            checkName: 'test1',
            status: 'passed',
            duration: 10,
          },
          {
            checkName: 'test2',
            status: 'passed',
            duration: 20,
          },
        ],
        retries: [
          {
            checkName: 'test1',
            totalAttempts: 2,
            succeededAtAttempt: 2,
            finalStatus: 'passed',
            attemptHistory: [
              {
                attemptNumber: 1,
                status: 'failed',
                duration: 5,
              },
              {
                attemptNumber: 2,
                status: 'passed',
                duration: 10,
              },
            ],
          },
          {
            checkName: 'test2',
            totalAttempts: 3,
            succeededAtAttempt: 3,
            finalStatus: 'passed',
            attemptHistory: [
              {
                attemptNumber: 1,
                status: 'failed',
                duration: 5,
              },
              {
                attemptNumber: 2,
                status: 'failed',
                duration: 8,
              },
              {
                attemptNumber: 3,
                status: 'passed',
                duration: 20,
              },
            ],
          },
        ],
        timestamp: '2024-01-15T10:30:00Z',
        totalDuration: 30,
        environment: {
          cwd: '/project',
        },
      };

      const markdown = renderMarkdown(report);

      expect(markdown).toContain('2 retries');
      expect(markdown).toContain('test1');
      expect(markdown).toContain('test2');
    });

    it('should handle empty checks', () => {
      const report: EnforcementReport = {
        id: 'test-5',
        blueprintName: 'test-blueprint',
        taskDescription: 'Test task',
        verdict: 'pass',
        checks: [],
        retries: [],
        timestamp: '2024-01-15T10:30:00Z',
        totalDuration: 0,
        environment: {
          cwd: '/project',
        },
      };

      const markdown = renderMarkdown(report);

      expect(markdown).toContain('## Vector Enforcement Report');
      expect(markdown).toContain('**Verdict: PASS**');
    });

    it('should include check details when present', () => {
      const report: EnforcementReport = {
        id: 'test-6',
        blueprintName: 'implement-feature',
        taskDescription: 'Add feature',
        verdict: 'pass',
        checks: [
          {
            checkName: 'coverage',
            status: 'passed',
            duration: 120,
            details: {
              message: 'Coverage: 95%',
              issues: [],
            },
          },
        ],
        retries: [],
        timestamp: '2024-01-15T10:30:00Z',
        totalDuration: 120,
        environment: {
          cwd: '/project',
        },
      };

      const markdown = renderMarkdown(report);

      expect(markdown).toContain('Coverage: 95%');
    });
  });

  describe('postPRComment', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should post a comment successfully', async () => {
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockReturnValue('123\n');

      const result = await postPRComment({
        prNumber: 123,
        body: '## Test comment',
      });

      expect(result.posted).toBe(true);
      expect(result.markdown).toBe('## Test comment');
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('gh pr comment'),
        expect.any(Object)
      );
    });

    it('should return false when gh command fails', async () => {
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockImplementation(() => {
        throw new Error('gh: not found');
      });

      const result = await postPRComment({
        prNumber: 123,
        body: '## Test comment',
      });

      expect(result.posted).toBe(false);
      expect(result.markdown).toBe('## Test comment');
      expect(result.error).toBeDefined();
    });

    it('should skip posting in dry run mode', async () => {
      const mockExecSync = vi.mocked(execSync);

      const result = await postPRComment({
        prNumber: 123,
        body: '## Test comment',
        dryRun: true,
      });

      expect(result.posted).toBe(false);
      expect(result.markdown).toBe('## Test comment');
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should truncate and add note when body exceeds 65536 chars', async () => {
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockReturnValue('456\n');

      const longBody = 'a'.repeat(70000);

      const result = await postPRComment({
        prNumber: 456,
        body: longBody,
      });

      expect(result.markdown.length).toBeLessThanOrEqual(65536);
      expect(result.markdown).toContain('truncated');
      expect(result.posted).toBe(true);
    });

    it('should pass prNumber to gh command', async () => {
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockReturnValue('789\n');

      await postPRComment({
        prNumber: 789,
        body: 'Test',
      });

      const callArg = mockExecSync.mock.calls[0][0] as string;
      expect(callArg).toContain('789');
    });
  });
});
