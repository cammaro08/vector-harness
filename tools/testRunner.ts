import { spawn, ChildProcess } from 'child_process';

export interface TestRunResult {
  passed: number;
  failed: number;
  skipped: number;
  errors: string[];
  exitCode: number;
  stdout: string;
  duration: number;
}

export interface TestRunnerOptions {
  cwd: string;
  timeout?: number;
  command?: string;
}

/**
 * Runs tests in the specified working directory and returns test results.
 * Spawns a child process to execute the test command (default: npm test).
 * Returns structured test results with pass/fail counts and error details.
 */
export async function runTests(options: TestRunnerOptions): Promise<TestRunResult> {
  const { cwd, timeout = 30000, command = 'npm test' } = options;

  return new Promise((resolve, reject) => {
    const { program, args } = parseCommand(command);

    const process = spawn(program, args, { cwd });

    let stdout = '';
    const startTime = Date.now();
    let timeoutHandle: NodeJS.Timeout | null = null;

    // Set up timeout
    timeoutHandle = setTimeout(() => {
      process.kill();
      reject(new Error('Test run exceeded timeout'));
    }, timeout);

    // Handle stdout
    process.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    // Handle stderr
    process.stderr.on('data', (data: Buffer) => {
      // Note: stderr is available for logging but not included in result
      // This allows capturing both stdout and stderr if needed
    });

    // Handle process close
    process.on('close', (code: number) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      const duration = Date.now() - startTime;
      const result = parseTestOutput(stdout, code, duration);

      resolve(result);
    });

    // Handle process errors
    process.on('error', (error: Error) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      reject(error);
    });
  });
}

/**
 * Parses a shell command string into program and arguments.
 * Example: "npm test --coverage" → { program: 'npm', args: ['test', '--coverage'] }
 */
function parseCommand(command: string): { program: string; args: string[] } {
  const [program, ...args] = command.split(' ');
  return { program, args };
}

/**
 * Extracts test count summary from Vitest output.
 * Handles multiple formats: "Tests X passed", "Tests X failed", "Tests X passed, Y failed, Z skipped"
 */
function extractTestCounts(output: string): {
  passed: number;
  failed: number;
  skipped: number;
} {
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  // Pattern 1: "Tests 3 passed, 2 failed, 1 skipped"
  let match = output.match(
    /Tests\s+(\d+)\s+passed(?:,\s*(\d+)\s+failed)?(?:,\s*(\d+)\s+skipped)?/i
  );

  if (match) {
    passed = parseInt(match[1], 10) || 0;
    failed = parseInt(match[2], 10) || 0;
    skipped = parseInt(match[3], 10) || 0;
    return { passed, failed, skipped };
  }

  // Pattern 2: "Tests 2 failed, 1 skipped"
  match = output.match(/Tests\s+(\d+)\s+failed(?:,\s*(\d+)\s+skipped)?/i);
  if (match) {
    failed = parseInt(match[1], 10) || 0;
    skipped = parseInt(match[2], 10) || 0;
    return { passed, failed, skipped };
  }

  // Pattern 3: "Tests 1 failed" or "Tests 2 passed"
  match = output.match(/Tests\s+(\d+)\s+(passed|failed)/i);
  if (match) {
    if (match[2].toLowerCase() === 'passed') {
      passed = parseInt(match[1], 10) || 0;
    } else {
      failed = parseInt(match[1], 10) || 0;
    }
    return { passed, failed, skipped };
  }

  // Fallback: count individual test indicators
  const passMatches = output.match(/✓/g);
  const failMatches = output.match(/×/g);
  const skipMatches = output.match(/○/g);

  passed = passMatches ? passMatches.length : 0;
  failed = failMatches ? failMatches.length : 0;
  skipped = skipMatches ? skipMatches.length : 0;

  return { passed, failed, skipped };
}

/**
 * Extracts error messages from failed tests in Vitest output.
 * Looks for lines starting with × (failure indicator).
 */
function extractErrorMessages(output: string): string[] {
  const errors: string[] = [];
  const failedTestLines = output.split('\n').filter((line) => line.includes('×'));

  failedTestLines.forEach((line) => {
    const cleanedLine = line.replace(/×\s*/, '').trim();
    if (cleanedLine) {
      errors.push(cleanedLine);
    }
  });

  return errors;
}

/**
 * Parses Vitest test output and extracts structured test results.
 * Returns counts of passed, failed, and skipped tests, along with error details.
 *
 * Cross-validation checks:
 * 1. Warns if zero tests detected (may indicate parsing failure)
 * 2. Warns if exit code 0 but failures detected (format change detection)
 */
function parseTestOutput(
  output: string,
  exitCode: number,
  duration: number
): TestRunResult {
  const { passed, failed, skipped } = extractTestCounts(output);
  let errors = extractErrorMessages(output);

  const total = passed + failed + skipped;

  // Cross-validation check 1: Warn if zero tests detected
  if (total === 0) {
    errors = [...errors, 'WARNING: No tests detected in output. Parser may have failed to read Vitest output format.'];
  }

  // Cross-validation check 2: Exit code 0 but failures detected
  if (exitCode === 0 && failed > 0) {
    errors = [...errors, `WARNING: Exit code 0 but ${failed} failed tests detected. Vitest output format may have changed.`];
  }

  return {
    passed,
    failed,
    skipped,
    errors,
    exitCode,
    stdout: output,
    duration,
  };
}
