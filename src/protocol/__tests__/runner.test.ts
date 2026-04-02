import { describe, it, expect, vi } from 'vitest';
import { runCheck } from '../runner';
import type { CheckDefinition } from '../../config/schema';

describe('runCheck', () => {
  describe('passing checks', () => {
    it('should mark check as passed when exit code is 0', async () => {
      const definition: CheckDefinition = {
        run: 'exit 0',
        expect: 'exit-0',
        enabled: true,
      };

      const result = await runCheck({
        name: 'test-check',
        definition,
        timeout: 5000,
      });

      expect(result.checkResult.status).toBe('passed');
      expect(result.checkResult.checkName).toBe('test-check');
      expect(result.checkResult.duration).toBeGreaterThanOrEqual(0);
    });

    it('should execute echo command and pass', async () => {
      const definition: CheckDefinition = {
        run: 'echo "hello"',
        expect: 'exit-0',
        enabled: true,
      };

      const result = await runCheck({
        name: 'echo-check',
        definition,
        timeout: 5000,
      });

      expect(result.checkResult.status).toBe('passed');
    });
  });

  describe('failing checks', () => {
    it('should mark check as failed when exit code is non-zero', async () => {
      const definition: CheckDefinition = {
        run: 'exit 1',
        expect: 'exit-0',
        enabled: true,
      };

      const result = await runCheck({
        name: 'failing-check',
        definition,
        timeout: 5000,
      });

      expect(result.checkResult.status).toBe('failed');
      expect(result.checkResult.checkName).toBe('failing-check');
      expect(result.checkResult.duration).toBeGreaterThanOrEqual(0);
    });

    it('should capture failure details', async () => {
      const definition: CheckDefinition = {
        run: 'exit 127',
        expect: 'exit-0',
        enabled: true,
      };

      const result = await runCheck({
        name: 'fail-with-details',
        definition,
        timeout: 5000,
      });

      expect(result.checkResult.status).toBe('failed');
      expect(result.checkResult.details).toBeDefined();
      expect(result.checkResult.details?.message).toBeDefined();
    });
  });

  describe('output capture', () => {
    it('should capture stdout when capture is stdout', async () => {
      const definition: CheckDefinition = {
        run: 'echo "test output"',
        expect: 'exit-0',
        enabled: true,
        capture: 'stdout',
      };

      const result = await runCheck({
        name: 'stdout-capture',
        definition,
        timeout: 5000,
      });

      expect(result.stdout).toContain('test output');
    });

    it('should capture stderr when capture is stderr', async () => {
      const definition: CheckDefinition = {
        run: 'echo "error message" >&2 && exit 0',
        expect: 'exit-0',
        enabled: true,
        capture: 'stderr',
      };

      const result = await runCheck({
        name: 'stderr-capture',
        definition,
        timeout: 5000,
      });

      expect(result.stderr).toContain('error message');
    });

    it('should capture both stdout and stderr when capture is both', async () => {
      const definition: CheckDefinition = {
        run: 'echo "stdout message" && echo "stderr message" >&2 && exit 0',
        expect: 'exit-0',
        enabled: true,
        capture: 'both',
      };

      const result = await runCheck({
        name: 'both-capture',
        definition,
        timeout: 5000,
      });

      expect(result.stdout).toContain('stdout message');
      expect(result.stderr).toContain('stderr message');
    });

    it('should not capture output when capture is not specified', async () => {
      const definition: CheckDefinition = {
        run: 'echo "hidden output"',
        expect: 'exit-0',
        enabled: true,
      };

      const result = await runCheck({
        name: 'no-capture',
        definition,
        timeout: 5000,
      });

      // Should still have empty strings
      expect(typeof result.stdout).toBe('string');
      expect(typeof result.stderr).toBe('string');
    });
  });

  describe('timeout handling', () => {
    it('should timeout long-running process and mark as failed', async () => {
      const definition: CheckDefinition = {
        run: 'sleep 10',
        expect: 'exit-0',
        enabled: true,
      };

      const result = await runCheck({
        name: 'timeout-check',
        definition,
        timeout: 100, // 100ms timeout
      });

      expect(result.checkResult.status).toBe('failed');
      expect(result.checkResult.details?.message).toMatch(/timed.*out|timeout|killed/i);
    });

    it('should respect custom timeout from definition', async () => {
      const definition: CheckDefinition = {
        run: 'sleep 5',
        expect: 'exit-0',
        enabled: true,
        timeout: 50, // Very short timeout in definition
      };

      const result = await runCheck({
        name: 'custom-timeout',
        definition,
        timeout: 10000, // Long timeout in engine, but definition overrides
      });

      expect(result.checkResult.status).toBe('failed');
    });
  });

  describe('duration measurement', () => {
    it('should measure duration accurately', async () => {
      const definition: CheckDefinition = {
        run: 'exit 0',
        expect: 'exit-0',
        enabled: true,
      };

      const result = await runCheck({
        name: 'duration-check',
        definition,
        timeout: 5000,
      });

      expect(result.checkResult.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.checkResult.duration).toBe('number');
    });
  });
});
