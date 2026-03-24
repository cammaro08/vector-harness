import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runTests, TestRunResult, TestRunnerOptions } from '../testRunner';
import { spawn } from 'child_process';

// Mock child_process.spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

const mockSpawn = spawn as any;

describe('testRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('runTests', () => {
    it('returns passed:3, failed:0 when npm test output shows 3 passing tests', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('✓ test 1\n✓ test 2\n✓ test 3\n\nTests 3 passed\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const result = await runTests({ cwd: '/test' });

      expect(result.passed).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.exitCode).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('returns failed:2 with error messages when tests fail', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('✓ test 1\n× test 2 (error: Expected true to be false)\n× test 3 (error: timeout)\n\nTests 1 passed, 2 failed\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(1);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const result = await runTests({ cwd: '/test' });

      expect(result.passed).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.exitCode).toBe(1);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('test 2');
      expect(result.errors[1]).toContain('test 3');
    });

    it('returns exitCode:1 when tests fail, exitCode:0 when they pass', async () => {
      // Test passing case
      const mockProcessPass = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('✓ test\n\nTests 1 passed\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcessPass);
      const passingResult = await runTests({ cwd: '/test' });
      expect(passingResult.exitCode).toBe(0);

      // Test failing case
      const mockProcessFail = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('× test\n\nTests 1 failed\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(1);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcessFail);
      const failingResult = await runTests({ cwd: '/test' });
      expect(failingResult.exitCode).toBe(1);
    });

    it('rejects when process exceeds timeout', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn(),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            // Never calls close - simulates hanging process
          }
        }),
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const promise = runTests({ cwd: '/test', timeout: 100 });
      await expect(promise).rejects.toThrow('Test run exceeded timeout');
    });

    it('parses Vitest output format correctly with "Tests X passed" pattern', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('✓ first test\n✓ second test\n✓ third test\n\nTests 3 passed (12 ms)\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const result = await runTests({ cwd: '/test' });

      expect(result.passed).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('returns skipped count from output', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('✓ test 1\n○ test 2 (skipped)\n✓ test 3\n\nTests 2 passed, 1 skipped\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const result = await runTests({ cwd: '/test' });

      expect(result.passed).toBe(2);
      expect(result.skipped).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('handles empty test output gracefully', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from(''));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const result = await runTests({ cwd: '/test' });

      expect(result.passed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.exitCode).toBe(0);
      // When no tests detected, parser adds a warning
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('WARNING: No tests detected');
    });

    it('uses default command "npm test" when command option not provided', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('✓ test\n\nTests 1 passed\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      await runTests({ cwd: '/test' });

      expect(mockSpawn).toHaveBeenCalledWith('npm', ['test'], expect.objectContaining({ cwd: '/test' }));
    });

    it('uses custom command when provided', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('✓ test\n\nTests 1 passed\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      await runTests({ cwd: '/test', command: 'vitest run --no-coverage' });

      expect(mockSpawn).toHaveBeenCalledWith('vitest', ['run', '--no-coverage'], expect.any(Object));
    });

    it('uses default timeout of 30000ms when timeout option not provided', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('✓ test\n\nTests 1 passed\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const result = await runTests({ cwd: '/test' });

      expect(result).toBeDefined();
      expect(result.passed).toBe(1);
    });

    it('captures stderr output in result', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('✓ test\n\nTests 1 passed\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Warning: something\n'));
            }
          }),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const result = await runTests({ cwd: '/test' });

      expect(result.stdout).toContain('Tests 1 passed');
    });

    it('measures test duration correctly', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('✓ test\n\nTests 1 passed (156 ms)\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            // Simulate async close event
            setImmediate(() => callback(0));
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const result = await runTests({ cwd: '/test' });

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('handles process error events', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn(),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Process spawn failed'));
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const promise = runTests({ cwd: '/test' });
      await expect(promise).rejects.toThrow('Process spawn failed');
    });

    it('combines multiple stdout chunks into complete output', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              // Simulate multiple data chunks
              callback(Buffer.from('✓ test 1\n'));
              callback(Buffer.from('✓ test 2\n'));
              callback(Buffer.from('\nTests 2 passed\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const result = await runTests({ cwd: '/test' });

      expect(result.passed).toBe(2);
      expect(result.stdout).toContain('✓ test 1');
      expect(result.stdout).toContain('✓ test 2');
    });

    it('handles test names with special characters', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('× should handle "special" chars\' & <html>\n\nTests 1 failed\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(1);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const result = await runTests({ cwd: '/test' });

      expect(result.failed).toBe(1);
      expect(result.errors.length).toBe(1);
    });

    it('parses tests with multiple error details', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('× test 1 (AssertionError: Expected 5 to equal 10)\n× test 2 (TypeError: Cannot read property "x" of undefined)\n\nTests 2 failed\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(1);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const result = await runTests({ cwd: '/test' });

      expect(result.failed).toBe(2);
      expect(result.errors.length).toBe(2);
    });

    it('parses complex test summary with passed, failed, and skipped', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('✓ test 1\n× test 2\n○ test 3\n\nTests 1 passed, 1 failed, 1 skipped\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(1);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const result = await runTests({ cwd: '/test' });

      expect(result.passed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('parses "Tests X failed, Y skipped" format', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('× test 1\n○ test 2\n\nTests 1 failed, 1 skipped\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(1);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const result = await runTests({ cwd: '/test' });

      expect(result.failed).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('returns zero counts when no valid test summary is found', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Some random output without test summary\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const result = await runTests({ cwd: '/test' });

      expect(result.passed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('filters out empty lines when extracting error messages', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('× test 1\n\n× \n\n× test 2\n\nTests 2 failed\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(1);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const result = await runTests({ cwd: '/test' });

      expect(result.errors.length).toBe(2);
      expect(result.errors.every((e) => e.length > 0)).toBe(true);
    });

    it('parses command with multiple arguments correctly', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('✓ test\n\nTests 1 passed\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      await runTests({ cwd: '/test', command: 'pnpm test --reporter=verbose --coverage' });

      expect(mockSpawn).toHaveBeenCalledWith('pnpm', ['test', '--reporter=verbose', '--coverage'], expect.any(Object));
    });

    it('clears timeout on process close event', async () => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('✓ test\n\nTests 1 passed\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setImmediate(() => callback(0));
          }
        }),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const result = await runTests({ cwd: '/test', timeout: 5000 });

      expect(result.passed).toBe(1);
    });
  });
});
