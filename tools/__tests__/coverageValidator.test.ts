import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateCoverage, CoverageResult, CoverageOptions } from '../coverageValidator';
import { spawn } from 'child_process';

vi.mock('child_process');

describe('coverageValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateCoverage', () => {
    it('returns passes:true when coverage 85% >= threshold 80%', async () => {
      const mockOutput = `
 % Coverage report from v8
 File           | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
All files       |   85.71 |    83.33 |   88.89 |   87.50
      `;

      mockSpawnWithOutput(mockOutput, 0);

      const result = await validateCoverage({
        cwd: '/test',
        threshold: 80
      });

      expect(result.passes).toBe(true);
      expect(result.statements).toBe(85.71);
      expect(result.branches).toBe(83.33);
      expect(result.functions).toBe(88.89);
      expect(result.lines).toBe(87.50);
    });

    it('returns passes:false when coverage 70% < threshold 80%', async () => {
      const mockOutput = `
 % Coverage report from v8
 File           | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
All files       |   70.00 |    68.00 |   65.00 |   72.00
      `;

      mockSpawnWithOutput(mockOutput, 0);

      const result = await validateCoverage({
        cwd: '/test',
        threshold: 80
      });

      expect(result.passes).toBe(false);
      expect(result.statements).toBe(70.00);
    });

    it('parses Vitest coverage output with all 4 metrics', async () => {
      const mockOutput = `
 % Coverage report from v8
 File           | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
All files       |   91.20 |    89.15 |   94.44 |   92.30
      `;

      mockSpawnWithOutput(mockOutput, 0);

      const result = await validateCoverage({
        cwd: '/test',
        threshold: 75
      });

      expect(result.statements).toBe(91.20);
      expect(result.branches).toBe(89.15);
      expect(result.functions).toBe(94.44);
      expect(result.lines).toBe(92.30);
    });

    it('uses default threshold of 80 when not specified', async () => {
      const mockOutput = `
 % Coverage report from v8
 File           | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
All files       |   85.00 |    85.00 |   85.00 |   85.00
      `;

      mockSpawnWithOutput(mockOutput, 0);

      const result = await validateCoverage({
        cwd: '/test'
      });

      expect(result.threshold).toBe(80);
      expect(result.passes).toBe(true);
    });

    it('calculates overall as average of all 4 metrics', async () => {
      const mockOutput = `
 % Coverage report from v8
 File           | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
All files       |   80.00 |    80.00 |   80.00 |   80.00
      `;

      mockSpawnWithOutput(mockOutput, 0);

      const result = await validateCoverage({
        cwd: '/test',
        threshold: 75
      });

      // Average of 80, 80, 80, 80 = 80
      expect(result.overall).toBe(80);
    });

    it('calculates overall as average with varying metrics', async () => {
      const mockOutput = `
 % Coverage report from v8
 File           | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
All files       |   70.00 |    80.00 |   90.00 |   100.00
      `;

      mockSpawnWithOutput(mockOutput, 0);

      const result = await validateCoverage({
        cwd: '/test',
        threshold: 75
      });

      // Average of 70, 80, 90, 100 = 85
      expect(result.overall).toBe(85);
    });

    it('uses default command when not specified', async () => {
      const mockOutput = `
 % Coverage report from v8
 File           | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
All files       |   85.00 |    85.00 |   85.00 |   85.00
      `;

      mockSpawnWithOutput(mockOutput, 0);

      await validateCoverage({
        cwd: '/test'
      });

      const spawnMock = spawn as unknown as ReturnType<typeof vi.fn>;
      expect(spawnMock).toHaveBeenCalledWith(
        expect.stringContaining('npm'),
        expect.arrayContaining(['run', 'test:coverage']),
        expect.objectContaining({ cwd: '/test' })
      );
    });

    it('uses custom command when specified', async () => {
      const mockOutput = `
 % Coverage report from v8
 File           | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
All files       |   85.00 |    85.00 |    85.00 |   85.00
      `;

      mockSpawnWithOutput(mockOutput, 0);

      await validateCoverage({
        cwd: '/test',
        command: 'custom coverage command'
      });

      const spawnMock = spawn as unknown as ReturnType<typeof vi.fn>;
      expect(spawnMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it('returns details with raw coverage summary text', async () => {
      const mockOutput = `
 % Coverage report from v8
 File           | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
All files       |   85.00 |    85.00 |   85.00 |   85.00
      `;

      mockSpawnWithOutput(mockOutput, 0);

      const result = await validateCoverage({
        cwd: '/test'
      });

      expect(result.details).toContain('All files');
      expect(result.details.length).toBeGreaterThan(0);
    });

    it('handles case where coverage output is empty', async () => {
      mockSpawnWithOutput('', 1);

      await expect(validateCoverage({
        cwd: '/test'
      })).rejects.toThrow('Command failed with exit code 1');
    });

    it('returns structured error when output does not contain coverage table', async () => {
      const mockOutput = 'Some unexpected output without coverage data';

      mockSpawnWithOutput(mockOutput, 0);

      const result = await validateCoverage({
        cwd: '/test'
      });

      expect(result.passes).toBe(false);
      expect(result.parseError).toBeDefined();
      expect(result.parseError).toContain('Failed to parse coverage output');
      expect(result.statements).toBe(0);
      expect(result.branches).toBe(0);
      expect(result.functions).toBe(0);
      expect(result.lines).toBe(0);
    });

    it('parses table format with All files row', async () => {
      const mockOutput = `
 % Coverage report from v8
 File                 | % Stmts | % Branch | % Funcs | % Lines
----------------------|---------|----------|---------|--------
 src/index.ts         |    95.0 |    90.0  |   92.0  |    94.0
 src/utils.ts         |    80.0 |    75.0  |   80.0  |    82.0
All files             |   87.50 |    82.50 |   86.00 |    88.00
      `;

      mockSpawnWithOutput(mockOutput, 0);

      const result = await validateCoverage({
        cwd: '/test',
        threshold: 80
      });

      expect(result.statements).toBe(87.50);
      expect(result.branches).toBe(82.50);
      expect(result.functions).toBe(86.00);
      expect(result.lines).toBe(88.00);
      expect(result.passes).toBe(true);
    });

    it('handles values without decimals in coverage output', async () => {
      const mockOutput = `
 % Coverage report from v8
 File           | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
All files       |   85 |   80 |   90 |   88
      `;

      mockSpawnWithOutput(mockOutput, 0);

      const result = await validateCoverage({
        cwd: '/test',
        threshold: 80
      });

      expect(result.statements).toBe(85);
      expect(result.branches).toBe(80);
      expect(result.functions).toBe(90);
      expect(result.lines).toBe(88);
    });

    it('returns result with all expected properties', async () => {
      const mockOutput = `
 % Coverage report from v8
 File           | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
All files       |   85.00 |    85.00 |   85.00 |   85.00
      `;

      mockSpawnWithOutput(mockOutput, 0);

      const result = await validateCoverage({
        cwd: '/test',
        threshold: 80
      });

      expect(result).toHaveProperty('lines');
      expect(result).toHaveProperty('statements');
      expect(result).toHaveProperty('branches');
      expect(result).toHaveProperty('functions');
      expect(result).toHaveProperty('overall');
      expect(result).toHaveProperty('threshold');
      expect(result).toHaveProperty('passes');
      expect(result).toHaveProperty('details');
    });

    it('passes correctly when overall equals threshold', async () => {
      const mockOutput = `
 % Coverage report from v8
 File           | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
All files       |   80.00 |    80.00 |   80.00 |   80.00
      `;

      mockSpawnWithOutput(mockOutput, 0);

      const result = await validateCoverage({
        cwd: '/test',
        threshold: 80
      });

      expect(result.overall).toBe(80);
      expect(result.passes).toBe(true);
    });

    it('fails correctly when overall is below threshold', async () => {
      const mockOutput = `
 % Coverage report from v8
 File           | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
All files       |   79.99 |    79.99 |   79.99 |   79.99
      `;

      mockSpawnWithOutput(mockOutput, 0);

      const result = await validateCoverage({
        cwd: '/test',
        threshold: 80
      });

      expect(result.overall).toBeLessThan(80);
      expect(result.passes).toBe(false);
    });

    it('handles stderr output from command', async () => {
      const mockOutput = `
 % Coverage report from v8
 File           | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
All files       |   85.00 |    85.00 |   85.00 |   85.00
      `;

      mockSpawnWithStderr(mockOutput, '', 0);

      const result = await validateCoverage({
        cwd: '/test'
      });

      expect(result.passes).toBe(true);
    });

    it('rejects when process emits error event', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event: string, callback: (data: Buffer) => void) => {
            if (event === 'data') {
              callback(Buffer.from(''));
            }
          })
        },
        stderr: {
          on: vi.fn()
        },
        on: vi.fn((event: string, callback: (err?: Error) => void) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('spawn ENOENT')), 0);
          }
        })
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      await expect(validateCoverage({
        cwd: '/test'
      })).rejects.toThrow('spawn ENOENT');
    });

    it('rejects when process exits with non-zero code', async () => {
      mockSpawnWithOutput('', 1);

      await expect(validateCoverage({
        cwd: '/test'
      })).rejects.toThrow('Command failed with exit code 1');
    });

    it('rejects when command execution times out', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn()
        },
        stderr: {
          on: vi.fn()
        },
        on: vi.fn(),
        kill: vi.fn()
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      await expect(validateCoverage({
        cwd: '/test',
        timeout: 100
      })).rejects.toThrow('timeout after 100ms');
    });

    it('includes parseError in result when coverage output is unparseable', async () => {
      const mockOutput = 'No coverage data here';

      mockSpawnWithOutput(mockOutput, 0);

      const result = await validateCoverage({
        cwd: '/test'
      });

      expect(result.parseError).toBeDefined();
      expect(result.parseError).toContain('Failed to parse coverage output');
      expect(result.passes).toBe(false);
      expect(result.overall).toBe(0);
    });

    it('does not include parseError when coverage output is valid', async () => {
      const mockOutput = `
 % Coverage report from v8
 File           | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
All files       |   85.00 |    85.00 |   85.00 |   85.00
      `;

      mockSpawnWithOutput(mockOutput, 0);

      const result = await validateCoverage({
        cwd: '/test'
      });

      expect(result.parseError).toBeUndefined();
      expect(result.passes).toBe(true);
    });
  });
});

// Helper functions to mock spawn
function mockSpawnWithOutput(output: string, exitCode: number) {
  const mockProcess = {
    stdout: {
      on: vi.fn((event: string, callback: (data: Buffer) => void) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(output)), 0);
        }
      })
    },
    stderr: {
      on: vi.fn()
    },
    on: vi.fn((event: string, callback: (code: number) => void) => {
      if (event === 'close') {
        setTimeout(() => callback(exitCode), 0);
      }
    })
  };

  vi.mocked(spawn).mockReturnValue(mockProcess as any);
}

function mockSpawnWithStderr(
  output: string,
  stderrOutput: string,
  exitCode: number
) {
  const mockProcess = {
    stdout: {
      on: vi.fn((event: string, callback: (data: Buffer) => void) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(output)), 0);
        }
      })
    },
    stderr: {
      on: vi.fn((event: string, callback: (data: Buffer) => void) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(stderrOutput)), 0);
        }
      })
    },
    on: vi.fn((event: string, callback: (code: number) => void) => {
      if (event === 'close') {
        setTimeout(() => callback(exitCode), 0);
      }
    })
  };

  vi.mocked(spawn).mockReturnValue(mockProcess as any);
}
